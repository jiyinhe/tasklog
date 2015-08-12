var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  //res.send('respond with a resource');
    res.redirect('/users/login');
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
    //console.log(req.user)
    res.render('dashboard', {
        "user": req.user
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
