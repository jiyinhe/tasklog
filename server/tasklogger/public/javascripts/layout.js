function affixWidth() {
    // ensure the affix element maintains it width
    var affix = $('.affix');
//    var width = affix.width() + 100;
    var width = $('.right_column').width();
    console.log(width)
    affix.width(width);
}

$(document).ready(function () {

    affixWidth();

});
