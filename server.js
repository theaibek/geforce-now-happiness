//  OpenShift sample Node application
var express = require('express'),
	app = express(),
	morgan = require('morgan'),
	bodyParser = require('body-parser');

Object.assign = require('object-assign');

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
	ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
	mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
	mongoURLLabel = '';

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
	var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
		mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
		mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
		mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
		mongoPassword = process.env[mongoServiceName + '_PASSWORD'];
	mongoUser = process.env[mongoServiceName + '_USER'];

	if (mongoHost && mongoPort && mongoDatabase) {
		mongoURLLabel = mongoURL = 'mongodb://';
		if (mongoUser && mongoPassword) {
			mongoURL += mongoUser + ':' + mongoPassword + '@';
		}
		// Provide UI label that excludes user id and pw
		mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
		mongoURL += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
	}
}
var db = null;

var initDb = function (callback) {
	if (mongoURL == null) return;

	var mongodb = require('mongodb');
	if (mongodb == null) return;

	mongodb.connect(mongoURL, function (err, conn) {
		if (err) {
			callback(err);
			return;
		}

		db = conn;

		console.log('Connected to MongoDB at: %s', mongoURL);
	});
};

var searchIP = function (ip, callback) {
	if (!db) {
		callback(false);
		return;
	}
	db.collection('records').findOne({ip: ip}, (function (error, result) {
		if (error || !result) callback(false);
		else if (result['ip'] === ip) callback(true);
		else callback(false);
	}));
};

var insertRecord = function (record, callback) {
	db.collection('records').insertOne(record, (function (error) {
		callback(error);
	}));
};

var aggregateRecords = function (callback) {
	var data = {
		exists: false,
		count: 0,
		ageAvg: 0,
		ageMin: 0,
		ageMax: 0,
		wtAvg: '0 w.',
		wtMin: '0 w.',
		wtMax: '0 w.',
		percentageUS: '0%',
		percentageEU: '0%',
		percentageMac: '0%',
		percentagePC: '0%'
	};
	if (!db) {
		callback(false);
		return;
	}
	db.collection('records').aggregate([{
		$group: {
			_id: null,
			users: {$sum: 1},
			usersUS: {$sum: {$cond: [{$eq: ['$location', 'us']}, 1, 0]}},
			usersEU: {$sum: {$cond: [{$eq: ['$location', 'eu']}, 1, 0]}},
			usersPC: {$sum: {$cond: [{$eq: ['$os', 'pc']}, 1, 0]}},
			usersMac: {$sum: {$cond: [{$eq: ['$os', 'mac']}, 1, 0]}},
			avgAge: {$avg: '$age'},
			minAge: {$min: '$age'},
			maxAge: {$max: '$age'},
			avgWT: {$avg: '$wait_time'},
			minWT: {$min: '$wait_time'},
			maxWT: {$max: '$wait_time'}
		}
	}], function (error, result) {
		if (error || !result || !result[0]) {
			callback(data);
			return;
		}
		data = {
			exists: false,
			count: result[0]['users'],
			ageAvg: Math.round(result[0]['avgAge']),
			ageMin: result[0]['minAge'],
			ageMax: result[0]['maxAge'],
			wtAvg: Math.round(result[0]['avgWT']) + ' w.',
			wtMin: result[0]['minWT'] + ' w.',
			wtMax: result[0]['maxWT'] + ' w.',
			percentageUS: result[0]['usersUS'] === 0 ? '0%' : ((result[0]['usersUS'] * 100) / result[0]['users']).toFixed(0) + '%',
			percentageEU: result[0]['usersEU'] === 0 ? '0%' : ((result[0]['usersEU'] * 100) / result[0]['users']).toFixed(0) + '%',
			percentageMac: result[0]['usersMac'] === 0 ? '0%' : ((result[0]['usersMac'] * 100) / result[0]['users']).toFixed(0) + '%',
			percentagePC: result[0]['usersPC'] === 0 ? '0%' : ((result[0]['usersPC'] * 100) / result[0]['users']).toFixed(0) + '%'
		};
		callback(data);
	});
};

var renderHome = function (req, res) {
	aggregateRecords(function (data) {
		searchIP(req.ip, function (exists) {
			data['exists'] = exists;
			res.render('index.html', data);
		});
	});
};

app.get('/', function (req, res) {
	renderHome(req, res);
});

app.post('/submit', function (req, res) {
	var record = {
		wait_time: require('mongodb').Long.fromString(req.body['wait_time']),
		location: req.body['location'],
		os: req.body['os'],
		age: require('mongodb').Long.fromString(req.body['age']),
		ip: req.ip,
		timestamp: new Date().toISOString()
	};
	insertRecord(record, function (err) {
		res.redirect('/');
	});
});

app.get('/pagecount', function (req, res) {
	res.send('{ pageCount: -1 }');
});

// error handling
app.use(function (err, req, res, next) {
	console.error(err.stack);
	res.status(500).send('Something bad happened!');
});

initDb(function (err) {
	console.log('Error connecting to Mongo. Message:\n' + err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app;
