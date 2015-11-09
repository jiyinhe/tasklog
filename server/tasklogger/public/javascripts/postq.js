//TODO: 
//Submit userid
//If incorrect, show err message
//If correct, show tasklist
//Reset userid, clear all
//Select tasks to analyse
//Submit selected tasks
//Show questionnaire
//Save answer on action 


var url_ajax_postq = 'postQ/ajax_postq';
var option_index = 'abcdefghijklmnopqrstuvwxyz';
//Options in questions
var questions = {
'task_frequency':  ['unique', 'intermittent', 'routine'],
'task_length':  ['short', 'mid', 'long'],
'task_stage':  ['beginning', 'middle', 'final'],
'task_product':  ['physical', 'intellectual', 'decision', 'fact', 'image', 'mixed'],
'task_process':  ['one_time', 'multi_time'],
'task_goals_quantity':  ['single', 'multiple'],
'task_complexity_objective':  ['remember', 'understadn', 'apply', 'analyse', 'evaluate', 'create'],
'task_collaboration':  ['group', 'supported', 'individual'],
'task_sailence_subjective':  ['important', 'moderate_important', 'unimportant'],
'task_urgency_subjective':  ['urgent', 'moderate_urgent', 'not_urgent'],
'task_difficulty_subjective':  ['difficult', 'moderate_difficult', 'not_difficult'],
'task_complexity_subjective':  ['complex', 'moderate_complex', 'not_complex'],
'task_knowledge_topic':  ['knowledgeable', 'moderate_knowledgeable', 'not_knowledgeable'],
'task_knowledge_procedure':  ['knowledgeable', 'moderate_knowledgeable', 'not_knowledgeable'],
'task_satisfaction':  ['satisfied', 'satisfied_but_struggled', 'not_satisfied'],
};


$(document).ready(function(){
    //Reset userid
    $('#btn_reset').click(function(){
        reset_userid();
    });
    //Submit userid
    $('#btn_userid').click(function(){
        submit_userid($('#input_userid').val());
    });
    //Click on view history for a task
    $('#task_selection').on('click', '.btn-select-task', function(){
        var task_id = $(this).attr('id').split('_')[1];
        if($(this).attr('status') == 'hide'){
            var userid = $('#input_userid').val();
            view_history(task_id, userid);
        }
        else{
            //hide history
            hide_history(task_id); 
        }
    });

    //Submit the selected tasklist
    $('#submit_tasklist').click(function(){
        var tasklist = [];
        $('#task_selection').find('.tasklist-entry').each(function(index){
            var checkbox = $(this).find('.tasklist-checkbox');
            var entry = {'min_time': parseInt($(this).attr('min_time')),
                    'max_time': parseInt($(this).attr('max_time')),
                    'count': parseInt($(this).attr('count')),
                    '_id': {'taskid': $(this).attr('id').split('_')[1],
                            'name':$(this).attr('taskname')},
                    'chosen': checkbox.prop('checked'),
                };
            tasklist.push(entry);
        });

        var userid = $('#input_userid').val();
        submit_tasklist(tasklist, userid);
    });

    //Selecting answer for a task
    $('.answers').on('click', 'label', function(){
        var select = $(this).attr('id').split(':');
        //change other buttons to default style
        $('.' + select[0] + '-' + select[1]).removeClass('btn-success').addClass('btn-default');
        //set this one to success style      
        $(this).removeClass('btn-default').addClass('btn-success');
        //submit selection 
        var userid = $('#input_userid').val();
        submit_answer({
            'userid': userid,
            'qid': select[0], 
            'taskid': select[1],
            'answer': select[2],
        });
    }); 

});


function reset_userid(){
    //Clear userid
    $('#input_userid').val('').prop('disabled', false).focus();
    //Clear tasklist
    $('#tasklist').addClass('hidden');
    //Clear questionnaire
    $('#questionnaire').addClass('hidden');
}

function submit_userid(userid){
    //submit userid to server
    $.ajax({
        type: "POST",
        url: url_ajax_postq,
        data: {"data": JSON.stringify({
                "event": "submit_userid", 
                "userid": userid,
                })},

    }).done(function(response) {
        //If wrong, show error message
        if (response.err){
            $('#err_userid').html(response.emsg);
            reset_userid();
        }
        else{
            //If right, show correponsding content depending
            //on user progress
            $('#input_userid').prop('disabled', true);
            show_tasklist(response.tasklist);
            $('#tasklist').removeClass('hidden');
        }
    });
}

function view_history(taskid, userid){
    $.ajax({
        type: "POST",
        url: url_ajax_postq,
        data: {"data": JSON.stringify({
                "event": "get_history", 
                "taskid": taskid,
                "userid": userid,
                })},

    }).done(function(response) {
        //If wrong, show error message
        if (response.err){
            $('#err_tasklist').html(response.emsg);
        }
        else{
            //If right, show correponsding content depending
            show_history(response.history, taskid)
        }
    });
}

function submit_tasklist(tasklist, userid){
    $.ajax({
        type: "POST",
        url: url_ajax_postq,
        data: {"data": JSON.stringify({
                "event": "submit_tasklist", 
                "userid": userid,
                "tasklist": tasklist,
                })},

    }).done(function(response) {
        //If wrong, show error message
        if (response.err){
            $('#err_submit_tasklist').html(response.emsg);
        }
        else{
            update_questionnaire(response.q);
        }
    });

}

function submit_answer(data){
    data.event = 'submit_answer';
    $.ajax({
        type: "POST",
        url: url_ajax_postq,
        data: {"data": JSON.stringify(data)},
    }).done(function(response) {
        //If wrong, show error message
        if (response.err){
            $('#err_submit_tasklist').html(response.emsg);
        }
        else{
            //update_questionnaire(response.q);
        }
    });

}

function show_tasklist(tasklist){
    for(var i = 0; i < tasklist.length; i++){
        var ele = make_task_entry(tasklist[i]);
        document.getElementById('task_selection').appendChild(ele);
    }
}

function make_task_entry(task){
    var ele = document.createElement('div');
    ele.setAttribute('id', 'task_' + task._id.taskid);
    ele.setAttribute('class', 'tasklist-entry');
    ele.setAttribute('min_time', task.min_time);
    ele.setAttribute('max_time', task.max_time);
    ele.setAttribute('count', task.count);
    ele.setAttribute('taskname', task._id.name);
    //Checkbox
    var checkbox = document.createElement('input');
    checkbox.setAttribute('id', 'task_checkbox_' + task._id.taskid);
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('class', 'tasklist-checkbox');
    //Chosen
    if (task.chosen == true)
        checkbox.checked = true;
    //Taskname
    var taskname = document.createElement('span');
    taskname.innerHTML = task._id.name;
    taskname.setAttribute('class', 'tasklist-taskname')

    //Entry count
    var entry_count = document.createElement('span');
    entry_count.setAttribute('class', 'text-muted');
    entry_count.innerHTML = ' (' + task.count + ')';
    taskname.appendChild(entry_count);

    //Time span
    var timespan = document.createElement('span');
    timespan.setAttribute('class', 'text-muted tasklist-helper');
    timespan.innerHTML = new Date(task.min_time).toDateString() + ' - ' + new Date(task.max_time).toDateString();

    //Button to view the history entries 
    var btn = document.createElement('button');
    btn.setAttribute('id', 'btn_' + task._id.taskid);
    btn.setAttribute('class', 'btn btn-default btn-xs btn-select-task')
    btn.setAttribute('status', 'hide');
    btn.innerHTML = 'View history';

    //Space for showing history 
    var history = document.createElement('div');
    history.setAttribute('id', 'history_' + task._id.taskid);
    history.setAttribute('class', 'tasklist-history hidden');

    ele.appendChild(checkbox);
    ele.appendChild(taskname);
    ele.appendChild(timespan);
    ele.appendChild(btn);
    ele.appendChild(history);
    return ele;
}

function show_history(history, taskid){
    var history_div = $('#task_selection').find('#history_' + taskid)
        .removeClass('hidden')
    for(var i = 0; i < history.length; i++){
        var ele = make_history_entry(history[i]); 
        history_div.append(ele);
    }
    //Change status
    $('#task_selection').find('#btn_' + taskid)
        .attr('status', 'shown').html('Hide history')
        .removeClass('btn-default').addClass('btn-danger');
}

function hide_history(taskid){
    var history_div = $('#task_selection').find('#history_' + taskid)
        .addClass('hidden');
    //Change status
    $('#task_selection').find('#btn_' + taskid)
        .attr('status', 'hide').html('View history')
        .removeClass('btn-danger').addClass('btn-default');
}


function make_history_entry(entry){
    var ele = document.createElement('div');
    ele.setAttribute('class', 'history-item');    
    //Icon
    var icon = document.createElement('span');
    if (entry._id.event == 'tab-loaded')
        icon.setAttribute('class', 'glyphicon glyphicon-globe');
    else{
        icon.setAttribute('class', 'glyphicon glyphicon-search');
    }
    ele.appendChild(icon);
    //Text
    var text = document.createElement('span');
    text.setAttribute('class', 'text-info history-text');
    try{
        text.innerHTML = decodeURIComponent(entry._id.text.replace(/\+/g, ' '));
    }
    catch(err) {
        text.innerHTML = entry._id.text.replace(/\+/g, ' '); 
    }
    ele.appendChild(text);
    //URLs
    for(var i = 0; i< entry.urls.length; i++){
        var url = document.createElement('div');
        url.setAttribute('class', 'history-url');
        url.innerHTML = entry.urls[i];
        ele.appendChild(url);
    }
    return ele
}

//update the answer set of each of the questions
function update_questionnaire(q){
    //Show the questionnaire
    //For each question, Add the items from the added set
    $('#questionnaire').removeClass('hidden');
    for(qid in questions){
        $('#' + qid).html('');
        var options = questions[qid];
        var table = document.createElement('table');
        table.setAttribute('class', 'table')
        //Header
        var thead = document.createElement('thead');
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.innerHTML = 'Task';
        tr.appendChild(th);
        var th = document.createElement('th');
        th.innerHTML = 'You answer';
        tr.appendChild(th);
        thead.appendChild(tr);
        table.appendChild(thead);

        //Content
        var tbody = document.createElement('tbody');
        //for each task
        for(var i = 0; i < q.length; i++){
            var tr = make_question_entry(q[i], qid, options);
            tbody.appendChild(tr)
        }
        table.appendChild(tbody);
        //Append the table to the callout div
        $('#' + qid).append(table); 
    }    
}

//An entry for a task under a question
function make_question_entry(questionnaire, qid, options){
    var tr = document.createElement('tr');
    //Task name
    var td = document.createElement('td');
    td.innerHTML = questionnaire.name;
    tr.appendChild(td) 
    //Answer
    var answer_id = -1;
    if (qid in questionnaire.qa){
        answer_id = options.indexOf(questionnaire.qa[qid]);
    }
    //Options
    var td = document.createElement('td');
    var bg = document.createElement('div');
    bg.setAttribute('class', 'btn-group');
    bg.setAttribute('role', 'group');
    bg.setAttribute('data-toggle', 'buttons');
    for(var i = 0; i < options.length; i++){
        var label = document.createElement('label');
        label.setAttribute('class', 'btn '+qid+'-'+questionnaire.taskid);
        if (answer_id == i){
            label.className += ' btn-success';
        }
        else
            label.className += ' btn-default';
        var btn = document.createElement('input');
        label.setAttribute('id', qid + ':' + questionnaire.taskid + ':' + options[i]);
        btn.setAttribute('type', 'radio');
        btn.setAttribute('name', qid+'_options');
        label.appendChild(btn);
        var span = document.createElement('span');
        span.innerHTML = option_index[i];
        label.appendChild(span);
        bg.appendChild(label);
    }
    td.appendChild(bg);
    tr.appendChild(td);
    return tr 
}
 
