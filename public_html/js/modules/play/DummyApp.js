define(["modules/play/GameApp"],function(GameApp){

    var app = new GameApp();

    app.baseHtml.append('<div id="noGameLoadedDisplay">No Game Loaded!<br>Load a game from your <a href="javascript:void(0)" modulename="library">Library</a>.</div>');


    return app;
});