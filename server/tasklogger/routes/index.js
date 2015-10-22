var express = require('express');
var pako = require('pako');
var router = express.Router();
var async = require('async');

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

/* submit userid to post questionnaire */
router.post('/ajax_postq', function(req, res){
    var data = JSON.parse(req.body.data);
    var User = req.db.get('user');
    console.log(data)
    var Q = req.db.get('post_questionnaire');
    if(data.event == 'submit_userid'){
        async.waterfall([
            //Check if the userid exists
            function(callback){
                User.findOne({'userid': data.userid}, {}, function(err, user){
                    if (!user){
                        return res.send({'err': true, 'emsg': 
                            'Userid does not exists, please check your userid.'});
                    }
                }); 
            }
        ], 
        function(err){
           if (err)
                res.send({'err': true, 
                    'emsg': 'An error has occurred, please try again.'});
        });
    }
});

module.exports = router;
