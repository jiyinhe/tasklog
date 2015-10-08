//function affixWidth() {
//    // ensure the affix element maintains it width
//    var affix = $('.affix');
//    var width = affix.width() + 100;
//    var width = $('.right-column').width();
//    affix.width(width);
//}

$(document).ready(function () {
    var initial_affix_width = $('.right-column').width();
    console.log(initial_affix_width)
    $('#myAffix').width(initial_affix_width);
    console.log($('#myAffix').width())
});
