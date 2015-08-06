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
    // get db connection
    var db = req.db;

    //set the collection
    if (req.body.device == "chrome"){
        var collection = db.get('log_chrome');
    }
    //TODO: add for other devices and collections 
 
    //store the entry to db
    collection.insert({
        "user_id": req.body.user_id,
        "event": req.body.event,
        "timestamp": req.body.timestamp,
        "details": req.body.details,
        "query": req.body.query,

    }, function(err, doc){
        if (err){
            res.send("error occurred when inserting record");
            console.log(err);
        }
        else
            res.send("success");
    });

});


module.exports = router;
