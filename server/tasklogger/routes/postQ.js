var express = require('express');
var router = express.Router();
var async = require('async');


/* Get post-questionnaire */
router.get('/', function(req, res, next){
    res.render('post-questionnaire', {});
});

/* submit userid to post questionnaire */
router.post('/ajax_postq', function(req, res){
    var data = JSON.parse(req.body.data);
    if(data.event == 'submit_userid'){
        var User = req.db.get('user');
        async.waterfall([
            //Check if the userid exists
            function(callback){
                User.findOne({'userid': data.userid}, {}, function(err, user){
                    if (!user){
                        return res.send({'err': true, 'emsg': 
                            'Userid does not exists, please check your userid.'});
                    }
                    else{
                        callback(err, user)
                    }
                }); 
            },
            //Check if the post-questionnaire has already started
            //If so, then return the answers so far
            //If not, create new answer session
            function(user, callback){
                //progress = 0, first time visit postQ
                var progress = 0;
                if (user.postQ == undefined){
                    //Create the fields to start a new session
                    User.update({'userid':  user.userid}, {
                        $set: {'postQ': {'progress': 0, 
                                        'tasklist': [], 
                                        'questionnaire': {}}}}, 
                        function(err, doc){
                            if (err){
                                console.log('DB ERROR: '+err)
                                return res.send({'err': true, 'emsg': 'ERROR: '+err});
                                }
                    });
                }
                else{
                    progress = user.postQ.progress; 
                }
                callback(null, user, progress);
            },
            //Based on progress, retrieve different information
            function(user, progress, callback){
                if (progress == 0){
                    //First time visiting postQ, retrieve task list
                    var collection = req.db.get('log_chrome');
                    collection.col.aggregate([
                        {$match: {'userid': user.userid, 
                                'annotation.task': {$exists: true}, 
                                'annotation.task.taskid': {$not: {$in: ['000', '001','002', '003', '004']}}
                                }},
                        {$project: {
                                'userid': 1, 
                                'annotation.task': 1,
                                'timestamp': 1,
                            }},
                        {$group: {
                                '_id': '$annotation.task',
                                'min_time': {$min: '$timestamp'},
                                'max_time': {$max: '$timestamp'},
                                'count': {$sum: 1},
                            }},
                        {$sort: {'count': -1}},
                    ], function(err, docs){
                        for(var i = 0; i < docs.length; i++){
                            docs[i]['chosen'] = false;
                        }
                        callback(err, docs, progress, user)
                    });
                     
                }
                else{
                    //A task selection has been submitted, return this list
                    var tasklist = user.postQ.tasklist;
                    tasklist.sort(function(a, b){ return b.count - a.count});
                    callback(null, tasklist, progress, user);
                }
            },
            //store the tasklist if it's new
            function(tasklist, progress, user, callback){
                if (progress == 0){
                    User = req.db.get('user');
                    User.update({'userid': user.userid}, 
                        {$set: {'postQ.tasklist': tasklist}}, 
                        function(err, doc){
                            callback(err, tasklist)
                        });
                }
                else
                    callback(null, tasklist);
            },
        ], 
        function(err, tasklist){
           if (err)
                res.send({'err': true, 
                    'emsg': 'An error has occurred, please try again.'});
            else{
                res.send({'tasklist': tasklist});
            }
        });
    }
    else if(data.event == 'get_history'){
        var taskid = data.taskid;
        var userid = data.userid;
        collection = req.db.get('log_chrome');
        collection.col.aggregate([
            {$match: {'userid': userid, 
                    'annotation.task.taskid': taskid,
                }}, 
            {$project: {
                    'event': 1, 
                    'url': 1,
                    'query': '$details.query',
                    'title': '$details.current_tab.title',
                }},
            {$project: {
                    'event': 1,
                    'url': 1,
                    'text': {$cond: [{$eq: ['$event', 'tab-loaded']}, '$title', '$query']}
                }},
            {$group: {
                    '_id': {'event': '$event', 'text': '$text'},
                    'urls': {$addToSet: '$url'},
                }},
            {$sort: {'_id': -1}}
        ], function(err, docs){
            if (err){
                res.send({'err': true, 'emsg': err});
            }
            else{
//                console.log(docs);
                res.send({'history': docs});
            }
        });
    }
    else if (data.event == 'submit_tasklist'){
        var userid = data.userid;
        var tasklist = data.tasklist;
        var User = req.db.get('user');
        async.waterfall([
            //Get current user
            function(callback){
                User.findOne({userid: userid}, {}, function(err, user){
                    if(!user){
                        return res.send({'err': true, 'emsg': 'Userid not found, please check.'});
                    }
                    callback(err, user);
                });
            },
            //Given the new tasklist, get the questionnaire
            //Questionnaire storage: 
            //{$taskid: {$qid: answer}}
            //The returned questionnaire format:
            //[{taskid: taskid, taskname: taskname, qa: [{qid:qid, answer: answer}]}]
            function(user, callback){
                var previousQ = user.postQ.questionnaire;
                var newQ = []
                var to_remove = [];
                for(var i = 0; i<tasklist.length; i++){
                    //If the task is not chosen, but have previous record
                    //remove the previous record
                    if (tasklist[i].chosen == false){
                        to_remove.push(tasklist[i]._id.taskid);
                        continue;
                    }
                    var q = {
                        'taskid': tasklist[i]._id.taskid,
                        'name': tasklist[i]._id.name,
                    }
                    var qa = {};
                    var tid = q['taskid'];
                    //If there are already answers in this task, get it
                    if (tid in previousQ){
                            qa = previousQ[tid];
                    }
                    q.qa = qa;
                    newQ.push(q);
                }    
                callback(null, user, to_remove, newQ)
            },
            //Update tasklist and questionnaire
            function(user, to_remove, newQ, callback){
                //handle remove
                var Q = user.postQ.questionnaire;
                for (var i = 0; i < to_remove.length; i++){
                    if (to_remove[i] in Q)
                        delete Q[to_remove[i]]
                }
                User.update({'userid':  userid}, {
                    $set: {'postQ.progress': 1, 
                    'postQ.tasklist': tasklist,
                    'postQ.questionnaire': Q, 
                    }},
                function(err, doc){
                    if (err){
                        console.log('DB ERROR: '+err);
                        return res.send({'err': true, 'emsg': 'ERROR: '+err});
                    }
                    else{
                        callback(null, newQ)
                    }
                });
            },
        ], function(err, docs){
            if (err){
                res.send({'err': true, 'emsg': err});
            }
            else{
                res.send({'q': docs});
            }
        });
    }
    else if (data.event == 'submit_answer'){
        var User = req.db.get('user');
        async.waterfall([
            //First get the user entry
            function(callback){
                User.findOne({'userid': data.userid}, {}, function(err, user){
                    if (!user){
                        return res.send({'err': true, 'emsg': 
                            'Userid does not exists, please check your userid.'});
                    }
                    else{
                        callback(err, user);
                    }
                }); 
            },
            //Set the questionnaire entry
            function(user, callback){
                var Q = user.postQ.questionnaire;
                //Task has some record already
                if (data.taskid in Q){
                    //update/add the answer to this question
                    Q[data.taskid][data.qid] = data.answer;
                }
                else{
                    //create an entry for this question in this task
                    var key = data.qid;
                    Q[data.taskid] = {};
                    Q[data.taskid][key] = data.answer; 
                }
                //Store in DB
                User.update({'userid': user.userid},
                    {$set: {'postQ.questionnaire': Q}}, 
                    function(err, docs){
                        callback(err, docs);
                });
            }
        ], function(err, docs){
            if (err){
                res.send({'err': true, 'emsg': err});
            }
            else{
                res.send('success');
            }
        });
    } 
});

module.exports = router;

