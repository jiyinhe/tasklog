var express = require('express');
var bcrypt = require('bcrypt-nodejs');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;

/* GET admin listing. */
router.get('/', function(req, res, next) {
    //console.log(req.session)
    if (req.session.admin===undefined){
        res.redirect('/admin/login');
    }
    else
        res.redirect('/admin/listing');
});

/* Admin login */
router.get('/login', function(req, res, next) {
    if (req.session.admin===undefined){
        res.render('admin/admin_login', {'err': req.flash('err')});
    }
    else
        res.redirect('/admin/listing');
});

/* Login request */
router.post('/login', function(req, res){
    var User = req.db.get('user'); 
    var uesrname = 'Admin';
    var password = req.body.password;
    User.findOne({'name': 'Admin', 'role': 'admin'}, {}, 
        function(err, user){
            if (!user){
                req.flash('err', 'Something is wrong: Admin not found');
                res.redirect('/admin/login');
            }
            else {
                if (!bcrypt.compareSync(password, user['pass'])){
                    req.flash('err', 'Password incorrect');
                    res.redirect('/admin/login');
                }
                else{ 
                    req.session.admin = user;
                    res.redirect('/admin/listing');
                }
            }  
        });

});

/* Logout the admin */
router.get('/logout', function(req, res, next){
    req.session.destroy(function(){
        res.redirect('/admin/login');
    });
});

/* Get admin listing */
router.get('/listing', function(req, res, next){
//    console.log(req.session.admin)
    if (req.session.admin === undefined)
        res.redirect('/admin/login');
    else{
        var timediff = new Date().getTimezoneOffset()*60*1000;
        collection = req.db.get('log_chrome');
        collection.col.aggregate([
            //Filter out working on tasklog
            {$match: {
                    'url': {$not: /tasklog.cs.ucl.ac.uk/}
                }
            },
            {$project: {
                'userid': 1,
                'year': {$year: {$subtract: ['$timestamp_bson', timediff]}},
                'day':  {$dayOfYear: {$subtract: ['$timestamp_bson', timediff]}},
                'removed': 1,
                'event': 1,
                'to_annotate': 1,
                'annotation.useful': {$ifNull: ['$annotation.useful', 0]},
                'annotation.task': {$ifNull: ['$annotation.task', 0]},
                }
            },
            
            {$project: {
                    'userid': 1,
                    'year': '$year',
                    'day': '$day',
                    'event': 1,
                    'query': {$cond: [{$eq: ['$event', 'tab-search']}, 1, 0]},
                    'pageview': {$cond: [
                            {$and: [
                                {$eq: ['$event', 'tab-loaded']}, 
                                {$eq: ['$to_annotate', true]}
                                ]}
                            , 1, 0]},
                    'to_annotate': {$cond: [{$eq: ['$to_annotate', true]}, 1, 0]}, 
                    'removed': {$cond: [{$eq: ['$removed', true]}, 1, 0]},
                    //'annotation.useful': 1,
                    //'annotation.task': 1,
                    'annotation_not_done': {$cond: [
                        {$and: [{$eq: ['$removed', false]}, 
                                {$eq: ['$to_annotate', true]},
                            {$or: [{$eq: ['$annotation.task', 0]},
                                {$and: [{$eq: ['$event', 'tab-loaded']}, 
                                        {$eq: ['$annotation.useful', 0]}]} 
                            ]}]}, 1, 0]}
                }
            },
           {$group: {
                    '_id': {user: '$userid', year: '$year', day: '$day'},
                    'count_total_actions': {$sum: 1},
                    'count_queries': {$sum: '$query'},
                    'count_pageviews': {$sum: '$pageview'},
                    'count_should_annotate': {$sum: '$to_annotate'},
                    'count_removed': {$sum: '$removed'},
                    'count_annotation_notdone': {$sum: '$annotation_not_done'},
                }
            },
            {$sort: {'_id': 1}}
        ], function(err, docs){
            if (err){
                res.render('admin/admin_listing', 
                {'user': req.session.admin, 'title': 'Tasklog-admin',
                    'err': err,
                });
            }          
            else{
                var data = []
                if (docs.length > 0){
                    data = format_listing(docs);
                }   
                //console.log(data)
                res.render('admin/admin_listing', 
                    {'user': req.session.admin, 'title': 'Tasklog-admin',
                        'data': data,
                    });
            }
        });

    }
});

function format_listing(docs){
    var data = [];
    docs.sort(function(a, b){
        if (a._id.user < b._id.user) return -1;
        else if(a._id.user > b._id.user) return 1;
        else return 0
    });

    var current_user = docs[0]._id.user;
    var userinfo = [];
    for( var i = 0; i<docs.length; i++){
        //Change user, save info for current user
        if (docs[i]._id.user != current_user){
            userinfo.sort(function(a, b){ if(a.date < b.date) return -1;
                else if(a.date > b.date) return 1;
                return 0;
            });
            data.push({'user': current_user, 'userinfo': userinfo,
                'rowspan': userinfo.length});
            userinfo = [];
            current_user = docs[i]._id.user;                     
        }
        //Add date info to current user
        var date = new Date(docs[i]._id.year, 0);
        date.setDate(docs[i]._id.day);
        var done_annotate = (docs[i].count_should_annotate 
             - docs[i].count_removed - docs[i].count_annotation_notdone);
        var perc_removed = 0, perc_todo = 0, perc_done = 0;
        if (docs[i].count_should_annotate > 0){
            perc_removed = Math.round(docs[i].count_removed*100/docs[i].count_should_annotate);
            perc_todo = Math.round(docs[i].count_annotation_notdone*100/docs[i].count_should_annotate);
            perc_done = Math.round(done_annotate*100/docs[i].count_should_annotate);
        }
        //console.log(perc_removed, perc_todo, perc_done)
        userinfo.push({
            'user': current_user,
            'date': date,
            'item_id': current_user+'_' + docs[i]._id.year + '_' + docs[i]._id.day,
            'date_string': date.toDateString(),
            'count_actions': docs[i].count_total_actions,
            'count_queries': docs[i].count_queries,
            'count_pageviews': docs[i].count_pageviews,
            'count_should_annotate': docs[i].count_should_annotate,
            'count_done_annotate': done_annotate,
            'count_todo_annotate': docs[i].count_annotation_notdone,
            'count_removed': docs[i].count_removed,
            'perc_removed': 'width:' + perc_removed + '%',
            'perc_todo': 'width: '+ perc_todo + '%',
            'perc_done': 'width:' + perc_done + '%',
        });
    }
    userinfo.sort(function(a, b){ if(a.date < b.date) return -1;
        else if(a.date > b.date) return 1;
        return 0;
    });
 
    data.push({'user': current_user, 'userinfo': userinfo});
    return data
}


/* Get view log request */
router.get('/logview', function(req, res, next){
    if (req.query.loginfo === undefined){
        res.render('admin/admin_logview', {
            user: req.session.admin,
            title: 'Tasklog - viewlog',
            err: 'Incorrect query parameters' 
        })
        return   
    }
    var loginfo = req.query.loginfo.split('_');
    var userid = loginfo[0], year = loginfo[1], day = loginfo[2];
    //Get log
    var timediff = new Date().getTimezoneOffset()*60*1000; 
    //Date in local time
    var dateStart = new Date(year);
    dateStart.setDate(day); 
    dateStart.setHours(0, 0, 0);
    var dateEnd = new Date(year);
    dateEnd.setDate(day); 
    dateEnd.setHours(23, 59, 59, 999);

    var collection = req.db.get('log_chrome');
    collection.col.aggregate([
            {$match: {
                'userid': userid, 
                //Filter out working on tasklog
                'url': {$not: /tasklog.cs.ucl.ac.uk/},
                'timestamp_bson': {
                        $gte: dateStart, 
                        $lte: dateEnd, 
                    } 
                }},
            {$project: {
                'userid': 1,
                'url': 1,
                'to_annotate': 1,
                'event': 1,
                'removed': 1,
                'title': {$ifNull: ['$details.current_tab.title', '']},
                'query': {$ifNull: ['$details.query', '']},
                'engine': {$ifNull: ['$details.engine', '']},
                'annotation.useful': {$ifNull: ['$annotation.useful', '']},
                'annotation.task': {$ifNull: ['$annotation.task', '']},
                'link_data': {$ifNull: ['$details.link_data', '']},
                'form_data': {$ifNull: ['$details.form_data', '']},
                'timestamp_bson': 1,
                'timestamp': 1,
                },
            }, 

        ], function(e, docs){
        if (e){
            res.render('admin/admin_logview', {
                user: req.session.admin,
                title: 'Tasklog - viewlog',
                err: 'An error occured: ' + e
            })
        }
        else{
            var data = format_logview(docs)
            //console.log(data)
            res.render('admin/admin_logview', {
                user: req.session.admin,
                title: 'Tasklog - viewlog',
                data: data,
            })
        }

    });

});

function format_logview(docs){
    var data = [];
    for(var i = 0; i<docs.length; i++){
        var rowclass ='';
        var annotation = [];
        var has_serp = false;
        var serp_id = ''; 
        if (docs[i].to_annotate){
            rowclass='info';
            if (docs[i].annotation.task !== undefined && docs[i].annotation.task!='')
                annotation.push('Task: ' + docs[i].annotation.task.name);
            if (docs[i].annotation.useful !== undefined && docs[i].annotation.useful!='')
                annotation.push('Useful: ' + docs[i].annotation.useful);
        } 
        var url = docs[i].url, title=docs[i].title, e = docs[i].event;
       if (title == '')
            title = url;
        var details = [];
        if (e == 'tab-search'){
            details.push('Query: ' + docs[i].query);
            details.push('Engine: ' + docs[i].engine);
        }
        else if (e == 'tab-loaded'){
            var se = check_searchEngine(url);
            console.log(se)
            if (se.search){
                details.push('Query: ' + se.query);
                details.push('Engine: ' + se.se);
                details.push('Media:' + se.media);
                details.push('Result start count:' + se.start_count);
                has_serp = true;
                serp_id = docs[i].userid + '_' + docs[i].timestamp
            }
        }
        else if (e == 'link_click'){
            details.push('Anchor: ' + docs[i].link_data.anchor);
        }
        else if (e == 'form_submit'){
            for(var j = 0; j < docs[i].form_data.length; j++)
                details.push(JSON.stringify(docs[i].form_data[j]));
        }

        if (docs[i].removed){
            url = 'removed';
            title = 'removed';
            rowclass='active';
            details = [];
        }
 
        var d = {
            'event': docs[i].event,
            'url': url,
            'title': title,
            'annotation': annotation.join('; '),
            'timestamp': new Date(docs[i].timestamp).toLocaleTimeString(),
            'removed': docs[i].removed,
            'details': details.join('; '),
            'rowclass': rowclass,
            'has_serp': has_serp,
            'serp_id': serp_id,
        }
        data.push(d);
    }
    return data;
}

// Handle different search engines
function check_searchEngine(url){
    //look for search engine query urls
    //Web search
    var google_reg = /.+?\.google\..+?q=.+/;
    var yahoo_reg = /.+?\.search\.yahoo\..+?p=.+/
    var bing_reg = /.+?\.bing\..+?q=.+/ 

    var query = '';
    var se = '';
    var search = false;
    var start = 0;
    var media = 'web';
    if (google_reg.test(url)){
        query = url.split('q=')[1].split('&')[0];
        se = 'google'
        search = true
        tmp = url.split('start=');
        reg_tbm = /tbm=.+?(&|$)/g
        if (tmp.length > 1)
            start = parseInt(tmp[1].split('&')[0]);
        tbms = url.match(reg_tbm);
        //console.log(tbms)
        if (tbms!=null){
            mediatype = tbms[tbms.length-1].split('=')[1].split('&')[0];
            if (mediatype == 'isch')
                media = 'images';
            else if (mediatype == 'nws')
                media = 'news';
            else if (mediatype == 'vid')
                media = 'videos';
            else if (mediatype == 'shop')
                media = 'shopping';
            else if (mediatype == 'bks')
                media = 'books';
            else if (mediatype == 'app')
                media = 'apps';
        }
        else if (url.indexOf('/flights/')>-1)
            media = 'flights';
        else if (url.indexOf('/maps/') > -1 || url.indexOf('/maps?')>-1)
            media = 'maps';
   }
    else if (yahoo_reg.test(url)){
        query = url.split('p=')[1].split('&')[0];
        se = 'yahoo';
        search = true;
        tmp = url.split('from=');
        if (tmp.length > 1)
            start = parseInt(tmp[1].split('&')[0]);
        if (url.indexOf('images.search') > -1)
            media = 'images';
        else if (url.indexOf('video.search') > -1)
            media = 'videos';
        else if (url.indexOf('news.search') > -1)
            media = 'news';
        else if (url.indexOf('/local/') > -1)
            media = 'local';
        else if (url.indexOf('answers.search') > -1)
            media = 'answers';
        else if (url.indexOf('celebrity.search')>-1)
            media = 'celebrity';
        else if (url.indexOf('recipes.search') > -1)
            media = 'recipes';
    }
    else if (bing_reg.test(url)){
        query = url.split('q=')[1].split('&')[0];
        se = 'bing';
        search = true;
        tmp = url.split('b=');
        if (tmp.length > 1)
            start = parseInt(tmp[1].split('&')[0]);
        if (url.indexOf('/images/') > -1)
            media = 'images';
        else if (url.indexOf('/videos/')> -1)
            media = 'videos'
        else if (url.indexOf('/maps/')> -1)
            media = 'maps';
        else if (url.indexOf('/news/')>-1)
            media = 'news';
        else if (url.indexOf('/explore?')>-1)
            media = 'explore';
    }
    return {'se': se, 'query': query, 'search': search, 'start_count': start, 'media': media}
}


module.exports = router;







