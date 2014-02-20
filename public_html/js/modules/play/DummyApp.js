define(["modules/play/GameApp"],function(GameApp){
    "use strict";

    var app = new GameApp();

    app.baseHtml.append('<div id="noGameLoadedDisplay">No Game Loaded!<br>Load a game from your <a href="javascript:void(0)" modulename="library">Library</a>.</div>');

    app.getHTML = function(){
        return app.baseHtml;
    };

    app.getFPS = function(){
        return 9001;
    };

    app.onResize = function(){};
    app.setVolume = function(v){this.volume = v;} ;
    app.getVolume = function(){return this.volume};
    app.loadGame = function(){};
    app.handleMouseEvent = function(){};
    app.clearButtonStates = function(){};
    app.handleKey = function(){};
    app.start = function(){};
    app.resume = function(){};
    app.pause = function(){};
    app.terminateGame = function(callback){callback();};


    return app;
});