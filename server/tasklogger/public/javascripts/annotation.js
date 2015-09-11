/* ====================
   Dependancy: tasks.js
 ===================== */

var url_ajax_options = '/users/ajax_annotation_options';
var url_ajax_annotation = '/users/ajax_annotation';

//the date the user is viewing
var view_date = {};
//the range that logs are recorded
var date_range = {};

// candidate tasks are tasks that haven't been done between the viewing date
var candidate_tasks = [];
// more candidate tasks are tasks that were done before the viewing date
var more_candidate_tasks = [];

$(document).ready(function(){
    //Initialize tooltips
    $('[data-toggle="tooltip"]').tooltip();

    //Stop dismiss dropdown after click for task label menu
    $('#task_dropdown').on('click', function(e){
        e.stopPropagation();
    });

    $('#task_dropdown').on('click', 
        '.label-maintask-without-subtask', function(){
        $('#global_label_option').dropdown('toggle');
    });

    $('#task_dropdown').on('click', '.task_level_1', function(){
        $('#global_label_option').dropdown('toggle');
    });

    //Initialise labeling options
    //Set viewing date to default: today
    set_view_date(0);
     
    //Get date range of logs
    get_date_range();

    //See more candidate task labels
    $('#task_dropdown').on('click', '#task_label_more', function(){
        $('.task-more').toggleClass('hidden');
    });
    //Create new candidate task labels 
    $('#task_dropdown').on('click', '#task_label_new', function(){
    });

    /* Handling annotations on logs */
    //load task labels
    load_task_labels();

    //TODO: Create new task label from label options
    //TODO: Assign color for task labels
    //TODO: Select all/none/labelled/unlablled
    //TODO: Remove selected items
    //TODO: Select a different date to view log 

    //TODO: Load log
    load_log();
    //TODO: Per-item remove
    //TODO: Global remove
    //TODO: Per-item assign task
    //TODO: Global assign task
    //TODO: Per-item assign relevance
    //TODO: Progress bar
    //TODO: Remove ratio bar
});

/*================================
    Functions for log annoation
===================================*/
//Get log that is recorded on the viewing date
function load_log(){
    console.log('here')
    $.ajax({
        type: "POST",
        url: url_ajax_annotation,
        data: {'event': 'get_log', 
                'time_start': view_date.start.getTime(),
                'time_end': view_date.end.getTime(),
               }
    }).done(function(response) {
        if (response.err){
            console.log(response.emsg)
            $('#div_logarea').append(
                '<div class="err">' + response.emsg.name + ': '+response.emsg.$err + '</div>'
            );
        }
        else{
            console.log(response.res)
        }
    });
}


function set_view_date(hours_from_today){
    //set to today
    view_date.start = new Date();
    view_date.end = new Date(); 
    //deviate from today
    view_date.start.setHours(hours_from_today, 0, 0, 0);
    view_date.end.setHours(hours_from_today+23, 59, 59, 999);
    //set the selected date on UI
    $('#global_date_selected').text(view_date.start.toDateString())
}

//Get the range of dates of the logs
function get_date_range(){
    $.ajax({
        type: "POST",
        url: url_ajax_options,
        data: {'event': 'get_date_range', 
               }
    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            date_range.min = new Date(response.res.min)
            date_range.max = new Date(response.res.max)
            set_date_options();
        }
    });
}

//Set the date options on UI
function set_date_options(){
    var it = new Date(date_range.min.getTime());
    var max = new Date(date_range.max.getTime());
    max.setHours(23, 59, 59, 999);
    var i = 0
    it.setHours(24*i+23, 59, 59, 999);
    while (it < max){
        var ele = document.createElement('li');
        var ele_a = document.createElement('a');
        ele_a.appendChild(document.createTextNode(it.toDateString()));
        ele.appendChild(ele_a);
        $('#date_dropdown').append(ele);
        i += 1;
        it.setHours(24*i + 23, 59, 59, 999);
    }
    var ele = document.createElement('li');
    var ele_a = document.createElement('a');
    ele_a.appendChild(document.createTextNode(max.toDateString()));
    ele.appendChild(ele_a);
    $('#date_dropdown').append(ele);
}

//Get candidate tasks from DB
function load_task_labels(){
    $.ajax({
        type: "POST",
        url: url_ajax_options,
        data: {'event': 'retrieve_candidate_tasks', 
                'time_thresh': view_date}
    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            //Filter tasks done before current viewed date
            candidate_tasks = [];
            more_candidate_tasks = [];
            for (key in response.res){
                //If main task is done before viewing date, then all its subtasks are as well
                var main_time_done = response.res[key].time_done;
                if (main_time_done > 0 && main_time_done < view_date.start){
                    more_candidate_tasks.push(response.res[key]);
                }
                else{
                    //main task is not done before viewing date, subtasks may have
                    sub_done = response.res[key].subtasks.filter(
                            function(d){return d.time_done < view_date.start && d.time_done > 0});
                    sub_not_done = response.res[key].subtasks.filter(
                            function(d){return d.time_done >= view_date.start || d.time_done == 0});
                    var main_sub_done = $.extend(true, {}, response.res[key]);
                    main_sub_done.subtasks = sub_done;
                    var main_sub_undone = $.extend(true, {}, response.res[key]);
                    main_sub_undone.subtasks = sub_not_done;
                    more_candidate_tasks.push(main_sub_done);
                    candidate_tasks.push(main_sub_undone); 
                }
            }
            display_task_options();                            
        }
    });
   
}

//Populate the task options in the task dropdown
function display_task_options(){
    $('.task_option').remove();
    var list = document.getElementById('task_dropdown');
    candidate_tasks.sort(function(a, b){return a.time_create - b.time_create})
    more_candidate_tasks.sort(function(a, b){return a.time_create - b.time_create})
    //Only show the "canddiate_tasks"
    for (var i = 0; i<candidate_tasks.length; i++){
        var ele_tasks = create_tasklabel_element(candidate_tasks[i])
        //append to list
        for(var j = 0; j < ele_tasks.length; j++){
            list.insertBefore(ele_tasks[j], document.getElementById('divider'));
        }
        //create subtasks element if any
        //if (candidate_tasks[i].subtasks.length > 0){
        //    for (var j = 0; j < candidate_tasks[i].subtasks.length; j++){
        //        var sub_ele = create_subtasklabel_element(candidate_tasks[i].subtasks[j]);
        //        list.insertBefore(sub_ele, document.getElementById('divider'));
        //    }
        //}
    }
    for(var i = 0; i < more_candidate_tasks.length; i++){
        var ele_tasks = create_tasklabel_element(more_candidate_tasks[i]);
        for(var j = 0; j < ele_tasks.length; j++){
            ele_tasks[j].className += ' task-more task-more-main hidden';
            list.appendChild(ele_tasks[j], document.getElementById('task_option_new'));
        }
        //create subtasks element if any
        //if (more_candidate_tasks[i].subtasks.length > 0){
        //    for (var j = 0; j < more_candidate_tasks[i].subtasks.length; j++){
        //        var sub_ele = create_subtasklabel_element(more_candidate_tasks[i].subtasks[j]);
        //        sub_ele.className += ' task-more task-more-sub hidden';
        //        list.appendChild(sub_ele, document.getElementById('task_option_new'));
        //    }
        //}
    }
}

function create_tasklabel_element(task){
    var ele_tasks = []
    var ele_task = document.createElement('li');
    //set it
    ele_task.setAttribute('id', 'label_' + task['_id']);
    //set class
    ele_task.setAttribute('class', 'task_option task_level_' + task.task_level);
    //If there is subtasks, then label should be at subtask level
    if (task.subtasks.length > 0){
        //ele_task.className += ' label-maintask-with-subtask';
        for (var j = 0; j < task.subtasks.length; j++){
            var ele_sub = create_subtasklabel_element(task.subtasks[j], task);
            ele_tasks.push(ele_sub);
        }
    }
    else{
        ele_task.className += ' label-maintask-without-subtask';
        //set text
        var ele_task_text = document.createElement('a');
        ele_task_text.innerHTML = task.task;
        if (task.task.length > 25)
            ele_task_text.innerHTML = task.task.substring(0, 25) + '...'
        ele_task.appendChild(ele_task_text);
        ele_tasks.push(ele_task);
    }    
    return ele_tasks;
}

function create_subtasklabel_element(subtask, maintask){
    var ele_sub = document.createElement('li');
    ele_sub.setAttribute('id', 'label_'+subtask['_id']);
    ele_sub.setAttribute('class', 'task_option task_level_'+subtask.task_level);
    var ele_sub_text = document.createElement('a');
    var maintask_text = maintask.task;
    if (maintask_text.length > 15)
        maintask_text = maintask_text.substring(0, 15) + '...';
    var sub_text = subtask.task
    if (sub_text.length > 15)
        sub_text = sub_text.substring(0, 15) + '...'
    
    ele_sub_text.innerHTML = maintask_text + '/' + sub_text;
    ele_sub.appendChild(ele_sub_text);
    return ele_sub;
}
