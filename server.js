const express = require('express');
const mongodb = require('mongodb');
const https = require('https');

const app = express();
express().use("/api", app);

// imagesearch/puppies?offset=0'

// defaults
let offset = 0; 
let term = 'puppies'; 

const uri = 'mongodb://' + process.env.USER + ':' + process.env.PASS + 
      '@' + process.env.HOST + ':' + process.env.DBPORT + '/examplesearch';
const proj = 'https://img-search-abs-second-attempt.glitch.me';
const subscriptionKey = process.env.KEY.toString();
const engineId = process.env.ENGINE.toString();
const host = 'www.googleapis.com';
const path = '/customsearch/v1?key=' + subscriptionKey + '&cx=' + engineId + '&searchType=image';

app.get("/", (req, res) => {
  res.redirect(proj + "/imagesearch/" + term + "?offset=" + offset);
});

app.get("/latest/imagesearch", (req, res) => {
  mongodb.MongoClient.connect(uri, (err, db) => {
    if (err)
      console.error(err);
    
    const coll = db.db('examplesearch').collection('queries');
    coll.find({}).toArray((err, docs) => {
      if (err)
        console.error(err);
      
      docs = JSON.stringify(docs, ['term', 'when'], ' ');
      let paginate = [];
      for (let i = 0; i < Math.min(10, JSON.parse(docs).length); i++) {
        paginate.push(JSON.parse(docs)[i]);
      }
      res.send(paginate.reverse());
      db.close();
    });
  });
});

app.get("/imagesearch/:term", (requesting, responding) => {
  term = requesting.params.term;
  if (requesting.query.offset) 
    offset = requesting.query.offset;
  
  mongodb.MongoClient.connect(uri, (err, db) => {
    if (err) 
      console.error(err);
    
    const coll = db.db('examplesearch').collection('queries');
    coll.insert({"term": term, "when": Date()}, (err, result) => {
      if (err)
        console.error(err);
        
      db.close();
    });
  });
  
  let response_handler = function (response) {
    let body = '';
    response.on('data', function (d) {
      body += d;
    });
    response.on('end', function () {
      // body = JSON.stringify(JSON.parse(body).items, ['displayLink', 'title', 'image'], ' ');
      body = JSON.parse(body).items.map((curr) => {
        return {
          host: curr.displayLink,
          title: curr.title,
          thumbnail: curr.image.thumbnailLink,
          context: curr.image.contextLink
        };
      });
      let paginate = [];
      let limit = parseInt(offset) + 10;
      for (let i = offset; i < Math.min(limit, body.length); i++) {
        paginate.push(body[i]);
      }
      responding.send(paginate);
    });
    response.on('error', function (e) {
      console.log('Error: ' + e.message);
    });
  };

  let google_image_search = function (search) {
    console.log('Searching images for: ' + term);
    let request_params = {
      method : 'GET',
      hostname : host,
      path : path + '&q=' + encodeURIComponent(search)
    };

    let req = https.request(request_params, response_handler);
    req.end();
  }

  if (subscriptionKey.length === 39) {
    google_image_search(term);
  } else {
    console.log('Invalid Google Search API subscription key!');
  }
});

const listener = app.listen(process.env.PORT, () => {
  console.log('ACTIVE PORT: ' + listener.address().port);
});