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

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//middlewares for passport
app.use(session({secret: 'soncabaret',
    //to avoid the warning message
    //expires in 2 weeks
    cookie: {maxAge: 360000*24*14},
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


app.use('/', routes);
app.use('/users', users);


//Set up authentication here
//After login all req should have a user object
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

//authentication process
var User = db.get('user');
//User.findOne({email: 'jiyinhe@gmail.com'}, function(e, docs){
//    console.log(docs['pass']);
//});
passport.use(new LocalStrategy(
    function(username, password, done) {
    //process.nextTick(function(){
        User.findOne({ email: username }, function (err, user) {
            if (err) {
                console.log(err);
                return done(null, false, {message: 'A database error occurred, please try again later.'}); }
            if (!user) {
                return done(null, false, {message:'Email not found.'});
            }
            else if (password != user['pass']) {
                return done(null, false, {message: 'Incorrect password.'});
            }
            return done(null, user);
        });
  //});
  }
));


//login request
app.post('/users/login',
    passport.authenticate('local', {
        successRedirect: '/users/annotation',
        failureRedirect: '/users/login',
        failureFlash: true,
    })
);

app.get('/loginFailure', function(req, res, next) {
  res.send('Failed to authenticate');
});

app.get('/loginSuccess', function(req, res, next) {
  console.log(req)
  res.send('Successfully authenticated');
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
