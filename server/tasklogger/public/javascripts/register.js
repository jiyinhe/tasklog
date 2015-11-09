//the URL to submit registration info
var register_url="/users/register_user";

$(document).ready(function () {

// When submit button is clicked 
$('#reg_btn').click(function(){
	validate_registration_form();	
});

//When click on the input box for spcifying "others", don't 
//deselect the checkbox
$('#computer_search_for_other').click(function(){
    //console.log($('#checkbox_search_for_other'))
    $('#checkbox_computer_search_for_other').prop('checked', true);
});

$('#mobile_search_for_other').click(function(){
    //console.log($('#checkbox_search_for_other'))
    $('#checkbox_mobile_search_for_other').prop('checked', true);
});



});//document

function validate_registration_form(){
	rules = {
        'consent': {'required': true, 'terms': true, 'checkbox': true, 'order': 0},
		'user': {'required': true, 'order': 1},
		'email': {'required': true, 'email': true, 'order': 2},
		'pass1': {'required': true, 'order': 3},
		'pass2': {'required': true, 'equals': 'pass1', 'order': 4},
		'gender': {'required': true, 'radio': true, 'order': 5},
		'age': {'required': true, 'radio': true, 'order': 6},
        'profession': {'required': true, 'order': 7},
		'exp_comp': {'required': true, 'radio': true, 'order': 8},
        'exp_se': {'required': true, 'radio': true, 'order': 9},
        'freq_comp': {'required': true, 'radio': true, 'order': 10},
        'comp_work': {'required': true, 'radio': true, 'order': 11},
        'search_device': {'required': true, 'radio': true, 'order': 12},
        'computer_search_for': {'required': true, 'checkbox': true, 'order': 13},
        'mobile_search_for': {'required': true, 'checkbox': true, 'order': 14},
        'computer_search_for_other': {'required': false, order: 15},
        'mobile_search_for_other': {'required': false, order: 16},
        'search_habit': {'required': false, order: 17},
	};
	
	errs = validate(rules);
	success = true;
	data = {'user': '', 'email': '', 'pass': '', 'info': {}};
	focus = undefined;
    err_r = [];
	for (r in rules){
		if (r in errs && errs[r]){
			//Show error message
			$('#err_'+r).html(errs[r]);
			success = false;	
            err_r.push({'name': r, 'order': rules[r].order})
		}
		else{
			//remove error message
			$('#err_'+r).html('');
            if (r == 'user' || r == 'email' ){
                data[r] = $('#' + r).val()
            }
            else if (r == 'pass1' || r == 'pass2')
                data['pass'] = $('#' + r).val();
            else{
			    if("radio" in rules[r]){
				    data['info'][r]=$('input[name="'+r+'"]:checked').val();
			    }
                else if ("checkbox" in rules[r]){
                    var checks = [];
                    $('input[name="' + r +'"]:checked').each(function(){
                        //if ($(this).val() == 'other')
                        //    checks.push($(this).val() + ':' + $('#search_other').val());
                        //else
                        checks.push($(this).val());
                    });
                    data['info'][r] = checks;
                }   
                else{ // get normal value
				    data['info'][r]= $("#"+r).val();
			    }
            }
		}
	}	
    //console.log(data)
	//Try to register, fail if username is taken
	if (success){
	    return register(data);
	}
    else{
        //Focus to the first error 
        err_r.sort(function(a, b){return a.order - b.order});
        focus = err_r[0].name;
        // hack so radio buttons grouped by name are also in focus
		value = $("#"+focus); 
		if(value.length == 0){
			$('[name="'+focus+'"]')[0].focus();					
		}else{
			value.focus();
		}
	}
}	

function register(data){
        $.ajax({
                type: "POST",
                url: register_url,
                data: {
                        ajax_event: 'register',
                        data: JSON.stringify(data)
                    }
        }).done(function(response) {
            if (response['err']){
                //db err
                if (response['errtype'] == 'db')
                    $('#err_db').html(response['emsg']);        
                //email err
                else if (response['errtype'] == 'email')
                    $('#err_email').html(response['emsg']);
                    $('#email').focus();
            }
            // otherwise do the succesful login                
            else{
                $('#login_email').val(data.email);
                $('#login_pass').val(data.pass);
//                console.log($('#login_email'));
                $('#login_form').submit();
            }             
        });
}


