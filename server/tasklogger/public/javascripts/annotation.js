/* ====================
   Dependancy: tasks.js
 ===================== */

var url_ajax_options = '/users/ajax_annotation_options';
var url_ajax_annotation = '/users/ajax_annotation';

//Dates where logs are recorded and user progress
var log_dates_progress = [];
//The current viewing date;
var view_date = {}

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

    /* Handling annotations on logs */

    //Initialise labeling options

    //Get dates
    //Set viewing date to default
    //Load data of that day
    get_dates();
    
    //See more candidate task labels
    $('#task_dropdown').on('click', '#task_label_more', function(){
        $('.task-more').toggleClass('hidden');
    });

    //TODO: Create new candidate task labels - maybe not 
    $('#task_dropdown').on('click', '#task_label_new', function(){
    });

   load_data();

    //TODO: Select all/none/labelled/unlablled

    //Select a different date to view log 
    $('#date_dropdown').on('click', '.date-option', function(){
        var year = $(this).attr('year');
        var day = $(this).attr('day');
        var date = new Date(year, 0);
        date.setDate(day);
        set_view_date(date);
        //reload the tasks and log items
        load_data();
    });

    //Per-item remove, click on modal confirming removing
    $('#div_logarea').on('click', '.remove-confirm', function(){
        var item_id = $(this).attr('id').split('_')[2];
        $('#modal_' + item_id).modal('toggle');
        //remove the item
        items = [item_id];
        remove_logitems(items); 
    });

    //Global remove selected log items
    $('#global_trash').click(function(){
        var selected_items = []
        $('#div_logarea input:checked').each(function(){
            selected_items.push($(this).attr('id').split('_')[3]);
        });
        remove_logitems(selected_items);
    });

    //Per-item assign task
    $('#div_logarea').on('click', '.logitem-label-candidate', function(){
        var task_id = $(this).attr('id').split('_')[3];
        var taskname = $(this).text();
        var item_id = $(this).parent().attr('id').split('_')[3]
        submit_labels_task([item_id], task_id, taskname);
    });
    
    //TODO: Global assign task
    $('#task_dropdown').on('click', '.task_option', function(){
        var taskid = $(this).attr('id').split('_')[1];
        var taskname = $(this).find('a').text();
        var selected_items = []
        $('#div_logarea input:checked').each(function(){
            selected_items.push($(this).attr('id').split('_')[3]);
        });
        submit_labels_task(selected_items, taskid, taskname);
 
    });

    //Per-item assign usefulness
    $('#div_logarea').on('click', '.logitem-useful-option', function(){
        var useful = $(this).attr('id').split('_');
        var id = useful[3];
        var value = useful[2];
        submit_labels_useful(id, value);
    });

    //Per-item show more labels
    $('#div_logarea').on('click', '.logitem-label-candidate-more', function(){
        var item_id = $(this).attr('id').split('_')[4];
        $(this).parent().find('.more-candidate').removeClass('hidden');
        $(this).addClass('hidden'); 
    });
    //Per-item show less labels
    $('#div_logarea').on('click', '.logitem-label-candidate-less', function(){
        var item_id = $(this).attr('id').split('_')[4];
        $(this).parent().find('.more-candidate').addClass('hidden');
        $(this).addClass('hidden'); 
        $(this).parent().find('.logitem-label-candidate-more').removeClass('hidden');
    });

    //TODO: Progress bar
    //TODO: Remove ratio bar

    //TODO: Consider general labels, e.g., social networking, 
    //entertainment, news update

    //TODO: Consider color code for tasks
});

/*================================
    Functions for log annoation
===================================*/
function get_dates(){
    $.ajax({
        type: "POST",
        url: url_ajax_options,
        data: {'event': 'get_dates', 
               }
    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            for (var i = 0; i<response.res.length; i++){
                var key = response.res[i]['_id'];
                var date = new Date(key.year, 0);
                date.setDate(key.day)
                response.res[i].date = date;
                log_dates_progress.push(response.res[i]);
            }
            set_date_options();

            //By default set the viewing date to the lastest day
            log_dates_progress.sort(function(a, b){
                return b.date.getTime() - a.date.getTime();
            })
            set_view_date(log_dates_progress[0].date);
            //Load data of that day
            load_data(); 
        };
    });
}

function set_view_date(date){
    view_date.start = new Date(date);
    view_date.end = new Date(date);
    view_date.end.setHours(23, 59, 59, 999)
    $('#global_date_selected').text(date.toDateString());
}

//Set the date options on UI
function set_date_options(){
      for (var i = 0; i < log_dates_progress.length; i++){
        var ele = document.createElement('li');
        ele.setAttribute('year', log_dates_progress[i]['_id'].year);
        ele.setAttribute('day', log_dates_progress[i]['_id'].day);
        ele.setAttribute('class', 'date-option');
        var ele_a = document.createElement('a');
        ele_a.appendChild(document.createTextNode(log_dates_progress[i].date.toDateString()));
        ele.appendChild(ele_a);
        $('#date_dropdown').append(ele);
    }
}

//Get candidate tasks from DB, then load log items
//load task labels - it does the following:
//update the global variable arrays: candidate_tasks, more_candidate_tasks
//update the dropdown menu for global task options
//load the log items
//update the candidate tasks for individual log items 
function load_data(){
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
            //After that, task opitons are loaded, load log items for annotation 
            load_log();
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
    //Add "more tasks"
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

//Show task label in global task candidates
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
        if (task.task.length > 30)
            ele_task_text.innerHTML = task.task.substring(0, 30) + '...'
        ele_task.appendChild(ele_task_text);
        ele_tasks.push(ele_task);
    }    
    return ele_tasks;
}

//Show task label in global task candidates
function create_subtasklabel_element(subtask, maintask){
    var ele_sub = document.createElement('li');
    ele_sub.setAttribute('id', 'label_'+subtask['_id']);
    ele_sub.setAttribute('class', 'task_option task_level_'+subtask.task_level);
    var ele_sub_text = document.createElement('a');
    var maintask_text = maintask.task;
    if (maintask_text.length > 15)
        maintask_text = maintask_text.substring(0, 15) + '...';
    var sub_text = subtask.task;
    if (sub_text.length > 15)
        sub_text = sub_text.substring(0, 15) + '...';

    ele_sub_text.innerHTML = maintask_text + '/' + sub_text;
    ele_sub.appendChild(ele_sub_text);
    return ele_sub;
}

//Get log that is recorded on the viewing date
function load_log(){
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
            display_log(response.res);
        }
    });
}


//Display log items
function display_log(log){
    $('#div_logarea').html('');
    for (var i = 0; i<log.length; i++){
       var div_item= create_logitem_element(log[i]);
       $('#div_logarea').append(div_item);
    }
    //Initialise tooltip
    $('[data-toggle="tooltip"]').tooltip();
}


//For each item, the annotation property should have the
//following structure:
//{task: {taskid: xx, name: yy}, useful: true/false}
function create_logitem_element(item){
    //Logitem area
    var div_item = document.createElement('div');
    div_item.setAttribute('id', 'logitem_' + item['_id']);
    div_item.setAttribute('class', 'panel panel-default');
    div_item.setAttribute('event_type', item.event);

    //Logitem content
    var div_item_content = document.createElement('div');
    div_item_content.setAttribute('id', 'logitem_content_'+item['_id']);
    div_item_content.setAttribute('class', 'panel-heading');

   //Logitem content - checkbox
    var checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('id', 'logitem_content_checkbox_' + item['_id']);
    checkbox.setAttribute('class', 'logitem-content-checkbox');
    div_item_content.appendChild(checkbox);

    //Logitem content - type icon - to be set
    var icon = document.createElement('span');

    //Logitem content - Query or Title of page - to be set
    var text = document.createElement('span');
    text.setAttribute('class', 'panel-title logitem-title');

    //Logitem content - time
    var time = document.createElement('span');
    time.setAttribute('class', 'logitem-time');
    time.innerHTML = new Date(item.timestamp).toLocaleTimeString();

    //Logitem content - remove button
    var remove = document.createElement('button');
    remove.setAttribute('class', 'close');
    remove.innerHTML = ['<span aria-hidden="true", data-toggole="tooltip"',
        'data-placement="left", title="Remove this item from log"',
        '>',
        '&times;',
        '</span>',
        ].join('\n');
    remove.setAttribute('data-toggle', 'modal');
    remove.setAttribute('data-target', '#modal_'+item['_id']);
    var div_modal = logitem_create_remove_modal(item);

    //Logitem labels 
    var div_item_label = document.createElement('div');
    div_item_label.setAttribute('id', 'logitem_label_' + item['_id']);
    div_item_label.setAttribute('class', 'panel-body');

    //Logitem label - chosen label
    var div_chosen_label = document.createElement('div');
    div_chosen_label.setAttribute('id', 'logitem_label_chosen_' + item['_id']);
    div_chosen_label.setAttribute('class', 'logitem-label-chosen');
    div_chosen_label.setAttribute('taskid', '');
    div_chosen_label.setAttribute('taskname', '');

    //Logitem label - chosen label - explaning text - to be set
    var span_label_text = document.createElement('span');

    //Logitem label - chosen label - task name - to be set
    var span_label_task = document.createElement('span');
    span_label_task.setAttribute('class', 'label label-info');
    span_label_task.setAttribute('id', 'logitem_label_chosen_taskname_'+item['_id']);

    //Logitem label - candidates
    var div_candidates = document.createElement('div');
    div_candidates.setAttribute('id', 'logitem_label_candidates_'+item['_id']);
    div_candidates.setAttribute('class', 'logitem-label-candidates');
    //load_candidate labels
    logitem_load_candidates(div_candidates, item);

    //Logitem label - useful
    var div_useful = document.createElement('div');
    div_useful.setAttribute('id', 'logitem_useful_' + item['_id']); 
    div_useful.setAttribute('class', 'logitem-useful panel-footer');
    div_useful.setAttribute('useful', '');
    //Logitem label - useful - options
    var span_useful_true = document.createElement('span');
    span_useful_true.setAttribute('id', 'logitem_useful_true_' + item['_id']); 
    span_useful_true.setAttribute('class', 'label label-default logitem-useful-option');
    span_useful_true.innerHTML = 'USEFUL'
    var span_useful_false = document.createElement('span');
    span_useful_false.setAttribute('id', 'logitem_useful_false_' + item['_id']); 
    span_useful_false.setAttribute('class', 'label label-default logitem-useful-option');
    span_useful_false.innerHTML = 'NOT USEFUL';
 
    //Depending on the type of item, and the annotation status, 
    //set properties and content of the log items 
    if (item.event == 'tab-search'){
        //Set icon type
        icon.setAttribute('class', 'glyphicon glyphicon-search logitem-icon');
        //Set logitem content
        text.innerHTML = '"' + decodeURI(item.details.query.replace(/\+/g, ' ')) + '"';
        //Set chosen label explaining text
        span_label_text.innerHTML = 'I was <i>searching</i> for: ';
        if ('task' in item.annotation){
            //Set chosen task label
            span_label_task.innerHTML = item.annotation.task.name;
            //Set values of chosen label
            div_chosen_label.setAttribute('taskid', item.annotation.task.taskid);
            div_chosen_label.setAttribute('taskname', item.annotation.task.name);
            //Set labeling done
            div_item.setAttribute('class', 'panel panel-success')
        } 
    }
    else{
        //Set icon type
        icon.setAttribute('class', 'glyphicon glyphicon-globe logitem-icon');
        //Set logitem text
        text.innerHTML = '<a href="'+item.url+'">' + item.details.current_tab.title + '</a>';
        //Set chosen label explaining text
        span_label_text.innerHTML = 'I was <i>browsing</i> for: ';
        //Set chosen label
        var task_done = true;
        if ('task' in item.annotation){
            //Set chosen task label
            span_label_task.innerHTML = item.annotation.task.name;
            //Set values of chosen label
            div_chosen_label.setAttribute('taskid', item.annotation.task.taskid);
            div_chosen_label.setAttribute('taskname', item.annotation.task.name);
            //Set labeling done
            //div_item.setAttribute('class', 'panel panel-success')
        } 
        else
            task_done = false;
        //Set useful label
        if ('useful' in item.annotation){
            if (item.annotation.useful)
                span_useful_true.setAttribute('class', 'label label-success logitem-useful-option');
            else
                span_useful_false.setAttribute('class', 'label label-danger logitem-useful-option');
            //set chosen useful label
            div_useful.setAttribute('useful', item.annotation.useful);
        }
        else
            task_done = false;
        if(task_done)
            div_item.setAttribute('class', 'panel panel-success');
    }

    //Adding elements into the DOM 
    div_item_content.appendChild(remove);
    div_item_content.appendChild(div_modal);

    div_item_content.appendChild(icon); 
    div_item_content.appendChild(text);
    div_item_content.appendChild(time);
    div_item.appendChild(div_item_content)
            
    div_chosen_label.appendChild(span_label_text);
    div_chosen_label.appendChild(span_label_task);

    div_item_label.appendChild(div_chosen_label);
    div_item_label.appendChild(div_candidates);

    div_item.appendChild(div_item_label);
    if (item.event == 'tab-loaded'){
        var span_useful_text = document.createElement('span');
        span_useful_text.setAttribute('class', 'logitem-useful-text');
        span_useful_text.innerHTML = 'For what I was doing, I find this page ';
        div_useful.appendChild(span_useful_text);
        div_useful.appendChild(span_useful_true);
        div_useful.appendChild(span_useful_false);
        div_item.appendChild(div_useful);
    }

    return div_item;
}

//Show candidate tasks
function logitem_load_candidates(div_candidates, item){
    //Sort labels by time 
    candidate_tasks.sort(function(a, b){return a.time_create - b.time_create})
    more_candidate_tasks.sort(function(a, b){return a.time_create - b.time_create})
    //high priority candidates
    for (var i = 0; i<candidate_tasks.length; i++){
        var task = candidate_tasks[i];
        if (task.task_level == 0 && task.subtasks.length > 0){
            for(var j = 0; j < task.subtasks.length; j++){
                var taskid = task.subtasks[j]['_id'];                   
                var taskname = task.subtasks[j].task;
                var parentname = task.task;
                var ele = logitem_create_candidate_label(taskid, taskname, parentname);
                div_candidates.appendChild(ele);
            }
        }
        else{
            var ele = logitem_create_candidate_label(task['_id'], task.task, '');
            div_candidates.appendChild(ele);
        }
    }
    //option - show more
    var ele = document.createElement('span');
    ele.setAttribute('id', 'logitem_label_candidate_more_' + item['_id']);
    ele.setAttribute('class', 'logitem-label-candidate-more');
    ele.innerHTML = 'Show more ...';
    div_candidates.appendChild(ele);

    //low priority candidates
    for(var i = 0; i < more_candidate_tasks.length; i++){
        var task = more_candidate_tasks[i];
        if (task.task_level == 0 && task.subtasks.length > 0){
            for(var j = 0; j < task.subtasks.length; j++){
                var taskid = task.subtasks[j]['_id'];
                var taskname = task.subtasks[j].task;
                var parentname = task.task;
                var ele = logitem_create_candidate_label(taskid, taskname, parentname);
                ele.className += ' more-candidate hidden';
                div_candidates.appendChild(ele);
            }
        }
        else{
            var ele = logitem_create_candidate_label(task['_id'], task.task, '');
            ele.className += 'more-candidate hidden';
            div_candidates.appendChild(ele);
        }
    }
    //option - show less
    var ele = document.createElement('span');
    ele.setAttribute('id', 'logitem_label_candidate_less_' + item['_id']);
    ele.setAttribute('class', 'logitem-label-candidate-less more-candidate hidden');
    ele.innerHTML = 'Show less ...';
    div_candidates.appendChild(ele);

    //TODO: Create new label?
}

function logitem_create_candidate_label(taskid, taskname, parentname){
    var name = '';
    if (parentname == ''){
        if (taskname.length > 30)
            taskname = taskname.substring(0, 30) + '...';
        name = taskname; 
    } 
    else{
        if (taskname.length > 15) + '...'
            taskname = taskname.substring(0, 15);
        if (parentname.length > 15)
            parentname = parentname.substring(0, 15) + '...';
        name = parentname + '/' + taskname;
    }
    var span_candidate = document.createElement('div');
    span_candidate.setAttribute('id', 'logitem_label_candidate_' + taskid);
    span_candidate.setAttribute('class', 'label label-default logitem-label-candidate');
    span_candidate.innerHTML = name;
    return span_candidate;
}

function logitem_create_remove_modal(item){
    //Modal
    var div_modal = document.createElement('div');
    div_modal.setAttribute('id', 'modal_' + item['_id']); 
    div_modal.setAttribute('class', 'modal');
    div_modal.setAttribute('role', 'dialog');
    div_modal.setAttribute('tabindex', '-1');
    //Modal - dialog
    var div_modal_dialog = document.createElement('div');
    div_modal_dialog.setAttribute('class', 'modal-dialog');
    div_modal_dialog.setAttribute('role', 'document');
    //Modal - content
    var div_modal_content = document.createElement('div');
    div_modal_content.setAttribute('class', 'modal-content');
    //Modal - header
    var div_modal_header = document.createElement('div');
    div_modal_header.setAttribute('class', 'modal-header'); 
    var btn_dismiss = document.createElement('button');
    btn_dismiss.setAttribute('class', 'close');
    btn_dismiss.setAttribute('data-dismiss', 'modal');
    btn_dismiss.setAttribute('aria-label', 'Close');
    btn_dismiss.innerHTML = '<span aria-hidden="true">&times;</span>'    
    div_modal_header.appendChild(btn_dismiss);
    var div_title = document.createElement('h4');
    div_title.setAttribute('modal-title');
    div_modal_header.appendChild(div_title);

    //Modal - body
    var div_modal_body = document.createElement('div');
    div_modal_body.setAttribute('class', 'modal-body');
    var icon = '';
    var content = '';
    if (item.event == 'tab-search'){
        icon = '<span class="glyphicon glyphicon-search"></span>';
        content = '"' + decodeURI(item.details.query.replace('+', '')) + '"';
    }
    else{
        icon = '<span class="glyphicon glyphicon-globe"></span>';
        content = item.details.current_tab.title;
    }
    var message = [
    '<div class="alert alert-danger">',
    '<h4><strong>Warning</strong> - removing item from log </h4>',
    icon, content,
    '</div>',
    '<h5>Are you sure that you would like this item to be removed from your log?</h5>',
    ]
    div_modal_body.innerHTML = message.join('\n');
    //Modal - footer
    var div_modal_footer = document.createElement('div');
    div_modal_footer.setAttribute('class', 'modal-footer');
    //buttons
    var btn_no = document.createElement('button');
    btn_no.setAttribute('class', 'btn btn-default');
    btn_no.setAttribute('data-dismiss', 'modal');
    btn_no.innerHTML = 'Cancel';
    var btn_yes = document.createElement('button');
    btn_yes.setAttribute('class', 'btn btn-primary remove-confirm');
    btn_yes.setAttribute('id', 'remove_confirm_'+item['_id']);
    btn_yes.innerHTML = 'Yes';
    div_modal_footer.appendChild(btn_no);
    div_modal_footer.appendChild(btn_yes);

    div_modal_content.appendChild(div_modal_header);
    div_modal_content.appendChild(div_modal_body);
    div_modal_content.appendChild(div_modal_footer);
    div_modal_dialog.appendChild(div_modal_content);
    div_modal.appendChild(div_modal_dialog);
    return div_modal;
}


// remove items from log - mark the log item as "remove"
function remove_logitems(items){
    $.ajax({
        type: "POST",
        url: url_ajax_annotation,
        data: {'event': 'remove_logitems', 
                'items': items,
               }
    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            //remove this element from UI
            for(var i = 0; i < items.length; i++)
                $('#logitem_' + items[i]).remove();
        }
    });
}

//Submit the label of usefulness of single log item
function submit_labels_useful(id, value){
     $.ajax({
        type: "POST",
        url: url_ajax_annotation,
        data: {'event': 'submit_labels_useful', 
                'id': id,
                'value': value,
               }
    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            //Show the selected label in UI
            if (value == 'true'){
                $('#logitem_useful_true_' + id)
                    .removeClass('label label-default').addClass('label label-success');
                $('#logitem_useful_false_' + id)
                    .removeClass('label label-danger').addClass('label label-default');
            }
            else{
                $('#logitem_useful_true_' + id)
                    .removeClass('label label-success').addClass('label label-default');
                $('#logitem_useful_false_' + id)
                    .removeClass('label label-default').addClass('label label-danger');
            }
        }
    });
}
//Submit the task labels
function submit_labels_task(items, taskid, taskname){
     $.ajax({
        type: "POST",
        url: url_ajax_annotation,
        data: {'event': 'submit_labels_task', 
                'items': items, 
                'taskid': taskid,
                'taskname': taskname,
               }
    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            //Show the selected label in chosen label
            for(var i = 0; i < items.length; i++){
                var span_id = '#logitem_label_chosen_taskname_' + items[i]
                var div_id = '#logitem_label_chosen_' + items[i];
                $('#div_logarea').find(span_id).text(taskname).attr('taskid', taskid);
                //TODO: Set the value to the chosen div
                $('#div_logarea').find(div_id).attr('taskid', taskid).attr('taskname', taskname);
                //TODO: Set item to done if it's done
            }
        }
    });
   
}
