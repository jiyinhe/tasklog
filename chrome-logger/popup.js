$(document).ready(function(){
//When open the popup check if the userid is set 
//If not, show the input for user id, 
//If set, show the userid
var BGPage = chrome.extension.getBackgroundPage();
var userid = BGPage.check_userid();
userid_status(userid);

//Submit userid: 
//Check if ID is valid
//If not, give error message, show input
//If valid, store it in local storage, show ID
$("#submit_userid").click(function(){
    var uid = $('#input_userid').val().replace(/ /g,'');
    
    BGPage.set_userid(uid, function(response){
        if (!response.err){
            userid = BGPage.check_userid();
            userid_status(userid);           
        }
    });
});

//Go to links on new tab
$('body').on('click', 'a', function(){
    chrome.tabs.create({url: $(this).attr('href')});
    return false;
});

//Reset the userid
/*
$('#reset_userid').click(function(){
    BGPage.reset_userid(function(response){
        if (!response.err){
            var current_id = response.current_userid;
            $('#input_userid').attr('placeholder', current_id).prop('disabled', false);
            $('#input_userid').val('');
            $('#submit_userid').removeClass('disabled').addClass('active');
        }
    });
});
*/
});
 

function userid_status(userid){
    if (userid == ''){
        //UserId not set
        $('#input_userid').prop('disabled', false);
        $('#submit_userid').removeClass('disabled').addClass('active');
    }
    else{
        //UserId is set
        //console.log('userid set');
        $('#input_userid').val(userid);
        $('#input_userid').prop('disabled', true);
        $('#submit_userid').removeClass('active').addClass('disabled');
    }
}



