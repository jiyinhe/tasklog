/* ====================
   Dependancy: tasks.js
 ===================== */
//TODO: instruction

var url_ajax_options = '/users/ajax_annotation_options';
var url_ajax_annotation = '/users/ajax_annotation';
var max_candidates = 5;
var div_item_template = {};

 
var log_data = [];
var batch_size = 30; 

//Dates where logs are recorded and user progress
var log_dates_progress = [];
//The current viewing date;
var view_date = {}

// candidate tasks are tasks that haven't been done between the viewing date
var candidate_tasks = [];
// more candidate tasks are tasks that were done before the viewing date
var more_candidate_tasks = [];

//general labels
var general_labels = [
    {id: '000', 'label': 'Not sure', 'subtasks': []},
    {id: '001', 'label': 'Entertainment', 'subtasks': []},
    {id: '002', 'label': 'Social networking', 'subtasks': []},
    {id: '003', 'label': 'News update', 'subtasks': []},
    {id: '004', 'label': 'Emailing', 'subtasks': []},
]; 

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


    //Select all/none/labelled/unlablled
    $('#global_checkbox').click(function(){
        if ($(this).is(':checked')){
            $('#global_checkbox').prop('checked', true);
            $('#div_logarea').find('.logitem-content-checkbox')
            .filter(function(){
                var id = $(this).attr('id').split('_')[3];
                return !$('#logitem_' + id).hasClass('hidden')
                }) 
            .prop('checked', true);
        }
        else {
            //De-select everything, whether hidden or not
            $('#global_checkbox').prop('checked', false);
            $('#div_logarea').find('.logitem-content-checkbox')
            .prop('checked', false);
        }
    });
    $('#select_all').click(function(){
        $('#global_checkbox').prop('checked', true);
        $('#div_logarea').find('.logitem-content-checkbox')
            .filter(function(){
                var id = $(this).attr('id').split('_')[3];
                return !$('#logitem_' + id).hasClass('hidden')
                })
            .prop('checked', true);
    });

    $('#select_none').click(function(){
        $('#global_checkbox').prop('checked', false);
        //De-select everything, whether hidden or not
        $('#div_logarea').find('.logitem-content-checkbox').prop('checked', false);
    });

    $('#select_labelled').click(function(){
        //Select labelled, but skip the ones that are hidden
        $('#div_logarea').find('.panel-success .logitem-content-checkbox')
            .filter(function(){
                var id = $(this).attr('id').split('_')[3];
                return !$('#logitem_' + id).hasClass('hidden')
                }) 
            .prop('checked', true);
        //De-select unlabelled, unlabelled cannot be hidden
        $('#div_logarea').find('.panel-default .logitem-content-checkbox')
            .prop('checked', false);
    });
    $('#select_unlabelled').click(function(){
        //Select unlabelled, unlablled cannot be hidden 
        $('#div_logarea').find('.panel-default .logitem-content-checkbox')
            .prop('checked', true);
        //De-select labelled, whether hidden or not
        $('#div_logarea').find('.panel-success .logitem-content-checkbox')
            .prop('checked', false);
    });


    //Filter unlabelled items
    $('#global_filter').click(function(){
        var done_shown = $('#div_logarea').find('.panel-success')
            .filter(function(){
                return !$(this).hasClass('hidden')
            });        

        //If there are labelled panel showing, then hide them all
        if (done_shown.length > 0){
            done_shown.addClass('hidden');
        }
        //If all labelled panels are hidden, then show them
        else{
            $('#div_logarea').find('.panel-success').removeClass('hidden');
        }
//        $('#div_logarea').find('.panel-success').toggleClass('hidden');
    });

    //Select a different date to view log 
    $('#date_dropdown').on('click', '.date-option', function(){
        var year = $(this).attr('year');
        var day = $(this).attr('day');
        var date = new Date(year, 0);
        var count_tot = $(this).attr('count_total');
        var count_todo = $(this).attr('count_todo');
        var count_rm = $(this).attr('count_removed');
        //console.log(count_tot, count_done, count_rm)
        date.setDate(day);
        set_view_date(date, year, day);
        set_progress_bar(count_tot, count_todo, count_rm);
        //reload the tasks and log items
        load_data();
    });

    //Per-item remove, click on modal confirming removing - deprecated
    $('#div_logarea').on('click', '.remove-confirm', function(){
        var item_id = $(this).attr('id').split('_')[2];
        $('#modal_' + item_id).modal('toggle');
        //remove the item
        items = [item_id];
        remove_logitems(items); 
    });

    //Per-item remove
    $('#div_logarea').on('click', '.logitem-remove', function(){
        var item_id = $(this).attr('id').split('_')[2];
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
    
    //Global assign task
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
        //var item_id = $(this).attr('id').split('_')[4];
        $(this).parent().find('.more-candidate').removeClass('hidden');
        $(this).addClass('hidden'); 
        $(this).parent().find('.logitem-label-candidate-less').removeClass('hidden');
    });
    //Per-item show less labels
    $('#div_logarea').on('click', '.logitem-label-candidate-less', function(){
        //var item_id = $(this).attr('id').split('_')[4];
        $(this).parent().find('.more-candidate').addClass('hidden');
        $(this).addClass('hidden'); 
        $(this).parent().find('.logitem-label-candidate-more').removeClass('hidden');
    });


    //Bind scroll for load more
    $(window).scroll(bindScroll);

});

/*================================
    Functions for log annoation
===================================*/
function get_dates(){
    $.ajax({
        type: "POST",
        url: url_ajax_options,
        data: {"data": JSON.stringify({'event': 'get_dates', 
               })}

    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            if (response.res.length == 0)
                $('#div_empty')
                    .html('<p> You have not done anything yet.</p>').removeClass('hidden');
            else{    
                $('#div_empty').addClass('hidden');
                for (var i = 0; i<response.res.length; i++){
                    var key = response.res[i]['_id'];
                    var date = new Date(key.year, 0);
                    date.setDate(key.day)
                    response.res[i].date = date;
                    response.res[i].year = key.year;
                    response.res[i].day = key.day;
                    log_dates_progress.push(response.res[i]);
                }
                set_date_options();

                //By default set the viewing date to the lastest day
                log_dates_progress.sort(function(a, b){
                    return b.date.getTime() - a.date.getTime();
                })
                set_view_date(log_dates_progress[0].date, 
                    log_dates_progress[0].year, log_dates_progress[0].day);
//                console.log(log_dates_progress[0])
                var count_tot = log_dates_progress[0].count_logitem;
                var count_todo = log_dates_progress[0].count_to_annotate;
                var count_rm = log_dates_progress[0].count_removed;
                set_progress_bar(count_tot, count_todo, count_rm);
                //Load data of that day
                load_data(); 
            }
        };
    });
}

function set_view_date(date, year, day){
    view_date.start = new Date(date);
    view_date.end = new Date(date);
    view_date.end.setHours(23, 59, 59, 999)
    $('#global_date_selected').text(date.toDateString()).attr('year', year).attr('day', day);
}

//Set progress bar
function set_progress_bar(count_tot, count_todo, count_rm){
   //Removed
    var rm_perc = Math.round((count_rm)/count_tot*100);
    $('#progress_rm').attr('style', 'width:'+rm_perc + '%');
    $('#progress_rm_label').text(count_rm);
    //Done
    var count_done = count_tot - count_rm - count_todo;
    var done_perc = Math.round((count_done)/count_tot*100);
    $('#progress_done').attr('style', 'width:'+done_perc + '%');
    $('#progress_done_label').text(count_done+'/'+(count_tot-count_rm));
}


//Set the date options on UI
function set_date_options(){
      for (var i = 0; i < log_dates_progress.length; i++){
        var tot = log_dates_progress[i].count_logitem;
        var todo = log_dates_progress[i].count_to_annotate;
        var rm = log_dates_progress[i].count_removed;
        var ele = document.createElement('li');
        ele.setAttribute('year', log_dates_progress[i]['_id'].year);
        ele.setAttribute('day', log_dates_progress[i]['_id'].day);
        ele.setAttribute('count_total', tot);
        ele.setAttribute('count_todo', todo);
        ele.setAttribute('count_removed', rm);
        ele.setAttribute('class', 'date-option');
        var ele_a = document.createElement('a');

        //Set the progress of that date option 
        ele_a.appendChild(document.createTextNode(log_dates_progress[i].date.toDateString()));
        var span_counts = document.createElement('span');
        span_counts.innerHTML = ' (' + (tot-rm-todo) + '/' + (tot-rm) + ')';
        span_counts.setAttribute('class', 'span_counts');
        ele_a.appendChild(span_counts);

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
        data: {"data": JSON.stringify({'event': 'retrieve_candidate_tasks', 
                'time_thresh': view_date})}
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

                    //Corresponding main_task is stored in done to combine with the
                    //done sub
                    if (sub_done.length > 0){
                        var main_sub_done = $.extend(true, {}, response.res[key]);
                        main_sub_done.subtasks = sub_done;
                        more_candidate_tasks.push(main_sub_done);
                    }
                    else{ 
			//No subtasks are done, the main task is also undone, so 		
                        //Corresponding main is stored as undone
                        var main_sub_undone = $.extend(true, {}, response.res[key]);
                        main_sub_undone.subtasks = sub_not_done;
                        candidate_tasks.push(main_sub_undone); 
                    }
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
    candidate_tasks.sort(function(a, b){return b.time_created - a.time_created});
    more_candidate_tasks.sort(function(a, b){return b.time_created - a.time_created});

    //Show general labels
    for (i = 0; i < general_labels.length; i++){
        var ele = document.createElement('li');
        ele.setAttribute('class', 'task_option task_level_0');
        ele.setAttribute('id', 'label_' + general_labels[i].id);
        var ele_a = document.createElement('a');
        var ele_span = document.createElement('span');
        if (general_labels[i].id == '000')
             ele_span.setAttribute('class', 'label label-danger');
        else
            ele_span.setAttribute('class', 'label label-warning');
        ele_span.innerHTML = general_labels[i].label;
        ele_a.appendChild(ele_span);
        ele.appendChild(ele_a);
        list.insertBefore(ele, document.getElementById('divider'));
    }

    //Only show the "canddiate_tasks"
    for (var i = 0; i<candidate_tasks.length; i++){
        var ele_tasks = create_tasklabel_element(candidate_tasks[i])
        //append to list
        for(var j = 0; j < ele_tasks.length; j++){
            list.insertBefore(ele_tasks[j], document.getElementById('divider'));
        }
    }
    //Add "more tasks"
    for(var i = 0; i < more_candidate_tasks.length; i++){
        var ele_tasks = create_tasklabel_element(more_candidate_tasks[i]);
        for(var j = 0; j < ele_tasks.length; j++){
            ele_tasks[j].className += ' task-more task-more-main hidden';
            list.appendChild(ele_tasks[j], document.getElementById('task_option_new'));
        }
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
        data: {"data": JSON.stringify({'event': 'get_log', 
                'time_start': view_date.start,
                'time_end': view_date.end,
               })}
    }).done(function(response) {
        if (response.err){
            console.log(response.emsg)
            $('#div_logarea').append(
                '<div class="err">' + response.emsg.name + ': '+response.emsg.$err + '</div>'
            );
        }
        else{
            log_data = response.res;
            display_log(response.res);
        }
    });
}


//Display log items
function display_log(log){
    $('#div_logarea').html('');

    //make candidate labels
    var labels = logitem_load_candidates();

    //make elements without setting IDs specific to an item
    div_item_template = create_logitem_elements(labels);

    var items = document.createDocumentFragment();
    var counts = batch_size;
    if (batch_size > log.length)
        counts = log.length;
    //Only load the first batch
    //time1 = new Date().getTime()
    for (var i = 0; i<counts; i++){
        var div_item = assemble_logitem_elements(div_item_template, log[i]);
        items.appendChild(div_item);
    }
   //time2 = new Date().getTime()
   //console.log(time2-time1)
 
    $('#div_logarea').append(items);
    //Initialise tooltip
    $('[data-toggle="tooltip"]').tooltip();
}

//Continuous loading
function load_more()
{
    //Chcek how many results are loaded 
    var shown = $('#div_logarea').find('.panel').length;
    var tot = log_data.length;
    if (shown < tot){
        var counts = tot;
        if (shown + batch_size < tot)
            counts = shown + batch_size;
        //Load more results
        var items = document.createDocumentFragment();
        for(var i = shown; i < counts; i++){
            var div_item = assemble_logitem_elements(div_item_template, log_data[i]);
            items.appendChild(div_item);
        }
        $('#div_logarea').append(items);
        //Initialise tooltip
        $('[data-toggle="tooltip"]').tooltip();
    }
    $(window).bind('scroll', bindScroll);
}

function bindScroll(){
   if($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
       $(window).unbind('scroll');
       load_more();
   }
}

//For each item, the annotation property should have the
//following structure:
//{task: {taskid: xx, name: yy}, useful: true/false}
function create_logitem_elements(ele_candidate_labels){
    var elements = {};
    //Logitem area
    //Div item
    var div_item = document.createElement('div');
    div_item.setAttribute('class', 'panel panel-default');

    //Logitem content
    var div_item_content = document.createElement('div');
    div_item_content.setAttribute('class', 'panel-heading logitem-content');
    //Make a sub division for div_content
    var div_item_content_sub1 = document.createElement('div');
    var div_item_content_sub2 = document.createElement('div');

    //Logitem content - checkbox
    var checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('class', 'logitem-content-checkbox');

    //Logitem content - type icon - to be set
    var icon = document.createElement('span');
    icon.setAttribute('class', 'logitem-icon');

    //Logitem content - Query or Title of page - to be set
    var text = document.createElement('span');
    text.setAttribute('class', 'panel-title logitem-title');

    //Logitem content - time
    var time = document.createElement('span');
    time.setAttribute('class', 'logitem-time');

    //Logitem content - remove button
    var remove = document.createElement('button');
    remove.setAttribute('class', 'close logitem-remove');
    remove.innerHTML = ['<span aria-hidden="true", data-toggole="tooltip"',
        'data-placement="left", title="Remove this item from log"',
        '>',
        '&times;',
        '</span>',
        ].join('\n');

    //Skip removal confirm dialog
//    remove.setAttribute('data-toggle', 'modal');
 
    //Logitem labels 
    var div_item_label = document.createElement('div');
    div_item_label.setAttribute('class', 'panel-body logitem-label');

    //Logitem label - chosen label
    var div_chosen_label = document.createElement('div');
    div_chosen_label.setAttribute('class', 'logitem-label-chosen');
    div_chosen_label.setAttribute('taskid', '');
    div_chosen_label.setAttribute('taskname', '');

    //Logitem label - chosen label - explaning text - to be set
    var span_label_text = document.createElement('span');
    span_label_text.setAttribute('class', 'label-text');

    //Logitem label - chosen label - task name - to be set
    var span_label_task = document.createElement('span');
    span_label_task.setAttribute('class', 'label label-info');

    //Logitem label - candidates
    var div_candidates = document.createElement('div');
    div_candidates.setAttribute('class', 'logitem-label-candidates');
    div_candidates.innerHTML = ele_candidate_labels.innerHTML;

    //Logitem label - useful
    var div_useful = document.createElement('div');
    div_useful.setAttribute('class', 'logitem-useful panel-footer');
    div_useful.setAttribute('useful', '');
    //Logitem label - useful - options
    var span_useful_true = document.createElement('span');
    span_useful_true.setAttribute('class', 'label label-default logitem-useful-option logitem-useful-yes');
    span_useful_true.innerHTML = 'USEFUL'
    var span_useful_false = document.createElement('span');
    span_useful_false.setAttribute('class', 'label label-default logitem-useful-option logitem-useful-no');
    span_useful_false.innerHTML = 'NOT USEFUL';

    /* Skip using removal confirm, too much work for user */
    //var div_modal = logitem_create_remove_modal();
    //elements.div_modal = div_modal;
 
    elements.checkbox = checkbox;
    elements.icon = icon;
    elements.text = text;
    elements.time = time;
    elements.div_item_content = div_item_content;
    elements.div_item_content_sub1 = div_item_content_sub1;
    elements.div_item_content_sub2 = div_item_content_sub2;
 
    elements.remove = remove;
    elements.span_label_text = span_label_text;
    elements.span_label_task = span_label_task;
    elements.div_chosen_label = div_chosen_label;
    elements.div_candidates = div_candidates;
    elements.div_item_label = div_item_label;

    var span_useful_text = document.createElement('span');
    span_useful_text.setAttribute('class', 'logitem-useful-text');
    span_useful_text.innerHTML = 'For what I was doing, I find this page ';

    elements.span_useful_text = span_useful_text;
    elements.span_useful_true = span_useful_true;
    elements.span_useful_false = span_useful_false;
    elements.div_useful = div_useful;
    elements.div_item = div_item;

    return elements;
}

function assemble_logitem_elements(elements, item){
    //Set attribute of div_item
    var div_item = elements.div_item.cloneNode(false);
    div_item.setAttribute('id', 'logitem_' + item['_id']);
    div_item.setAttribute('event_type', item.event);

    //Set attribute of div_item_content 
    var div_item_content = elements.div_item_content.cloneNode(false);
    div_item_content.setAttribute('id', 'logitem_content_' + item['_id']);
    var div_item_content_sub1 = elements.div_item_content_sub1.cloneNode(false);
    var div_item_content_sub2 = elements.div_item_content_sub2.cloneNode(false);

    var checkbox = elements.checkbox.cloneNode(false);
    checkbox.setAttribute('id', 'logitem_content_checkbox_' + item['_id']); 

    var time = elements.time.cloneNode(false);
    time.innerHTML = new Date(item.timestamp).toLocaleTimeString();

    var remove = elements.remove.cloneNode(true);
    remove.setAttribute('id', 'logitem_remove_' + item['_id']);
    //Skip the confirm dialog
//    remove.setAttribute('data-target', '#modal_' + item['_id']);

    var div_item_label = elements.div_item_label.cloneNode(false);
    div_item_label.setAttribute('id', 'logitem_label_' + item['_id']);

    var div_chosen_label = elements.div_chosen_label.cloneNode(false);
    div_chosen_label.setAttribute('id', 'logitem_label_chosen_' + item['_id']);

    var span_label_task = elements.span_label_task.cloneNode(false);
    span_label_task.setAttribute('id', 'logitem_label_chosen_taskname_' + item['_id']);
 
    var div_candidates = elements.div_candidates.cloneNode(true);
    div_candidates.setAttribute('id', 'logitem_label_candidates_' + item['_id']);

    var div_useful = elements.div_useful.cloneNode(false);
    div_useful.setAttribute('id', 'logitem_useful_' + item['_id']);
    var span_useful_text = elements.span_useful_text.cloneNode(true);
    var span_useful_true = elements.span_useful_true.cloneNode(true);
    span_useful_true.setAttribute('id', 'logitem_useful_true_' + item['_id']);
    var span_useful_false = elements.span_useful_false.cloneNode(true);
    span_useful_false.setAttribute('id', 'logitem_useful_false_' + item['_id']);

    //Skip the removal dialog
    //var div_modal = elements.div_modal.cloneNode(true);
    //div_modal.setAttribute('id', 'modal_' + item['_id']);
    //div_modal.getElementsByClassName('remove-confirm')[0].setAttribute('id', 'remove_confirm_' + item['_id']);
    
    var icon = elements.icon.cloneNode(false);
    var text = elements.text.cloneNode(false);
    var icon_literal = '';
    //Depending on the type of item, and the annotation status, 
    //set properties and content of the log items 
    if (item.event == 'tab-search'){
        //Set icon type
        icon.className += ' glyphicon glyphicon-search logitem-icon';
        icon_literal = '<span class="glyphicon glyphicon-search logitem-icon"></span>'
        //Set logitem content
        text.innerHTML = '"' + decodeURI(item.details.query.replace(/\+/g, ' ')) + '"';

       //Set chosen label explaining text
        var span_label_text = elements.span_label_text.cloneNode(false);
        span_label_text.innerHTML = "I was <i>searching</i> for: ";

        if ('task' in item.annotation){
            //Set chosen task label
            span_label_task.innerHTML = item.annotation.task.name;
 
           //Set values of chosen label
            div_chosen_label.setAttribute('taskid', item.annotation.task.taskid);
            div_chosen_label.setAttribute('taskname', item.annotation.task.name);
            //Set labeling done
            div_item.setAttribute('class', 'panel panel-success');
        } 
        div_useful.className += ' hidden';
        //set search penel style
        div_item.className += ' panel-search'
   }
   else{
        //Set icon type
        icon.className += ' glyphicon glyphicon-globe logitem-icon';
        icon_literal = '<span class="glyphicon glyphicon-globe logitem-icon"></span>';
        //Set logitem text
        text.innerHTML = '<a href="'+item.url+'">' + item.details.current_tab.title + '</a>';

        //Add page url to it
        var pageurl = document.createElement('div'); 
        pageurl.setAttribute('class', 'pageview-url');
        var item_url = item.url;
        if(item_url.length > 100){
            item_url = item_url.slice(0, 80) + '...';
        }
        console.log(item.url.length, item.url)
        console.log(item_url)
        pageurl.innerHTML = item_url;
        div_item_content_sub2.appendChild(pageurl);

        //Set chosen label explaining text
        span_label_text = elements.span_label_text.cloneNode(false);
        span_label_text.innerHTML = 'I was <i>browsing</i> for: ';
        //Set chosen label
        var task_done = true;
        if ('task' in item.annotation){
            //Set chosen task label
            span_label_task.innerHTML = item.annotation.task.name;
 
            //Set values of chosen label
            div_chosen_label.setAttribute('taskid', item.annotation.task.taskid);
            div_chosen_label.setAttribute('taskname', item.annotation.task.name);
        } 
        else
            task_done = false;
        //Set useful label
        if ('useful' in item.annotation){
            if (item.annotation.useful)
                span_useful_true.setAttribute('class',
                    'label label-success logitem-useful-option logitem-useful-yes');
            else
                span_useful_false.setAttribute('class',
                    'label label-danger logitem-useful-option logitem-useful-no');
            //set chosen useful label
            div_useful.setAttribute('useful', item.annotation.useful);
        }
        else
            task_done = false;
        if(task_done)
            div_item.setAttribute('class', 'panel panel-success'); 
        //set browsing panel style
        div_item.className += ' panel-browse'
    }


    //Skip removal dialog
   // var message = [
   // '<div class="alert alert-danger">',
   // '<h4><strong>Warning</strong> - removing item from log </h4>',
   // icon_literal,
   // text.innerHTML,
   // '</div>',
   // '<h5>Are you sure that you would like this item to be removed from your log?</h5>',
   // ]
   // div_modal.getElementsByClassName('modal-body')[0].innerHTML = message.join('\n');

    div_item_content_sub1.appendChild(checkbox);
    div_item_content_sub1.appendChild(icon); 
    div_item_content_sub1.appendChild(text);
    div_item_content_sub1.appendChild(time);
    div_item_content_sub1.appendChild(remove);
    //div_item_content.appendChild(div_modal);
    div_item_content.appendChild(div_item_content_sub1);
    div_item_content.appendChild(div_item_content_sub2);
    div_item.appendChild(div_item_content)

    div_chosen_label.appendChild(span_label_text);
    div_chosen_label.appendChild(span_label_task);
    div_item_label.appendChild(div_chosen_label);
    div_item_label.appendChild(div_candidates);
    div_item.appendChild(div_item_label);

    div_useful.appendChild(span_useful_text);
    div_useful.appendChild(span_useful_true);
    div_useful.appendChild(span_useful_false);
    div_item.appendChild(div_useful);
    return div_item;
}

//Show candidate tasks
function logitem_load_candidates(){
    var div_candidates = document.createElement('div');
    //Load general labels
    var list1 = document.createDocumentFragment();
    for (var i = 0; i < general_labels.length; i++){
        var ele_general = document.createElement('span');
        if (general_labels[i].id == '000')
            ele_general.setAttribute('class', 'label label-danger logitem-label-candidate');
        else
            ele_general.setAttribute('class', 'label label-warning logitem-label-candidate');
        ele_general.setAttribute('id', 'logitem_label_candidate_' + general_labels[i].id);
        ele_general.innerHTML = general_labels[i].label;
        list1.appendChild(ele_general);
    }
    //Sort labels by time 
    candidate_tasks.sort(function(a, b){return b.time_created - a.time_created});
    more_candidate_tasks.sort(function(a, b){return b.time_created - a.time_created});

    //option - show more
    var ele_more = document.createElement('span');
    ele_more.setAttribute('class', 'logitem-label-candidate-more');
    ele_more.innerHTML = 'Show more ...';

    //high priority candidates
    for (var i = 0; i<candidate_tasks.length; i++){
        //process tasks with subtasks
        var task = candidate_tasks[i];
        if (task.task_level == 0 && task.subtasks.length > 0){
            for(var j = 0; j < task.subtasks.length; j++){
                var taskid = task.subtasks[j]['_id'];                   
                var taskname = task.subtasks[j].task;
                var parentname = task.task;
                var ele = logitem_create_candidate_label(taskid, taskname, parentname);
                if (i >= max_candidates)
                    ele.className += ' more-candidate hidden';
                list1.appendChild(ele);
            }
        }
        else{
            var ele = logitem_create_candidate_label(task['_id'], task.task, '');
            if (i >= max_candidates)
                ele.className += ' more-candidate hidden';
            list1.appendChild(ele);
        }
        if (i == max_candidates)
            list1.appendChild(ele_more);
    }
    if (i <= max_candidates)
        list1.appendChild(ele_more);

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
                list1.appendChild(ele);
            }
        }
        else{
            var ele = logitem_create_candidate_label(task['_id'], task.task, '');
            ele.className += 'more-candidate hidden';
            list1.appendChild(ele);
        }
    }
    //option - show less
    var ele = document.createElement('span');
    ele.setAttribute('class', 'logitem-label-candidate-less more-candidate hidden');
    ele.innerHTML = 'Show less ...';
    list1.appendChild(ele);

    div_candidates.appendChild(list1);
    return div_candidates;
}

function logitem_create_candidate_label(taskid, taskname, parentname){
    var name = '';
    if (parentname == ''){
        if (taskname.length > 30)
            taskname = taskname.substring(0, 30) + '...';
        name = taskname; 
    } 
    else{
        if (taskname.length > 15) 
            taskname = taskname.substring(0, 15) + '...';
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

function logitem_create_remove_modal(){
    //var time1 = new Date().getTime();
    //Modal
    var div_modal = document.createElement('div');
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
    //var div_title = document.createElement('h4');
    //div_title.setAttribute('class', 'modal-title');
    //div_modal_header.appendChild(div_title);

    //Modal - body
    var div_modal_body = document.createElement('div');
    div_modal_body.setAttribute('class', 'modal-body');
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

    btn_yes.innerHTML = 'Yes';
    div_modal_footer.appendChild(btn_no);
    div_modal_footer.appendChild(btn_yes);

    div_modal_content.appendChild(div_modal_header);
    div_modal_content.appendChild(div_modal_body);
    div_modal_content.appendChild(div_modal_footer);
    div_modal_dialog.appendChild(div_modal_content);
    div_modal.appendChild(div_modal_dialog);
    //var time2  = new Date().getTime()
    //console.log(time2 - time1)
    return div_modal;
}


// remove items from log - mark the log item as "remove"
function remove_logitems(items){
    $.ajax({
        type: "POST",
        url: url_ajax_annotation,
        data: {"data": JSON.stringify({'event': 'remove_logitems', 
                'items': items,
               })}
    }).done(function(response) {
        if (response.err){
            console.log(response.err)
        }
        else{
            //remove this element from UI
            for(var i = 0; i < items.length; i++){
                var ele = $('#logitem_' + items[i]);
                //update progress 
                var done = ele.hasClass('panel-success');
                ele.remove(); 
                update_progress('remove', 1, done); 
            }
        }
    });
}

//Submit the label of usefulness of single log item
function submit_labels_useful(id, value){
     $.ajax({
        type: "POST",
        url: url_ajax_annotation,
        data: {"data": JSON.stringify({'event': 'submit_labels_useful', 
                'id': id,
                'value': value,
               })}
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
            //Set value to useful div
            $('#div_logarea').find('#logitem_useful_' + id).attr('useful', value);
            //Set the panel to done if it also has task set
            var task = $('#div_logarea').find('#logitem_label_chosen_' + id).attr('taskid');
            if (task != ''){ 
                //Done another annotation, update progress
                if ($('#div_logarea').find('#logitem_' + id).hasClass('panel-default'))
                    update_progress('done', 1, false);
                $('#div_logarea').find('#logitem_' + id)
                    .removeClass('panel-default').addClass('panel-success');
           }
       }
    });
}
//Submit the task labels
function submit_labels_task(items, taskid, taskname){
     $.ajax({
        type: "POST",
        url: url_ajax_annotation,
        data: {"data": JSON.stringify({'event': 'submit_labels_task', 
                'items': items, 
                'taskid': taskid,
                'taskname': taskname,
               })}
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
                //Set the value to the chosen div
                $('#div_logarea').find(div_id).attr('taskid', taskid).attr('taskname', taskname);
                //Set item to done if it's done
                var event_type = $('#div_logarea').find('#logitem_' +
                        items[i]).attr('event_type');
                var panel_id = '#logitem_' + items[i];
    
                if (event_type == 'tab-search'){
                    if ($('#div_logarea').find(panel_id).hasClass('panel-default')){
                        //Done another annotation, update progress
                        update_progress('done', 1, false);
                    }
                    $('#div_logarea').find(panel_id).removeClass('panel-default').addClass('panel-success');
                }
                else if(event_type == 'tab-loaded'){
                    var useful = $('#div_logarea').find('#logitem_useful_' + items[i]).attr('useful');
                    //console.log(useful);
                    if (useful != ''){
                        if($('#div_logarea').find(panel_id).hasClass('panel-default'))
                            //done another annotation, update progress
                            update_progress('done', 1, false);
                        $('#div_logarea').find(panel_id).removeClass('panel-default').addClass('panel-success');
                    }
                }
            }
        }
    });
   
}

function update_progress(type, count, done){
    //Find the the currently viewed date where changes happen
    var view_year = $('#global_date_selected').attr('year');
    var view_day = $('#global_date_selected').attr('day');
    var ele = $('.date-option[year="'+view_year+'"][day="'+view_day+'"]');

    var count_todo = parseInt(ele.attr('count_todo'));
    var count_removed = parseInt(ele.attr('count_removed'));
    var count_total = parseInt(ele.attr('count_total'));

    if (type == 'done'){
        count_todo = count_todo - count;
        ele.attr('count_todo', count_todo);
    }
    else if (type == 'remove'){
        count_remove = count_removed + count;
        ele.attr('count_removed', count_remove);
        if (!done){
            count_todo = count_todo - count;
            ele.attr('count_todo', count_todo);
        }
    }
    set_progress_bar(ele.attr('count_total'), ele.attr('count_todo'), ele.attr('count_removed'));
    ele.find('.span_counts').html( 
        '('+ count_todo +'/'+ (count_total - count_removed) +')');

}








