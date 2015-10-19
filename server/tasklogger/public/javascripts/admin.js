$(document).ready(function(){

    $('.btn-viewlog').click(function(){
        $('#input_viewlog').val($(this).attr('id'));
        $('#form_viewlog').submit();
    });

});
