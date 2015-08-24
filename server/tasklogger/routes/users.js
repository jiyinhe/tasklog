var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  //res.send('respond with a resource');
    if (req.user===undefined){
        res.redirect('/users/login');
    }
    else 
        res.redirect('/users/dashboard');
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
    collection.find({email: req.body.email}, {}, function(e, docs){
        if (docs.length == 0){
            var token = alphanumeric.shuffle().substring(0, 6);
            //store the user info
            collection.insert({
                'userid': token,
                'name': req.body.user,
                'email': req.body.email,
                'pass': req.body.pass,
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
                        'name': req.body.user,
                        'email': req.body.email,
                        'pass': req.body.pass
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


/* To-do page */
router.get('/mytodo', function(req, res, next) {
    if (req.user===undefined){
        res.redirect('/users/login');
    }
    //Get all tasks
    var collection = req.db.get('user_tasks');
    //first get all the parents
    collection.find({'userid': req.user.userid, 'task_level': 0}, 
        {sort: {timestamp: 1}}, function(e, docs){
        var tasks_today = [];
        var tasks_past = [];
        var today = (new Date()).setHours(0,0,0,0);

        var parents = {}
        for (var i = 0; i<docs.length; i++){
            var task_status = '';
            if (docs[i].done)
                task_status = 'task-done';
            var d = {'taskid': docs[i]['_id'],
                    'task': docs[i]['task'],
                    'subtasks': [],
                    'refresh': docs[i]['refresh'],
                    'status': task_status,
                }
            parents[d.taskid] = d;
        }
        collection.find({'userid': req.user.userid, 'task_level': 1}, 
            {sort:{timestamp: 1}}, function(e, docs){
                for(var i = 0; i<docs.length; i++){
                    var task_status = '';
                    if (docs[i].done)
                        task_status = 'task-done';
 
                    var d = {'taskid': docs[i]['_id'], 
                            'task': docs[i]['task'],
                            'task': task_status,
                        };
                    parents[docs[i]['parent_task']].subtasks.push(d);
                }
            //seperate today's task and past tasks
            for (var key in parents){
                if (parents[key]['refresh'] > today)
                   tasks_today.push(parents[key]);
                else
                   tasks_past.push(parents[key]);
            }
            tasks_today.sort(function(a, b){return  a.refresh - b.refresh;});
            tasks_past.sort(function(a, b){return  a.refresh - b.refresh;});

            res.render('todo', {
                "user": req.user,
                "todoclass": "active",
                "title": "Tasklog - My todo list",
                "tasks_today": tasks_today,
                "tasks_past": tasks_past,
            });
        });  
    }); 
});

router.post('/submit_todo', function(req, res){
    var collection = req.db.get('user_tasks');
    if (req.body.event == 'add_task'){
        //refresh: when add a past task to today, 
        //refresh is set to today while create_time is not changed
        var create_time = parseInt(req.body.create_time);
        var entry = {
            'userid': req.user.userid,
            'time_created': create_time,
            'time_done': 0,
            'task': req.body.task,
            'task_level': 0,
            'parent_task': 0,
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
    else if (req.body.event == 'task_status_change'){
        console.log('here');
        if (req.body.is_main_task)
            console.log('main-task')
        //if a task is done, all its unfinished subtasks are done
        
        //if a tasks is undone, all the subtasks that were done at the
        // same time are undone 
        // if a subtask is done, only change its own status
        // if a subtask is undone, its parent becomes undone
 
    }
});

/* Annotation page */
router.get('/annotation', function(req, res, next) {
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
 
    //console.log(req.user)
    res.render('account', {
        "user": req.user,
        "accountclass": "active",
        "title": "Tasklog - My account", 
    });
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
