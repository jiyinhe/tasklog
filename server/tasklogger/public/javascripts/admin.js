var url_ajax_admin = '/admin/ajax_requests'

$(document).ready(function(){

    $('.btn-viewlog').click(function(){
        $('#input_viewlog').val($(this).attr('id'));
        $('#form_viewlog').submit();
    });

    $('.btn-serp').click(function(){
        var id = $(this).attr('id').split('_')
        show_serp(id[0], id[1]);
    });

    $('.btn-reminder').click(function(){
        userid = $(this).attr('id');
        send_reminder(userid);
    });
});

function show_serp(userid, timestamp){
    $.ajax({
        type: "POST",
        url: url_ajax_admin,
        data: {'data': JSON.stringify(
            {'event': 'get_serp', 
            'userid': userid, 
            'timestamp': timestamp})},
    }).done(function(response) {
        if (response.err){
            console.log('ERR: ', response.emsg)
        }
        else{
            display_serp(response.res);
        }
    });
}

function display_serp(res){
    var new_window = window.open();
    if (new_window == undefined)
        alert('Pop-up blocked')
    if (res.length == 0){
           new_window.document.write('No SERP was found.')
    }
    else{
        new_window.document.write(
            ['<html>',
                res[0].serp,
            '</html>'].join()
        )
    }
} 

function send_reminder(userid){
    $.ajax({
        type: "POST",
        url: url_ajax_admin,
        data: {'data': JSON.stringify(
            {'event': 'send_reminder', 
            'userid': userid, 
            })},
    }).done(function(response) {
        if (response.err){
            console.log('ERR: ', response.emsg)
        }
        else{
            location.reload(true);
        }
    });

}





