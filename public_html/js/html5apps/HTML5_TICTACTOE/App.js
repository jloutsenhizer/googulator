define(["html5apps/HTML5_TICTACTOE/Header","modules/play/GameApp"],function(header,GameApp){

    var game = new GameApp();

    game.header = header;

    var boardContainer = $("<div style='background:white; display:inline-block;'></div>")
    game.baseHtml.append(boardContainer);

    game.onResize = function(width,height){
        boardContainer.css('width',height + 'px');
        boardContainer.css('height',height  +"px");
    }

    var board = [];
    for (var i = 0; i < 3; i++){
    }

    var boardState = []

    game.loadGame = function(){

    }



    for (var i = 0; i < 3; i++){

    }

    return game;

});