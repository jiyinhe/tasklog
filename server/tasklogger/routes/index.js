var express = require('express');
var pako = require('pako');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
 //   res.render('index', { title: 'Express' });
    if (req.user===undefined){
        res.redirect('/users/login');
    }
    else 
        res.redirect('/users/annotation');

});

/* Get post-questionnaire */
router.get('/post-questionnaire', function(req, res, next){
    res.render('post-questionnaire', {});
});

 

/* GET page for check db data*/
router.get('/logpeek', function(req, res, next){
    var db = req.db;
    var collection = db.get('log_chrome');

    var query = {};
    if (req.query.userid === undefined){}
    else if (req.query.userid != '')
        query['userid'] = req.query.userid;

    var query_ts = {}; 
    if (req.query.from === undefined){}
    else
        query_ts.$gte = parseInt(req.query.from);

    if (req.query.to === undefined){}
    else
        query_ts.$lte = parseInt(req.query.to);

    if (Object.keys(query_ts).length > 0)
        query['timestamp'] = query_ts;

    //Query DB
    if (Object.keys(query).length > 0)
       collection.find(query, {sort: {timestamp: 1}}, function(e, docs){
            console.log(docs.length);
            res.render('logpeek', {
                "title": "Logview",
                "docs": format_records(docs),
                });
        }); 
    else
        res.render('logpeek', {"title": "Logview", "docs": []});
});

/* save serp */
router.post('/saveserp', function(req, res){
    var db = req.db;
    var data = JSON.parse(req.body.data);
    for(var i = 0; i<data.length; i++){
        data[i].serp = pako.inflate(data[i].serp, {'to': 'string'});
        data[i]['timestamp_bson'] = new Date(data[i]['timestamp']);
    }

    collection = db.get('log_serp');

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

/* process data posting request from chrome */
router.post('/savedata', function(req, res){
    // get db connection
    var db = req.db;
    var data = JSON.parse(req.body.data);
 
    // TODO: test this in deployment
    var IP = req.ip;

    //set the collection
    var collection = null;
    // we can do this because if it's sent by batch
    // its sent by the same device, same user
    if (data[0].device == "chrome"){
        collection = db.get('log_chrome');
        for (var i = 0; i < data.length; i++){
            data[i]['IP'] = IP;
            data[i]['timestamp_bson'] = new Date(data[i]['timestamp']);
        }
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

function format_records(docs){
    var D = [];
    for (var i = 0; i<docs.length; i++){
        var d = {'count': i+1,
                 'userid': docs[i].userid, 
                 'timestamp': docs[i].timestamp,
                 'event': docs[i]['event'],
                 'tabId': docs[i]['affected_tab_id'],
                 'class': ''
                };
        if (docs[i]['event'] == 'tab-search'){
            d['details'] = JSON.stringify({ 
                'query': docs[i].details.query,
                'engine': docs[i].details.engine,
                'start': docs[i].details.start,
                'media': docs[i].details.media,
            });
            d['url'] =  docs[i].details.current_tab.url;
            d['title'] =  docs[i].details.current_tab.title;
            d['class'] = 'success';
        }
        else if (docs[i]['event'] == 'link_click'){
            d['details'] = JSON.stringify({'anchor text': docs[i].details.link_data.anchor});
            d['url'] = docs[i].details.senderTab.url;
            d['title'] = docs[i].details.senderTab.title;
            d['class'] = "success";
        }
        else if (docs[i]['event'] == 'form_submit'){
            d['details'] = JSON.stringify(docs[i].details.form_data);
            d['url'] = docs[i].details.senderTab.url;
            d['title'] = docs[i].details.senderTab.title;
            d['class'] = "success";
        }
        else if (docs[i]['event'] == 'tab-replaced'){
            d['details'] = JSON.stringify(docs[i].details);
            d['url'] = '';
            d['title'] = '';
        }
        else if (docs[i]['event'] == 'tab-close'){
            d['url'] = '';
            d['title'] = '';
            d['details'] = '';
        }
        else if (docs[i]['event'].indexOf('tab') > -1){
            d['url'] = docs[i].details.current_tab.url;
            d['title'] = docs[i].details.current_tab.title;
            d['details'] = '';
            if (docs[i]['event'] == 'tab-open-in-new')
                d['details'] = JSON.stringify({
                    'newTabId': docs[i].details.new_tab.id,
                    'openerTabId': docs[i].details.new_tab.openerTabId,
                    'newTabTitle': docs[i].details.new_tab.title,
                    'newTabURL': docs[i].details.new_tab.url,
                });

        }
        else if (docs[i]['event'].indexOf('navigation')>-1){
            d['url'] = docs[i].details.url;
            d['details'] = 'TransitionType: '+docs[i].details.transitionType; 
            d['class'] = 'success';
        }
        D.push(d);
    }
    return D
}

module.exports = router;
