var express = require('express');
var bcrypt = require('bcrypt-nodejs');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;

/* GET users listing. */
router.get('/', function(req, res, next) {
  //res.send('respond with a resource');
    if (req.user===undefined){
        res.redirect('/users/login');
    }
    else 
        res.redirect('/users/annotation');
});

/* GET registration page. */
router.get('/registration', function(req, res, next) {
    res.render('registration', {});
});


/* GET login page */
router.get('/login', function(req, res, next){
    var err = req.flash();
    if (err['error'] === undefined ){
        res.render('login', {});
    }
    else {
        res.render('login', {'err': "Login faild: " + err['error']});
    }
});

//process registration data
router.post('/register_user', function(req, res){
    // get db connection
    var db = req.db;
    //set the collection
    var collection = db.get('user');
    // check if the email address has already been used
    var data = JSON.parse(req.body.data);

    collection.find({email: data.email}, {}, function(e, docs){
        //If user doesn't exist yet, register 
        if (docs.length == 0){
            var token = alphanumeric.shuffle().substring(0, 6);
            //store the user info
            var pass = bcrypt.hashSync(data.pass);
            collection.insert({
                'userid': token,
                'name': data.user,
                'email': data.email,
                'pass': pass,
                'info': data.info,
            }, function(err, doc){
                 // DB error
                //console.log(err)
                if (err){
                    res.send({
                        'emsg': 'An error occurred when creating user account, please try again.',
                        'err': true,
                        'errtype': 'db',
                    });
                    console.log('DB error:' + err);
                 } 
                // success in creating new user
                else{
                    res.send({
                        'err': false,
                        'userid': token,
                        'name': data.user,
                        'email': data.email,
                        'pass': data.pass
                    })
                }
            }); 
        }
        // Email already exist, err
        else
            res.send({
                'emsg': 'Email already registered',
                'err': true,
                'errtype': 'email',
            });
    });
});

/* GET registration page. */

/*
router.get('/dashboard', function(req, res, next) {
    if (req.user===undefined){
        res.redirect('/users/login');
    }
    //console.log(req.user)
    res.render('dashboard', {
        "user": req.user,
        "homeclass": "active",
        "title": "Tasklog - Home",
    });
});
*/

//Check if userid exists
router.post('/checkid', function(req, res){
    // get db connection
    var db = req.db;
    //set the collection
    var collection = db.get('user');
    //check if the userid exists
    collection.find({userid: req.body.userid}, {}, function(e, docs){
         if (docs.length == 0){
            res.send({'err': true, 'emsg': 'UserID does not exists'})
         }
         else{
            res.send({'err': false, 'user': docs[0]});
         }
    });
});

/* Instructions page */
router.get('/instructions', function(req, res, next) {
    //console.log(req.user)
    res.render('instructions', {
        "user": req.user,
        "instructionclass": "active",
        "title": "Tasklog - Instructions",
    });
});


       
/* Annotation page */
router.get('/annotation', function(req, res, next) {
//    console.log(req.user)
    if (req.user===undefined){
        res.redirect('/users/login');
    }

    //console.log(req.user)
    res.render('annotation', {
        "user": req.user,
        "annotationclass": "active",
        "title": "Tasklog - My annotations",
    });
});


/* Account information page */
router.get('/account', function(req, res, next) {
    if (req.user===undefined){
        res.redirect('/users/login');
    }
 
    res.render('account', {
        "user": req.user,
        "accountclass": "active",
        "title": "Tasklog - My account", 
    });
});



/* ajax for todo list (tasks) */
router.post('/ajax_tasks', function(req, res){
	console.log(req.body)
    // get db connection
    var db = req.db;
    //set the collection
    var collection = db.get('user_tasks');
    if (req.body['event'] == 'retrieve_tasks'){
        //get unfinished tasks, older goals rank lower
        collection.find({'userid': req.user.userid, 'done': false}, 
            {sort: {timestamp: -1}}, function(e, docs){
                if (e){
                    console.log('DB ERROR: '+ e) 
                    res.send({'err': true, 'emsg': e});
                }
                else{
                    //seperate level 0 from level 1 tasks
                    level0 = docs.filter(function(d){return d.task_level == 0});
                    level1 = docs.filter(function(d){return d.task_level == 1});
                    //make map of level 0 tasks
                    main_tasks = {}
                    for (var i = 0; i < level0.length; i++){
                        level0[i]['subtasks'] = []
                        main_tasks[level0[i]['_id']] = level0[i];
                    }
                    // add subtasks in
                    for (var i = 0; i < level1.length; i++){
                        main_tasks[level1[i]['parent_task']]['subtasks'].push(level1[i]);
                    }
                    res.send({'err': false, 'res': main_tasks})
                }
            });
    }
    else if (req.body['event'] == 'retrieve_done_tasks'){
        // get all parent tasks and done tasks
        collection.find({'userid': req.user.userid, $or: [{'done': true}, {'task_level': 0}]}, 
            {sort: {timestamp: -1}}, function(e, docs){
                if (e){
                    console.log('DB ERROR: '+ e) 
                    res.send({'err': true, 'emsg': e});
                }
                else{
                    //seperate level 0 from level 1 tasks
                    level0 = docs.filter(function(d){return d.task_level == 0});
                    level1 = docs.filter(function(d){return d.task_level == 1});
                    //make map of level 0 tasks
                    main_tasks = {}
                    for (var i = 0; i < level0.length; i++){
                        level0[i]['subtasks'] = []
                        main_tasks[level0[i]['_id']] = level0[i];
                     }
                    // add subtasks in
                    for (var i = 0; i < level1.length; i++){
                        main_tasks[level1[i]['parent_task']]['subtasks'].push(level1[i]);
                    }
                    //remove main_tasks that doesn't have subtasks
                    filtered = {}
                    for (key in main_tasks){
                        if (main_tasks[key].done == 1 || main_tasks[key].subtasks.length > 0)
                            filtered[key] = main_tasks[key]
                    }     
                    res.send({'err': false, 'res': filtered})
                }
            });
    }
    else if (req.body['event'] == 'retrieve_task_counts'){
        collection.col.aggregate([
                    {"$match": {'userid': req.user.userid}},
                    {'$group': {'_id': '$done', 'number':{ '$sum' : 1}}},
                ], 
            function(e, docs){
                if (e){
                    console.log(e) 
                    res.send({'err': true, 'emsg': e});
                }
                else{
		    console.log(docs)
                    res.send({'err': false, 'res': docs});
                }
            });
    }
    else if (req.body['event'] == 'add_task'){
        var create_time = parseInt(req.body.time_create);
        var entry = {
            'userid': req.user.userid,
            'time_created': create_time,
            'time_done': 0,
            'task': req.body.task,
            'task_level': parseInt(req.body.level),
            'parent_task': req.body['parent'],
            'done': false,
            'refresh': create_time,
        }
        collection.insert(entry, function(err, doc){
            if (err){
                console.log('DB error: ' + err)
                res.send({'err': true, 'emsg': err})
            }
            else
                res.send({'err': false, 'task': doc})
        });
   
    }
    else if (req.body['event'] == 'remove_item'){
        var taskids = req.body['to_remove[]'];
        var tasks = [];
        if (taskids.constructor === Array){
            for (var i = 0; i<taskids.length; i++){
                tasks.push(new ObjectId(taskids[i]));
            }
        }
        else
            tasks.push(new ObjectId(taskids));
        collection.remove({'_id': {$in: tasks}}, {}, function(err, doc){
            if (err){
                console.log("DB ERROR: "+ err)
                res.send({'err': true, 'emsg': err});
            }
            else
                res.send('success');
        });
 
    }
    else if (req.body['event'] == 'change_status'){
        var taskids = req.body['to_change[]'];
        var time_done = parseInt(req.body['time_done']);
        var done = (req.body.done === 'true');
        var tasks = [];
        if (taskids.constructor === Array){
            for (var i = 0; i<taskids.length; i++){
                tasks.push(new ObjectId(taskids[i]));
            }
        }
        else
            tasks.push(new ObjectId(taskids));
        
        collection.update({'_id':  {$in: tasks}}, {
           $set: {'time_done': time_done, 'done': done}}, 
            {multi: true},
            function(err, docs){
                if (err){
                    console.log('DB ERROR: '+err)
                    res.send('ERROR: '+err);
                }
                else{
                    res.send('success'); 
                }
        });
    }
    else if (req.body['event'] == 'archive_done'){
        var taskids = req.body['to_archive[]'];
        var tasks = [];
        if (taskids.constructor === Array){
            for (var i = 0; i<taskids.length; i++){
                tasks.push(new ObjectId(taskids[i]));
            }
        }
        else
            tasks.push(new ObjectId(taskids));
        //console.log(tasks)
        collection.update({'_id':  {$in: tasks}}, {
            $set: {'done': true}}, 
            {multi: true},
            function(err, docs){
                if (err){
                    console.log('DB ERROR: '+err)
                    res.send('ERROR: '+err);
                }
                else{
                    res.send('success'); 
                }
        });
    }
});

//Ajax call to get annotation data 
router.post('/ajax_annotation', function(req, res){
//    var time1 = new Date().getTime();
    var db = req.db;
    var collection = db.get('log_chrome');
    var timestart = new Date(req.body.time_start);
    var timeend = new Date(req.body.time_end);
    if (req.body['event'] == 'get_log'){
        collection.find({'userid': req.user.userid, 
                'timestamp_bson': {$gte: timestart, $lte: timeend}, 
                 'to_annotate': true, 
                 'removed': false,
            },
            {sort: {timestamp: 1}},
            function(e, docs){
                if (e){
                    console.log('DB ERROR: ' + e);
                    res.send({'err': true, 'emsg': e});
                }
                else{
//                    var time2 = new Date().getTime();
//                    console.log((time2 - time1)/1000)
                    console.log(docs.length)
                    res.send({'err': false, 'res': docs});
                }
        });
    }
    else if (req.body['event'] == 'remove_logitems'){
        var itemids = req.body['items[]'];
        var items = [];
        if (itemids.constructor === Array){
            for (var i = 0; i<itemids.length; i++){
                items.push(new ObjectId(itemids[i]));
            }
        }
        else
            items.push(new ObjectId(itemids));
        collection.update({'_id':  {$in: items}, 'userid': req.user.userid}, {
           $set: {'removed': true}}, 
            {multi: true},
            function(err, docs){
                if (err){
                    console.log('DB ERROR: '+err)
                    res.send({'err': true, 'emsg': e});
                }
                else{
                    res.send('success'); 
                }
        });
    } 
    else if (req.body['event'] == 'submit_labels_useful'){
        collection.update({'_id':  req.body['id'], 'userid': req.user.userid}, {
           $set: {'annotation.useful': req.body.value == 'true'}}, 
            function(err, docs){
                if (err){
                    console.log('DB ERROR: '+err);
                    res.send({'err': true, 'emsg': e});
                }
                else{
                    res.send('success'); 
                }
        });
    }
    else if (req.body['event'] == 'submit_labels_task'){
        var itemids = req.body['items[]'];
        var items = [];
        if (itemids.constructor === Array){
            for (var i = 0; i<itemids.length; i++){
                items.push(new ObjectId(itemids[i]));
            }
        }
        else
            items.push(new ObjectId(itemids));
 
        collection.update({'userid': req.user.userid, '_id':  {$in: items}}, 
            {$set: {'annotation.task.taskid': req.body.taskid,
                    'annotation.task.name': req.body.taskname,
                }}, 
            {multi: true},
            function(err, docs){
                if (err){
                    console.log('DB ERROR: '+err);
                    res.send({'err': true, 'emsg': e});
                }
                else{
                    res.send('success'); 
                }
        });
    }

});


//Ajax call to get annotation options
router.post('/ajax_annotation_options', function(req, res){
    // get db connection
   var db = req.db;
   if (req.body['event'] == 'retrieve_candidate_tasks'){
        var collection = db.get('user_tasks');
        collection.find({'userid': req.user.userid}, 
            {sort: {timestamp: -1}}, function(e, docs){
                if (e){
                    console.log('DB ERROR: '+ e) 
                    res.send({'err': true, 'emsg': e});
                }
                else{
                    //merge subtasks with main-tasks
                    var level0 = docs.filter(function(d){return d.task_level == 0});
                    var level1 = docs.filter(function(d){return d.task_level == 1});
                    //make map of level 0 tasks
                    var main_tasks = {}
                    for (var i = 0; i < level0.length; i++){
                        level0[i]['subtasks'] = []
                        main_tasks[level0[i]['_id']] = level0[i];
                    }
                    // add subtasks in
                    var tasks = [];
                    for (var i = 0; i < level1.length; i++){
                        main_tasks[level1[i]['parent_task']]['subtasks'].push(level1[i]);
                    }
                    res.send({'err': false, 'res': main_tasks});
                }
        });
    }
    else if (req.body['event'] == 'get_dates'){
        //Check timezone, bson uses UTC time
        var timediff = new Date().getTimezoneOffset()*60*1000;
        var collection = db.get('log_chrome');
        collection.col.aggregate([
            {$match: {'userid': req.user.userid, 
                      'to_annotate': true}},
            {$project: {
                'year': {$year: {$subtract: ['$timestamp_bson', timediff]}},
                'day':  {$dayOfYear: {$subtract: ['$timestamp_bson', timediff]}},
                'removed': 1,
                'event': 1,
                'annotation.useful': {$ifNull: ['$annotation.useful', 0]},
                'annotation.task': {$ifNull: ['$annotation.task', 0]},
                }
            },
            {$project: {
                    'year': '$year',
                    'day': '$day',
                    'event': 1,
                    'removed': {$cond: [{$eq: ['$removed', true]}, 1, 0]},
                    'annotation.useful': 1,
                    'annotation.task': 1,
                    'annotation_not_done': {$cond: [
                        {$and: [{$eq: ['$removed', false]},
                            {$or: [{$eq: ['$annotation.task', 0]},
                                {$and: [{$eq: ['$event', 'tab-loaded']}, 
                                        {$eq: ['$annotation.useful', 0]}]} 
                            ]}]}, 1, 0]}
                }
            },
           {$group: {
                    '_id': {year: '$year', day: '$day'},
                    'count_logitem': {$sum: 1},
                    'count_removed': {$sum: '$removed'},
                    'count_to_annotate': {$sum: '$annotation_not_done'}
                }
            },
            {$sort: {'_id': 1}}
        ],
        function(e, docs){
            if (e){
                console.log(e) 
                res.send({'err': true, 'emsg': e});
            }
            else{
    //            console.log(docs);
                if (docs.length == 0)
                    res.send({'err': false, 'res': []});
                else
                    res.send({'err': false, 'res': docs});
            } 
        });
    }
/*
    else if (req.body['event'] == 'get_date_range'){
        var collection = db.get('log_chrome');
        collection.col.aggregate([
                   {$match: {'userid': req.user.userid}},
                   {$group: {'_id': '$userid',  
                             'min': {$min: '$timestamp'},
                             'max': {$max: '$timestamp'}
                            }
                    },
            ],
            function(e, docs){
                if (e){
                    console.log(e) 
                    res.send({'err': true, 'emsg': e});
                }
                else{
                    res.send({'err': false, 'res': docs[0]});
                } 
            });
    }
*/
});

 


//util functions
var alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
String.prototype.shuffle = function(){
    var a = this.split(""),
        n = a.length;

    for(var i = n - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a.join("");
}

module.exports = router;
