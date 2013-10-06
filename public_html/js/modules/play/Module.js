define(["gbcore/Gameboy", "nescore/nes","modules/play/DummyApp"], function(Gameboy,NES,DummyApp){
    //TODO: this merged UI works but is really messy. Need to normalize an emulator interface and clean this up
    var Module = {};

    var container;
    var canvas;
    var active = false;
    var overlay = null;
    var fullScreenSupported = false;
    var currentGameId = null;
    var currentGameTitle = null;
    var nes = new NES();

    var canvasWidth = 1;
    var canvasHeight = 1;

    var currentApp = DummyApp;

    var forceResizeCanvas = false;

    function updateUrlAndTitle(){
        Davis.location.assign("/play" + (currentGameId != null ? "/" + encodeURIComponent(currentGameId) : ""));
    }

    Module.init = function(c){
        function handleRequest(req){
            App.setActiveModule("play");
            var id = req.params.id == null ? null : decodeURIComponent(req.params.id);
            if (id != currentGameId && currentGameId != null){
                updateUrlAndTitle();
                return;
            }
            else if (currentGameId == null && id != null){
                App.setActiveModule("library",{gameid:id});
                return;
            }
            document.title = "Googulator - " + (currentGameTitle !== null ? currentGameTitle : "Play");
        }
        function requestRewriter(req){//This redirects old urls to the proper new ones
            Davis.location.replace("/play" + (req.params.id === null ? "" : "/" + req.params.id));
        }
        App.davis.get("/play",handleRequest);
        App.davis.get("/play/:id",handleRequest);
        App.davis.get("/gameboy",requestRewriter);
        App.davis.get("/gameboy/play/:id",requestRewriter);
        App.davis.get("/nes",requestRewriter);
        App.davis.get("/nes/play/:id",requestRewriter);
        container = c;
        $("#gameboyOff").click(function(){
            turnGameOff();
        });
        $(window).bind("beforeunload",function(){
            if (currentApp.isRunning()){
                return "Warning you haven't shut off the game. You may lose save data if it is not shut off!!!!";
            }
        });
        fullScreenSupported = $("#gbOuterContainer").fullScreen() != null;
        if (fullScreenSupported){
            $(document).bind("fullscreenchange",function(){
                if ($("#gbOuterContainer").fullScreen()){
                    $("#gbOuterContainer").addClass('fullscreen');
                }
                else{
                    $("#gbOuterContainer").removeClass('fullscreen');
                }
            });
            $("#fullscreenEnable").removeAttr("disabled");
            $("#fullscreenEnable").click(function(){

                setFullScreenMode(true);
            });
        }

        $("#volumeSlider").slider({
            min:0,
            max:1,
            step: 0.01,
            value: currentApp.getVolume(),
            range: "min",
            slide: function(event,ui){
                currentApp.setVolume(ui.value);
            }
        });

        var prevHeight = 0;
        var prevWidth = 0;

        $(window).resize(function(){
            var newHeight = $("#gbInnerContainer").innerHeight();
            var newWidth = $("#gbInnerContainer").innerWidth();
            if (forceResizeCanvas || newHeight != prevHeight || newWidth != prevWidth){
                forceResizeCanvas = false;
                prevHeight = newHeight;
                prevWidth = newWidth;
                currentApp.onResize(newWidth,newHeight);
            }
        });
        $.doTimeout( 100, function(){
            $(window).resize();
            return true;
        });



        loadApp(currentApp,null);
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/play" && Davis.location.current().indexOf("/play/") !== 0)
            updateUrlAndTitle();
        active = true;
        if (params.game != null){
            turnGameOff(function(){
                loadGame(params.game);
            })
        }
        resumeGame();
    }

    Module.onAuthenticated = function(){
    }

    function resumeGame(){
        currentApp.resume();
    }

    function loadGame(game){
        switch (game.header.type){
            case "nes":
                loadApp(nes,game);
                break;
            case "gameboy":
                loadApp(Gameboy,game);
                break;
            case "html5":
                loadApp(game.data,game);
                break;
            default:
                loadApp(DummyApp,null);
                return;
        }
    }

    function setFullScreenMode(enabled){
        $("#gbOuterContainer").fullScreen(true);
        $(window).resize();
    }

    function turnGameOff(callback){
        $("#gameboyOff").attr('disabled',"disabled");
        overlay = App.createMessageOverlay(container,"Turning Game Off...");
        currentApp.terminateGame(function(){
            currentGameTitle = null;
            currentGameId = null
            loadApp(DummyApp,null);
            $("#gameboyComments").empty();
            updateUrlAndTitle();
            overlay.remove();
            if (callback)
                callback();
        });
    }

    Module.onFreeze = function(){
        active = false;
        currentApp.clearButtonStates();
        currentApp.pause();
    }

    var quickSaveState = null;

    var keyhandler = function(event){
        if (!active)
            return false;
        return currentApp.handleKey(event);
    };

    $(document).keyup(function(event){
        event.up = true;
        var events = App.settings.controller.transformKeyInput(event);
        var returnValue = true;
        for (var i = 0, li = events.length; i < li; i++)
            returnValue = returnValue && !keyhandler(events[i]);
        return returnValue;
    });

    $(document).keydown(function(event){
        event.up = false;
        var events = App.settings.controller.transformKeyInput(event);
        var returnValue = true;
        for (var i = 0, li = events.length; i < li; i++)
            returnValue = returnValue && !keyhandler(events[i]);
        return returnValue;
    });

    Gamepad.addListener(function(event){
        var events = App.settings.controller.transformGamepadInput(event);
        for (var i = 0, li = events.length; i < li; i++)
            keyhandler(events[i]);
    });

    $(document).mousedown(function(event){
        if (active)
            currentApp.handleMouseEvent(event);
    });

    $(document).mouseup(function(event){
        if (active)
            currentApp.handleMouseEvent(event);
    });


    var checkFrames = function(){
        if (container != null && active){
            container.find("#FPSCounter").text(Math.floor(currentApp.getFPS()));
        }
        setTimeout(checkFrames,1000);
    }

    function loadApp(app,game){
        $("#gbInnerContainer").empty();
        $("#gbInnerContainer").append(app.getHTML());
        currentApp = app;
        if (game != null){
            currentApp.setVolume($("#volumeSlider").slider("value"));
            forceResizeCanvas = true;
            currentApp.loadGame(game);
            currentGameTitle = game.title;
            currentGameId = game.id;
            gapi.comments.render('gameboyComments', {
                href: window.location.origin + "/library/game/" + encodeURIComponent(currentGameId),
                width: '625',
                first_party_property: 'BLOGGER',
                view_type: 'FILTERED_POSTMOD'
            });
            updateUrlAndTitle();
            currentApp.start();
            $("#gameboyOff").removeAttr("disabled");
            $("#noGameLoadedDisplay").addClass("hidden");
            $(window).resize();
        }


    }

    checkFrames();

    return Module;
})