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

module.exports = router;
