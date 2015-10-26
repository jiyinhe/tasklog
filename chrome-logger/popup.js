$(document).ready(function(){
//When open the popup check if the userid is set 
//If not, show the input for user id, 
//If set, show the userid
var BGPage = chrome.extension.getBackgroundPage();
var userid = BGPage.check_userid();
userid_status(userid);

var blacklist_as_input = BGPage.check_blacklist();
blacklist_status(blacklist_as_input);


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

//Press enter when input blacklist
$('#input_blacklist').keyup(function(e){
    if (e.keyCode == 13){
        var content = $(this).val();
        BGPage.set_blacklist(content, function(response){
             blacklist_as_input = BGPage.check_blacklist();
             blacklist_status(blacklist_as_input);
        });
    }
});

//When click on "Save" when input blacklist
$('#submit_blacklist').click(function(){
    var content = $('#input_blacklist').val();
    BGPage.set_blacklist(content, function(response){
        blacklist_as_input = BGPage.check_blacklist();
        blacklist_status(blacklist_as_input);
    });
});

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

function blacklist_status(blacklist_as_input){
    console.log(blacklist_as_input)
    if (blacklist_as_input != ''){
        $('#input_blacklist').val(blacklist_as_input);
    }
}
