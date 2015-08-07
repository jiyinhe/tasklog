//the URL to submit registration info
var register_url="/users/register_user";

$(document).ready(function () {

// When submit button is clicked 
$('#reg_btn').click(function(){
	validate_registration_form();	
});

});//document

function validate_registration_form(){
	rules = {
		'user': {'required': true },
		'email': {'required': true, 'email': true},
		'pass1': {'required': true },
		'pass2': {'required': true, 'equals': 'pass1'},
	};
	
	errs = validate(rules);
	success = true;
	for (r in rules){
		if (r in errs){
			//Show error message
			$('#err_'+r).html(errs[r]);
			//Show error sign
			//$('#errsign_'+r).removeClass('errsign-valid').addClass('errsign-err');
			success = false;	
		}
		else{
			//remove error message
			$('#err_'+r).html('');
			//remove error sign
			//$('#errsign_'+r).removeClass('errsign-err').addClass('errsign-valid');	
		}
	}	
	//Try to register, fail if username is taken
	if (success){
		register($('#user').val(), $('#email').val(), $('#pass1').val());
	}
}	

function register(user, email, pass){
        console.log('before register');
        $.ajax({
                type: "POST",
                url: register_url,
                data: {
                        ajax_event: 'register',
			            user: user,
			            email: email,
			            pass: pass,
                    }
        }).done(function(response) {
            if (response['err']){
                //db err
                if (response['errtype'] == 'db')
                    $('#err_db').html(response['emsg']);        
                //email err
                else if (response['errtype'] == 'email')
                    $('#err_email').html(response['emsg']);
            }
            // otherwise do the succesful login                
            else{
                $('#login_email').val(email);
                $('#login_pass').val(pass);
                console.log($('#login_email'))
                $('#login_form').submit();
            }             
        });
}


