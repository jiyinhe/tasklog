//Global variables
var url_submit_todo = '/users/submit_todo'

$(document).ready(function(){
    //Add a task
    $("#btn_addtask").click(function(){
        var task = $('#input_addtask').val();
        var create_time = (new Date()).getTime();
        //send task to server
        if (task != ''){
            var data = {
                'event': "add_task",
                'task': task,
                'create_time': create_time,
                'level': 0,
                'parent': 0,
            };
            submit_to_server(data);
        }
    });

    //when a task is checked to be done/undone
    $('#tasks_today').on('change', ':checkbox', function(){
        var task_id = $(this).attr('id').split('_')[1];
        //change the status of the checked task
        var time = (new Date()).getTime();
        var tasks = []

        var time_done = 0;
        if (this.checked)
            time_done = time
        
        //Current task
        tasks.push(task_id)
        //Related tasks
        if ($('#'+task_id).hasClass('main-task')){
            var subtasks = ($('#'+task_id + '> .subtask'));
            for (var i = 0; i < subtasks.length; i++){
                var time_done_sub = subtasks[i].getAttribute('time_done');

                //a main task is checked, its unfinished subtasks
                //are checked at the same time
                if (this.checked){
                    if (time_done_sub == 0){
                        tasks.push(subtasks[i].getAttribute('id'));
                    }
                }
                else{
                //a main task is unchecked, subtasks that were checked
                //at the same time are also unchecked
                    if (time_done_sub == $('#'+task_id).attr('time_done'))
                        tasks.push(subtasks[i].getAttribute('id'));
                }
            }
        }
        else{
            if (this.checked){
                //a subtask is checked, check if all the subtasks are done for a
                //main-task
                var parent_ele_id = $(this).closest('.main-task')[0].getAttribute('id');
                var all_done = true;
                var all_children = $('#'+parent_ele_id).find('.subtask');
                for(var i = 0; i<all_children.length; i++){
                    if (all_children[i].getAttribute('id') == task_id){
                        continue
                    }
                    if (all_children[i].getAttribute('time_done')=="0"){
                        all_done = false;
                        break;
                    }
                } 
                if (all_done)
                    tasks.push(parent_ele_id);
            }
            else{
                //a subtask is unchecked, unchecked its parent task
                var parent_ele = $(this).closest('.main-task')[0];
                tasks.push(parent_ele.getAttribute('id'));
            }
        }
        
        data = {
            'tasks': tasks,
            'event': 'task_status_change',
            'time': time_done,
            'done': this.checked,
        }
        submit_to_server(data);
    });


    //show the add subtask block
    $("#tasks_today").on('click', ".btn-newsub", function(){
        var id = $(this).attr('id').split('_')[2];
        $('#newsub_'+id).removeClass('newsubtask').addClass('newsubtask-show');
    });

    //to hide the subtask block
    $("#tasks_today").on('click', ".rm-subtask", function(){
        var id = $(this).attr('id').split('_')[2];
        $('#newsub_'+id).removeClass('newsubtask-show').addClass('newsubtask');
    });
    //to add the subtask
    $('#tasks_today').on('click', '.add-subtask', function(){
        var main_taskid = $(this).attr('id').split('_')[2];
        var task = $('#input_newsub_'+main_taskid).val();
        var create_time = (new Date()).getTime();
        //send task to server
        if (task != ''){
            var data = {
                'event': "add_task",
                'task': task,
                'create_time': create_time,
                'parent': main_taskid,
                'level': 1
            };
            submit_to_server(data);
        }

    });

    $('#tasks_today').on('click', '.rm-task', function(){
        var taskid = $(this).attr('id').split('_')[1];
        var level = 0
        var tasks = [taskid]
        if ($('#'+taskid).hasClass('subtask'))
            task_type = 1  
        //when removing a main task, its sub tasks should also be removed
        if (level == 0){
            var subtasks = $('#'+taskid).find('.subtask');
            for (var i = 0; i<subtasks.length; i++){
                tasks.push(subtasks[i].getAttribute('id'));
            }
        }
        var data = {'tasks': tasks, 'event': 'rm_task', 'target_task': taskid}
        submit_to_server(data);
    });
 
    //Refresh a task to today
    //Note: refresh is at the main-task level
    $('.refresh-task').click(function(){
        var taskid = $(this).attr('id').split('_')[1];
        data = {'taskid': taskid, 
                'refresh': (new Date()).getTime(),
                'event': 'refresh' 
                }
        submit_to_server(data)
    });

});

function submit_to_server(data){
    $.ajax({
            type: "POST",
            url: url_submit_todo,
            data: data
        }).done(function(response) {
            if (response.err){
                console.log(response.emsg)
            } 
            else{
                if (data.event == "add_task"){
                    location.reload();
                }
                else if (data.event == "task_status_change")
                    process_task_status_change(response, data)
                else if (data.event == 'refresh')
                    location.reload();
                else if (data.event == 'rm_task')
                    process_rm_task(data);
            }
        });
}

function process_rm_task(data){
    $('#'+data.target_task).remove();
}
/* To much trouble, just reload the page to get it shown
function show_added_task(task){
    var ele = [
        '<div id="'+ task['_id'] +'time_done="'+ task.time_done +'" " class="main-task">',
        '<input type="checkbox" id="checkbox_'+task['_id']+'">',
        '<span id="span_'+ task['_id']+'">',
        task.task,
        '</span>',
        '<span id="rm_'+ task['_id'] +'" class="glyphicon glyphicon-trash rm-task"></span>',
        '<span id="btn_newsub_'+ task['_id'] +'" class="btn-newsub">+Subtask</span>',
        '<div id="newsub_'+task['_id']+'" class="newsubtask form-inline form-add-task ">',
        '-- ',
        '<input type="text" placeholder="New subtask" class="form-control", id="input_newsub_'+task['_id']+'">',
        '<span id="add_newsub_'+task['_id']+'" class="glyphicon glyphicon-plus-sign add-subtask"></span>',     
        '<span id="rm_newsub_'+task['_id']+'" class="glyphicon glyphicon-remove-circle rm-subtask"></span>',
        '</div>',
        '</div>',
    ];
    $("#tasks_today").append(ele.join('\n'));
}

function show_added_subtask(task){
    var ele = [
        '<div class="subtask" id="'+task['_id']+'" time_done="'+task.time_done+'" >',
        '-- ',
        '<input type="checkbox" id="checkbox_'+task['_id']+'">',
        '<span id="span_'+ task['_id']+'">'+task.task+'</span>',
        '<span class="glyphicon glyphicon-trash rm-task" id="rm_'+task['_id']+'"></span>',
        '</div>',
    ];
    console.log($('#tasks_today').find('#'+task['parent']))
    $('#'+task['parent']).append(ele.join('\n'));
}
*/


function process_task_status_change(response, data){
    if (response == 'success'){
        for (var i = 0; i<data.tasks.length; i++){
            var taskid = data.tasks[i];
            //set done time
            $('#'+taskid).attr('time_done', data.time);
            //set div class
            if (data.done){
                $('#span_'+taskid).addClass('task-done');
                $('#checkbox_'+taskid).prop('checked', true);
            }
            else{
                $('#span_'+taskid).removeClass('task-done');
                $('#checkbox_'+taskid).prop('checked', false);
            }
        }
    }
}
