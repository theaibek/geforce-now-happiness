# geforce-now-happiness
Web app to analyse the happiness of people who got an access code to Geforce NOW Beta.


## Scripts
```
# Start MongoDB with Docker
docker run --name mongo -p 27017:27017 -v /path/to/data:/data/db -d mongo mongod

# Start the app
MONGO_URL=mongodb://localhost:27017/test npm start
```
