var max_num_results = 50;
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
//    console.log('form_submit')
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


function wait_loading(){
    
    //if page is not loaded, keep waiting
    
    //if loaded, send response
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.msg == 'serp loaded'){
        var compress = ''
        if (msg.media in ['maps', 'flights', 'explore', 'local']){
            compress = ''
        }
        else{ 
            var ele = ''
            if (msg.se == 'google'){
                ele = 'ires';
            }
            else if (msg.se == 'bing'){
                ele = 'b_content';
                if (msg.media == 'news')
                    ele = 'VerpContent';
            }
            else if (msg.se == 'yahoo'){
                ele = 'bd';
                if (msg.media == 'images')
                    ele = 'mdoc'
            }
            if (ele != ''){
                res = document.getElementById(ele);
                html = res.innerHTML;
                //Check every 500 ms
                var wait_load = setInterval(function(){
                    res = document.getElementById(ele)
                    console.log(res)
                    done = (html == res.innerHTML);
                    if (done){
                        //stop interval, send response
                        clearInterval(wait_load);
                        //check for content length
                        var serp = res.innerHTML;
                        compress = pako.deflate(serp, {'to': 'string'})
                        console.log(compress.length/1024)
                        //check size
                        if (compress.length/1024 > 500){
                            //limit the number of results
                            if (msg.se == 'google'){
                                if (msg.media == 'images'){
                                    var newele = document.createElement('div');
                                    newele.setAttribute('id', 'ires');

                                    //Keep fc element
                                    var fc = document.getElementById('fc');
                                    //limit number of image results
                                    var rg = document.getElementById('rg');
                                    links = rg.getElementsByTagName('a');
                                    var counts = links.length;
                                    if (max_num_results < counts)
                                        counts = max_num_results;
                                    var rg_new = document.createElement('div');
                                    rg_new.setAttribute('id', 'rg');
                                    for(var i = 0; i < counts; i++)
                                        rg_new.appendChild(links[i]); 
                                    newele.appendChild(fc);
                                    newele.appendChild(rg_new);
                                    compress=pako.deflate(newele.innerHTML, {'to': 'string'})
                                }
                                else if (msg.media == 'shopping'){
                                    //remove large image data
                                    reg_src = /src="data:image\/.+?"/g;
                                    var tmp = serp.replace(reg_src, 'src=""', {'to': 'string'})
                                    compress = pako.deflate(tmp, {'to': 'string'})
                                }
                            }
                        }
                        console.log(compress.length/1024)
                        sendResponse({'serp': compress});
                    }
                    else
                        html = res.innerHTML;
                }, 1000);
            }
        }
    }
    return true;
});
