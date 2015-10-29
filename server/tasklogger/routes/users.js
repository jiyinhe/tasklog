var express = require('express');
var bcrypt = require('bcrypt-nodejs');
var async = require('async');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;
var nodemailer = require('nodemailer');


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
    console.log('login get', req.session.passport);
    //console.log('get login', req.user)
    //console.log(err)
    if (err['error'] === undefined ){
        res.render('login', {});
    }
    else {
        res.render('login', {'err': "Login faild: " + err['error']});
    }
});

/*
router.post('/login', function(req, res){
    var username= req.body.username;
    var password = bcrypt.hashSync(req.body.password);
    User = req.db.get('user');	

    User.findOne({ email: username }, function (err, user) {
            if (err) {
                console.log(err);
                req.flash('A database error occured, please try again later'); 
	        res.redirect('/users/login');
            }
            else {	
            if (!user) {
                req.flash('Email not found');
                res.redirect('/users/login');
            }
            //else if (password != user['pass']) {
            else if (!bcrypt.compareSync(password, user['pass'])){
                req.flash('Incorrect password');
                res.redirect('/users/login');
            }
            else{
                console.log('success')
                req.user = user;
                req.session.user = user;
                res.redirect('/users/annotation');
            }		
           }
    });  
});
*/

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
                    send_registration_email(data.user, data.email, token);
                    res.send({
                        'err': false,
                        'userid': token,
                        'name': data.user,
                        'email': data.email,
                        'pass': data.pass
                    });
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
//    console.log('get_annotation', req.user)
//     console.log('annotationn', req.session.passport)
    if (req.user===undefined){
        res.redirect('/users/login');
    }
    else {
        //console.log(req.user)
        res.render('annotation', {
            "user": req.user,
            "annotationclass": "active",
            "title": "Tasklog - My annotations",
        });
    }
});


/* Account information page */
/*
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
*/


/* ajax for todo list (tasks) */
router.post('/ajax_tasks', function(req, res){
    var body = JSON.parse(req.body.data)
    // get db connection
    var db = req.db;
    //set the collection
    var collection = db.get('user_tasks');
    if (body['event'] == 'retrieve_tasks'){
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
    else if (body['event'] == 'retrieve_done_tasks'){
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
    else if (body['event'] == 'retrieve_task_counts'){
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
		            //console.log(docs)
                    res.send({'err': false, 'res': docs});
                }
            });
    }
    else if (body['event'] == 'add_task'){
        var create_time = parseInt(body.time_create);
        var entry = {
            'userid': req.user.userid,
            'time_created': create_time,
            'time_done': 0,
            'task': body.task,
            'task_level': parseInt(body.level),
            'parent_task': body['parent'],
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
    else if (body['event'] == 'change_status'){
        var taskids = body['to_change'];
        var time_done = body['time_done'];
        var done = body.done;
        var tasks = [];

        for (var i = 0; i<taskids.length; i++){
            tasks.push(new ObjectId(taskids[i]));
        }
        collection.update({'_id':  {$in: tasks}}, {
           $set: {'time_done': time_done, 'done': done}}, 
            {multi: true},
            function(err, docs){
                if (err){
                    console.log('DB ERROR: '+err)
                    res.send({'err': true, 'emsg': 'ERROR: '+err});
                }
                else{
                    res.send('success'); 
                }
        });
    }
    else if (body['event'] == 'remove_item'){
        //console.log(body.to_remove)
        async.waterfall([
                //remove subtasks
                function(callback) {
                    var taskids = body.to_remove.sub;
                    var tasks = [];
                    for (var i = 0; i<taskids.length; i++){
                        tasks.push(new ObjectId(taskids[i]));
                    }
                    collection.remove({'_id': {$in: tasks}}, {}, function(err, doc){
                        callback(err);
                    });
                }, 
                //check if main task should be removed
                function(callback) {
                    if (body.to_remove.main == ''){
                        return callback(null, 0);
                    }
                    else{
                        collection.col.aggregate([
                            {"$match": {'parent_task': body.to_remove.main}},
                            {'$group': {'_id': '$parent_task', 'number':{ '$sum' : 1}}},
                            ], 
                        function(err, doc){
                            //console.log(doc)
                            var number = 0
                            if (doc.length > 0)
                                number = doc[0].number;
                            callback(err, number)     
                        });
                    }
                },
                //remove main task
                function(remain_subs, callback){
//                    console.log(remain_subs)
                    //It should not be removed
                    if (remain_subs > 0){
                        //It still has subtasks in the "done" area
                        //But no subtasks in the "todo" area
                        //It should be then set to "done"
                        collection.update({'_id': body.to_remove.main}, 
                            {$set: {'done': true, 'time_done': (new Date()).getTime()}}, 
                            function(err, doc){
                                return callback(err);
                            });
                    }
                    //It can be removed
                    else
                        collection.remove({'_id': body.to_remove.main}, {}, 
                        function(err, doc){
                            callback(err);
                        });
                }
            ], 
            function(err){
               if (err){
                    console.log('DB ERROR: '+err)
                    res.send({'err': true, 'emsg': err});
                }
                else{
                    res.send('success'); 
                }
        });
    }
    else if (body['event'] == 'archive_done'){
        var taskids = body['to_archive'];
        var tasks = [];
        for (var i = 0; i<taskids.length; i++){
            tasks.push(new ObjectId(taskids[i]));
        }
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

    var body = JSON.parse(req.body.data);
    var timestart = new Date(body.time_start);
    var timeend = new Date(body.time_end);

    //console.log(body)
    if (body['event'] == 'get_log'){
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
                    //console.log(docs[0].timestamp_bson, docs[docs.length-1].timestamp_bson)
                    res.send({'err': false, 'res': docs});
                }
        });
    }
    else if (body['event'] == 'remove_logitems'){
        var itemids = body['items'];
        var items = [];
        for (var i = 0; i<itemids.length; i++){
           items.push(new ObjectId(itemids[i]));
        }

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
    //Skip usefulness labeling: not used
    else if (body['event'] == 'submit_labels_useful'){
        var useful_value = body.value;
        var ids = body['ids'];
        var items = [];
        for(var i = 0; i < ids.length; i++){
            items.push(new ObjectId(ids[i]));
        }
        collection.update({'_id':  {$in: items}, 'userid': req.user.userid}, {
           $set: {'annotation.useful': useful_value}}, 
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
    else if (body['event'] == 'submit_labels_task'){
        var itemids = body['items'];
        var items = [];
        for (var i = 0; i<itemids.length; i++){
            items.push(new ObjectId(itemids[i]));
        }
 
        collection.update({'userid': req.user.userid, '_id':  {$in: items}}, 
            {$set: {'annotation.task.taskid': body.taskid,
                    'annotation.task.name': body.taskname,
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
   var body = JSON.parse(req.body.data);
//   console.log(body)
   if (body['event'] == 'retrieve_candidate_tasks'){
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
    else if (body['event'] == 'get_dates'){
        //Check timezone, bson uses UTC time
        var timediff = new Date().getTimezoneOffset()*60*1000;

        var collection = db.get('log_chrome');
        collection.col.aggregate([
            {$match: {'userid': req.user.userid, 
                      'to_annotate': true},
                },
            {$project: {
                'adjusted_time':  {$subtract: ['$timestamp_bson', timediff]},
                'removed': 1,
                'event': 1,
                //Skip usefulness labeling - not consider useful for compeleting
                //labling
                //'annotation.useful': {$ifNull: ['$annotation.useful', 0]},
                'annotation.task': {$ifNull: ['$annotation.task', 0]},
                'timestamp_bson': 1
                }
            },
            {$project: {
                    'year': {$year: '$adjusted_time'},
                    'day': {$dayOfYear: '$adjusted_time'},
                    'adjusted_time': 1,
                    'timestamp_bson': 1,
                    'event': 1,
                    'removed': {$cond: [{$eq: ['$removed', true]}, 1, 0]},
                    //'annotation.useful': 1,
                    'annotation.task': 1,
                    'annotation_not_done': {$cond: [
                        {$and: [{$eq: ['$removed', false]},
                            //Skip the usefulness labeling
                            //as long as task is labeled, considered as done
                            //{$or: [{$eq: ['$annotation.task', 0]},
                            //    {$and: [{$eq: ['$event', 'tab-loaded']}, 
                            //            {$eq: ['$annotation.useful', 0]}]} 
                            //]}
                            {$eq: ['$annotation.task', 0]},
                            ]}, 1, 0]}
                }
            },
           {$group: {
                    '_id': {year: '$year', day: '$day'},
                    'count_logitem': {$sum: 1},
                    'count_removed': {$sum: '$removed'},
                    'count_to_annotate': {$sum: '$annotation_not_done'},
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
        //        console.log(docs);
                if (docs.length == 0)
                    res.send({'err': false, 'res': []});
                else
                    res.send({'err': false, 'res': docs});
            } 
        });
    }
});

//Request for view user stats
router.get('/stats', function(req, res, next){
    if (req.user===undefined){
        res.redirect('/users/login');
    }
    else {
        res.render('stats', {
            "user": req.user,
            "statsclass": "active",
            "title": "Tasklog - My stats",
        });
    }
});

//Request for getting stats data
router.post('/get_stats_data', function(req, res){
    var e = req.body.event;
    var db = req.db;
    var collection = db.get('log_chrome');
    var timediff = new Date().getTimezoneOffset()*60*1000;
 
    if (e == 'per_hour_activities'){
        //Get search and browsing counts group by hour of the day
        collection.col.aggregate([
                {'$match': {'userid': req.user.userid,
                    'to_annotate': true, 
                    'removed': false}},
                {$project: {
                    'year': {$year: {$subtract: ['$timestamp_bson', timediff]}},
                    'day':  {$dayOfYear: {$subtract: ['$timestamp_bson', timediff]}},
                    'hour': {$hour: {$subtract: ['$timestamp_bson', timediff]}},
                    'event': 1,
                    }
                },
                {$group: {
                    '_id': {hour: '$hour', event: '$event', year: '$year', day: '$day'},
                    'count': {$sum: 1},
                    }
                },
                {$sort: {'_id': 1}}
            ],
            function(e, docs){
                if (e){
                    console.log(e);
                    res.send({'err': true, 'emsg': e});
                }
                else{
//                    console.log(docs)
                    res.send({'err': false, 'data': docs});
                }            
            });
    }
    else if (e == 'per_day_activities'){
        collection.col.aggregate([
                {'$match': {'userid': req.user.userid,
                    'to_annotate': true, 
                    'removed': false}},
                {$project: {
                    'day':  {$dayOfWeek: {$subtract: ['$timestamp_bson', timediff]}},
                    'event': 1,
                    }
                },
                {$group: {
                    '_id': { event: '$event', day: '$day'},
                    'count': {$sum: 1},
                    }
                },
                {$sort: {'_id': 1}}
            ],
            function(e, docs){
                if (e){
                    console.log(e);
                    res.send({'err': true, 'emsg': e});
                }
                else{
//                    console.log(docs)
                    res.send({'err': false, 'data': docs});
                }            
            }); 
    }
    else if (e == 'per_hour_tasks'){
        collection.col.aggregate([
                {'$match': {'userid': req.user.userid,
                    'to_annotate': true, 
                    'removed': false,
                    'annotation.task': {$exists: true},
                    }
                },
                {$project: {
                    'hour': {$hour: {$subtract: ['$timestamp_bson', timediff]}},
                    'task': '$annotation.task.name',
                    }
                },
                {$group: {
                    '_id': { hour: '$hour', task: '$task'},
                    'count': {$sum: 1},
                    }
                },
                {$sort: {'_id': 1}}
            ],
            function(e, docs){
                if (e){
                    console.log(e);
                    res.send({'err': true, 'emsg': e});
                }
                else{
//                    console.log(docs)
                    res.send({'err': false, 'data': docs});
                }            
            });
    }
    else if (e == 'per_day_tasks'){
        collection.col.aggregate([
                {'$match': {'userid': req.user.userid,
                    'to_annotate': true, 
                    'removed': false,
                    'annotation.task': {$exists: true},
                    }
                },
                {$project: {
                    'day': {$dayOfWeek: {$subtract: ['$timestamp_bson', timediff]}},
                    'task': '$annotation.task.name',
                    }
                },
                {$group: {
                    '_id': { day: '$day', task: '$task'},
                    'count': {$sum: 1},
                    }
                },
                {$sort: {'_id': 1}}
            ],
            function(e, docs){
                if (e){
                    console.log(e);
                    res.send({'err': true, 'emsg': e});
                }
                else{
//                    console.log(docs)
                    res.send({'err': false, 'data': docs});
                }            
            });
    }
    else if (e == 'task_distribution'){
        collection.col.aggregate([
                {'$match': {'userid': req.user.userid,
                    'to_annotate': true, 
                    'removed': false,
                    'annotation.task': {$exists: true},
                    }
                },
                {$project: {
                    'task': '$annotation.task.name',
                    }
                },
                {$group: {
                    '_id': { task: '$task'},
                    'count': {$sum: 1},
                    }
                },
                {$sort: {'_id': 1}}
            ],
            function(e, docs){
                if (e){
                    console.log(e);
                    res.send({'err': true, 'emsg': e});
                }
                else{
//                    console.log(docs)
                    res.send({'err': false, 'data': docs});
                }            
            });
    }

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

function send_registration_email(username, useremail, userid){
    var smtpTransport = nodemailer.createTransport('SMTP', {
        //host: 'smtp.cs.ucl.ac.uk',
        service: 'Gmail', 
	    auth: {
    		    user: "research.mediafutures.ucl@gmail.com",
       		    pass: "research4fun"
	        }
        });
        var mailOptions = {
            to: useremail,
            from: 'Research Mediafutures UCL',
            subject: 'Thank you for registering with our study',
            text: 'Dear ' + username + ',\n\n' +
            'You have registered as a participant of our computer and search activity study. Welcome!\n\n' +
            'Your unique userid is: ' + userid + '\n\n' + 
            'In the following 5 days, your tasks are: \n\n' + 
            ' - Use Google chrome as your Web browser; \n' + 
            ' - Keep the chrome search activity logger running;\n' + 
            ' - Keep the application logger running; \n' + 
            ' - Work on at least 5 information goals; \n' + 
            ' - Review and perform a light weight annotation of your search and browsing history every day. \n\n' + 
            'To review and annotate your search history, please login at http://tasklog.cs.ucl.ac.uk/users/login \n\n' + 
            'If you have any questions or problems during the experiment period, please do not hesitate to contact us with this email address. \n\n' + 
            'Kind regards, \n' + 
            'Jiyin He and Tim Cowlishaw \n'  
        };
        smtpTransport.sendMail(mailOptions, function(err) {
            if (err)
                console.log(err)
        });
}

module.exports = router;
