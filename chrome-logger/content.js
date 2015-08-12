// bind listeners to forms
//for (var i = 0; i < document.forms.length; i++){
//    document.forms[i].addEventListener("submit", function(){
//        var data = get_form_content(this);
//        var ts = (new Date()).getTime();
//        chrome.extension.sendMessage({
//            'name': 'form_submit', 'data': data, 'timestamp': ts});
//    });
//}

// jquery version
$(document).on('submit', 'form', function(){
    var data = get_form_content($(this));
    var ts = (new Date()).getTime();
    chrome.runtime.sendMessage({
       'name': 'form_submit', 'data': data, 'timestamp': ts
    });
});

// collect form data recursively
function get_form_content(form){
//    var inputs = form.getElementsByTagName('input');
    var inputs = form.find('input');
    var data = []
    for (var i = 0; i < inputs.length; i++){
        var type = inputs[i].type;
        if (type == 'submit' || type == 'hidden')
            continue
        var value = inputs[i].value;
        var name = ''
        if (!(inputs[i].name === ''))
            name = inputs[i].name  
        // check if the user is typing password, if so, don't record it.
        if (type == 'password')
            value = '********'
        data.push({
            'type': type,
            'value': value,
            'name': name
        }) 
    }
    return data
}

// Listen to url click events
$(document).on('click', 'a', function(){
    var ts = (new Date()).getTime();
    var data = {
        'anchor': $(this).text(),
        'url': $(this).attr('href') 
    }   
    chrome.runtime.sendMessage({
        'name': 'link_click', 'data': data, 
        'timestamp': ts
    });
})
