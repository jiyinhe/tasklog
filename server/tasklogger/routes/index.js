var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* GET page for check db data*/
router.get('/logpeek', function(req, res){
    var db = req.db;
    var collection = db.get('log_chrome');
    collection.find({}, {}, function(e, docs){
        res.render('logpeek', {
            "entries": docs
        });
    });
});

/* process data posting request from chrome */
router.post('/savedata', function(req, res){
    console.log('here');
    // get db connection
    var db = req.db;
    var data = JSON.parse(req.body.data);

    //set the collection
    var collection = null;
    // we can do this because if it's sent by batch
    // its sent by the same device, same user
    if (data[0].device == "chrome"){
        collection = db.get('log_chrome');
    }
    //TODO: add for other devices and collections 
    //store the entry to db
    collection.col.insert(data, function(err, doc){
        if (err){
            res.send({
                "error": true,
                "emsg": "error occurred when inserting record",
            });
            console.log(err);
        }
        else
            res.send({"error": false});
    });
});


module.exports = router;
