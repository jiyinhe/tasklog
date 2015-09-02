var url_ajax_tasks = '/users/ajax_tasks';

$(document).ready(function(){
    //Initialize tooltips
    $('[data-toggle="tooltip"]').tooltip();
    
    //show the counts
    get_counts();

    //load the tasks
    load_tasks();

    //when click on accomplished tasks
    $('#link_done').click(function(){
        $('#li_done').addClass('active');
        $('#li_todo').removeClass('active');
        $('#plan_options').addClass('hidden');
        load_done_tasks();
    });    

    //when click on my plan and tasks
    $('#link_todo').click(function(){
        $('#li_todo').addClass('active');
        $('#li_done').removeClass('active');
        $('#plan_options').removeClass('hidden');
        load_tasks();
    });

    // Click on a main-task-text to show/hide subtasks
    $('#div_planlist').on('click', '.main-task', function(){
        $('[parent='+$(this).attr('id')+']').toggleClass('hidden');
    });

    //TODO: add task
    $('#input_addtask').keyup(function(e){
        //Type a task and press Enter
        if (e.keyCode == 13){
            add_task({'level:': 0, 'parent': 0});
        }
    });

    //TODO: add subtask
    //TODO: remove an item
    //TODO: done a task
    //TODO: refresh a done task
    //TODO: move done tasks to done and update the counts
    //TODO: expand all subtasks
    //TODO: collapse all subtasks
});


//display the stored tasks
function load_tasks(){
    $.ajax({
        type: "POST",
        url: url_ajax_tasks,
        data: {'event': 'retrieve_tasks'}
    }).done(function(response) {
        if (response.err){
            $('#div_addtask').append(
                '<div class="err">' + response.emsg + '</div>'
            );
        }
        else{
            display_tasks(response.res, 'todo');
        }
    });
}

//display finished tasks
function load_done_tasks(){
    $.ajax({
        type: "POST",
        url: url_ajax_tasks,
        data: {'event': 'retrieve_done_tasks'}
    }).done(function(response) {
        if (response.err){
            $('#div_addtask').append(
                '<div class="err">' + response.emsg + '</div>'
            );
        }
        else{
            display_tasks(response.res, 'done');
        }

    });

}

function get_counts(){
     $.ajax({
        type: "POST",
        url: url_ajax_tasks,
        data: {'event': 'retrieve_task_counts'}
     }).done(function(response) {
        if (!response.err){
            if (response.res[0]['_id'] == true){
                $('#count_done').text('('+response.res[0]['number'] + ')');
                $('#count_todo').text('('+response.res[1]['number'] + ')');
            }
            else{
                $('#count_done').text('('+response.res[1]['number'] + ')');
                $('#count_todo').text('('+response.res[0]['number'] + ')');
            }
        }
    });
   
}

// "todo" tasks may include done items, tagged by done=false, done_time > 0
// "done" tasks contain tasks that are done and users prefer to put them 
// in the "done" category, with done=true, done_time > 0
// If a task is not done, done_time = 0
function display_tasks(main_tasks, type){
    $('#div_planlist').html('');
    //sort by date for main tasks
    var task_array = $.map(main_tasks, function(value, index){return [value]});
    task_array.sort(function(a, b){return b.refresh - a.refresh})
    for (var i = 0; i<task_array.length; i++){
        //show the main task
        var ele_main_task = document.createElement('div');
        ele_main_task.setAttribute('class', 'main-task');
        ele_main_task.setAttribute('id', task_array[i]['_id']);
        ele_main_task.setAttribute('refresh', task_array[i].refresh);
        ele_main_task.setAttribute('time_done', task_array[i].time_done);
 
        //Add the input checkbox
        var checkbox = document.createElement('input');
        checkbox.setAttribute('id', 'checkbox_'+task_array[i]['_id']);
        checkbox.setAttribute('type', 'checkbox');
        //done status
        if (task_array[i]['time_done'] > 0){
            checkbox.setAttribute('checked', true);
            ele_main_task.className += ' task-done';
        }
        //if a level 0 task is on "done", it can only change from status
        //done to not done, not the other way around, as there are other
        //subtasks that are not done
        if (type == 'done' && task_array[i]['time_done'] == 0){
            checkbox.disabled = true;    
        }
        ele_main_task.appendChild(checkbox);

        //Add the task
        var main_task_text = document.createElement('span');
        main_task_text.appendChild(document.createTextNode(' '+task_array[i].task));
        if (task_array[i].subtasks.length > 0){
            main_task_text.setAttribute('class', 'main-task-with-subtask');
        }
        ele_main_task.appendChild(main_task_text);
        //button to add new subtask
        if (type == 'todo'){
            var add_subtask = document.createElement('span');
            add_subtask.setAttribute('id', 'add_subtask_'+task_array[i]['_id']);
            add_subtask.setAttribute('class', 'add-subtask');
            add_subtask.innerHTML = '+Todo';
            add_subtask.setAttribute('data-toggle', 'tooltip');
            add_subtask.setAttribute('title', 'Add a todo for the task');
            ele_main_task.appendChild(add_subtask);
        }
        //Add the remove sign
        if (type == 'todo'){
            var remove = document.createElement('span');
            remove.setAttribute('id', 'rm_'+task_array[i]['_id']);
            remove.setAttribute('class', 'glyphicon glyphicon-remove');
            remove.setAttribute('data-toggle', 'tooltip');
            remove.setAttribute('title', 'Remove this item');
            ele_main_task.appendChild(remove); 
        }

        $('#div_planlist').append(ele_main_task);
        //show the subtasks
        var subtasks = task_array[i].subtasks;
        subtasks.sort(function(a, b){return b.refresh - a.refresh});
        for (var j = 0; j < subtasks.length; j++){
            var ele_subtask = document.createElement('div');
            ele_subtask.setAttribute('class', 'subtask');
            ele_subtask.setAttribute('id', subtasks[j]['_id']);
            ele_subtask.setAttribute('parent', task_array[i]['_id']);
            ele_subtask.setAttribute('refresh', subtasks[j].refresh);
            ele_subtask.setAttribute('time_done', subtasks[j].time_done);
            //Add the input checkbox
            var checkbox = document.createElement('input');
            checkbox.setAttribute('id', 'checkbox_'+subtasks[j]['_id']);
            checkbox.setAttribute('type', 'checkbox');
            if (subtasks[i]['time_done'] > 0){
                checkbox.setAttribute('checked', true);
                ele_subtask.className += ' task-done';
            }
            ele_subtask.appendChild(checkbox);
            //Add the task
            ele_subtask.appendChild(document.createTextNode(' '+subtasks[j].task));
            // Add the remove sign
            if (type == 'todo'){
                var remove = document.createElement('span');
                remove.setAttribute('id', 'rm_'+subtasks[j]['_id']);
                remove.setAttribute('class', 'glyphicon glyphicon-remove');
                remove.setAttribute('data-toggle', 'tooltip');
                remove.setAttribute('title', 'Remove this item');
                ele_subtask.appendChild(remove);
            }
            $('#div_planlist').append(ele_subtask);
        }
    }
    //enable tooltips
    $('[data-toggle="tooltip"]').tooltip();
}

function add_task(param){
     param['event'] = 'add_task'
     $.ajax({
        type: "POST",
        url: url_ajax_tasks,
        data: param
    }).done(function(response) {
    }  
}


