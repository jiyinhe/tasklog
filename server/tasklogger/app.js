var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session)
var flash = require('connect-flash')
var pako = require('pako')
var bcrypt = require('bcrypt-nodejs');
var async = require('async');
var crypto = require('crypto');
var nodemailer = require('nodemailer');

//Add variables for db connection
var dbname = "db_tasklog";
var host = "localhost";
var port = "27017";
//var host = "localhost:27017";
var mongo = require('mongodb');
var monk = require('monk');
var db = monk(host + ":"+ port + '/' +dbname, {w: 1, journal: true, fsync: true});

// Add variables for passport authentication
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var routes = require('./routes/index');
var users = require('./routes/users');
var admin = require('./routes/admin'); 

var app = express();
//allow getting user IP
app.enable('trust proxy');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({limit: '5mb', extended: true}));

//app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
//Not using static files in session 
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', routes);


/* process data posting request from chrome */
app.post('/savedata', function(req, res){
//    console.log(req)
//    console.log('savedata')
     
    // get db connection
    //var db = req.db;
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

app.post('/saveserp', function(req, res){
//    console.log('saveserp')
  //  var db = req.db;
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




//middlewares for passport
app.use(session({secret: 'soncabaret',
    cookie: {
	//try to add path to fix the req.session.user undefined issue
        path: '/',
	maxAge: 360000*24},
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({
        db: dbname,
    }),

}));


app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//Add db to every request
app.use(function(req, res, next){
    req.db = db;
    //update cookie
    req.session._garbage = Date();
    req.session.touch();
    next();
});


//app.use('/', routes);
app.use('/users', users);
app.use('/admin', admin);

var User = db.get('user');


//Set up authentication here
//After login all req should have a user object
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

//authentication process
//User.findOne({email: 'jiyinhe@gmail.com'}, function(e, docs){
//    console.log(docs['pass']);
//});
passport.use(new LocalStrategy(
    function(username, password, done) {
    process.nextTick(function(){
        User.findOne({ email: username }, function (err, user) {
            if (err) {
                console.log(err);
                return done(null, false, {message: 'A database error occurred, please try again later.'}); }
            if (!user) {
                return done(null, false, {message:'Email not found.'});
            }
            //else if (password != user['pass']) {
            else if (!bcrypt.compareSync(password, user['pass'])){
                return done(null, false, {message: 'Incorrect password.'});
            }
            else{
            	return done(null, user);
            }		
        });
  });
  }
));


//login request
app.post('/users/login',
    passport.authenticate('local', {
        //successRedirect: '/users/annotation',
        failureRedirect: '/users/login',
        failureFlash: true,
    }), 
    function(req, res){
//	console.log('login success', req.user)
//	console.log('login success', req.session.passport)
	//Add to passport as sometimes it doesn't update this info
//	console.log(req.session)
//	req.session.passport = {'user': req.user}
//        req.session.user = req.user;
//	console.log(req.session)
//	req.session.user = req.user;
//	req.session.save(function(){ 
	res.redirect('/users/annotation');
//	});
    }
);

app.get('/loginFailure', function(req, res, next) {
  res.send('Failed to authenticate');
});

app.get('/loginSuccess', function(req, res, next) {
  //console.log(req)
  res.send('Successfully authenticated');
});


//Logout
app.get('/logout', function(req, res){
    req.logout();
//    console.log('logout req', req.user)
    console.log('logout session',req.session.passport)
    //Manually remove the session from mangodb
    //passport logout does not clear the session somehow
    req.session.destroy(function(){ 
        res.redirect('/users/login');
    }); 
});


//Reset password request
app.get('/forgotpassword', function(req, res, next){
    var messages = req.flash();
    if ('info' in messages || 'error' in messages || 'success' in messages){
        res.render('forgotpassword', {'messages': messages});
    }
    else {
        res.render('forgotpassword', {'messages': 
            {info: 'To reset your password, please enter the email you used to create your user account:'}});
    }

});

//process reset request
app.post('/forgotpassword', function(req, res, next) {
    var db = req.db;
    var collection = db.get('user');

    async.waterfall([
        //Generate verification token
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
        },
        //Check account
        function(token, done) {
            if (req.body.email == '')
                return res.redirect('/forgotpassword');

            User.findOne({ email: req.body.email }, function(err, user) {
                if (!user) {
                    req.flash('error', 'No account with email address ' +
                        req.body.email + ' exists.');
                    return res.redirect('/forgotpassword');
                }
                //If account exists, set token and expire time
                collection.update({'_id':  user._id}, {
                    $set: {'resetPasswordToken': token, 
                            'resetPasswordExpires': Date.now() + 360000*24}}, //24 hours
                    function(err, docs){
                        done(err, token, user);
                    });
            });
        },
        //send email 
        function(token, user, done) {
            var smtpTransport = nodemailer.createTransport('SMTP', {
                //host: 'smtp.cs.ucl.ac.uk',
                service: 'Gmail', 
		        auth: {
        		    user: "research.mediafutures.ucl@gmail.com",
        		    pass: "research4fun"
		        }
            });
            var mailOptions = {
                to: user.email,
                from: 'Research Mediafutures UCL',
                subject: 'Participant account password reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                  'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                  'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                  'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                console.log(err)
                req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function(err) {
        if (err) return next(err);
        res.redirect('/forgotpassword');
    });
});

app.get('/resetpassword_expire', function(req, res){
    res.render('resetpassword_expire', {user: req.user});    
});

app.get('/resetpassword_success', function(req, res){
    res.render('resetpassword_success', {user: req.user});    
});


//Reset password form following reset link
app.get('/reset/:token', function(req, res) {
    User.findOne({ resetPasswordToken: req.params.token, 
        resetPasswordExpires: { $gt: Date.now() } }, 
        function(err, user) {
            if (!user) {
                console.log(Date.now())
                return res.redirect('/resetpassword_expire')
            }
            //Otherwise, render the page
            var messages = req.flash();
            res.render('resetpassword', {
                user: req.user, 
                messages: messages,
            });
        });
});

//Process resetting password
app.post('/reset/:token', function(req, res){
    //Check if the user token and expire is correct
    User.findOne({ resetPasswordToken: req.params.token, 
        resetPasswordExpires: { $gt: Date.now() } }, 
        function(err, user) {
            if (!user) {
                console.log('here', Date.now());
                res.redirect('/resetpassword_expire') 
            } 

            //If all correct, update the password
            var pass1 = req.body.pass1;
            var pass2 = req.body.pass2;
            if (pass1 !== pass2){
                req.flash('error', 'Inconsistent new password and confirmation of password.');
                res.redirect('/reset/' + req.params.token)
            }
            else if (pass1 == ''){
                req.flash('error', 'New password should not be empty.');
                res.redirect('/reset/' + req.params.token)
            }
            else{
                //save the new password
                var db = req.db;
                var collection = db.get('user');
                var newpass = bcrypt.hashSync(pass1);

                collection.update({'resetPasswordToken':  req.params.token}, {
                    $set: {'resetPasswordToken': undefined, 
                            'resetPasswordExpires': undefined,
                            'pass': newpass}},
                    function(err, docs){
                        if (err){
                            req.flash('error', err);
                            res.redirect('/reset/' + req.params.token);
                        }    
                        else{
                            res.redirect('/resetpassword_success')
                        }           
                    });
            }
            
        });
});

//For downloading the chrome logger
app.get('/download_chromelogger', function(req, res){
    var filename = __dirname + '/public/chrome-logger.zip';
    res.download(filename);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
