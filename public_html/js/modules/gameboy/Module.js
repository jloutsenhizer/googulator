define(["gbcore/Gameboy"], function(Gameboy){
    var Module = {};

    var container;
    var canvas;
    var active = false;
    var overlay = null;
    var fullScreenSupported = false;
    var currentGameId = null;
    var currentGameTitle = null;

    function updateUrlAndTitle(){
        Davis.location.assign("/gameboy" + (currentGameId != null ? "/play/" + encodeURIComponent(currentGameId) : ""));
    }

    Module.init = function(c){
        function handleRequest(req){
            var id = req.params.id == null ? null : decodeURIComponent(req.params.id);
            if (id != currentGameId && currentGameId != null){
                updateUrlAndTitle();
                return;
            }
            else if (currentGameId == null && id != null){
                App.setActiveModule("library",{gameid:id});
                return;
            }
            App.setActiveModule("gameboy");
            document.title = "Googulator - " + (currentGameTitle !== null ? currentGameTitle : "Gameboy");

        }
        App.davis.get("/gameboy",handleRequest);
        App.davis.get("/gameboy/play/:id",handleRequest);
        container = c;
        canvas = $("#gbLCD");
        Gameboy.setCanvas(canvas[0]);
        $("#gameboyOff").click(function(){
            turnGameboyOff();
        });
        $(window).bind("beforeunload",function(){
            if (Gameboy.isRunning()){
                return "Warning you haven't shut off the Gameboy. You may lose save data if it is not shut off!!!!";
            }
        });
        fullScreenSupported = canvas.fullScreen() != null;
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
            value: Gameboy.getVolume(),
            range: "min",
            slide: function(event,ui){
                Gameboy.setVolume(ui.value);
            }
        });

        var prevHeight = 0;

        $(window).resize(function(){
            var newHeight = canvas.height();
            if (prevHeight != newHeight){
                prevHeight = newHeight;
                canvas.attr("width",canvas.height()/144*160);
                canvas.attr("height",canvas.height());
            }
        });
        $.doTimeout( 100, function(){
            $(window).resize();
            return true;
        });
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/gameboy" && Davis.location.current().indexOf("/gameboy/") !== 0)
            updateUrlAndTitle();
        active = true;
        if (params.game != null){
            turnGameboyOff(function(){
                Gameboy.loadGame(params.game);
                currentGameTitle = params.game.title;
                currentGameId = params.game.id;
                updateUrlAndTitle();
                Gameboy.run();
                $("#gameboyOff").removeAttr("disabled");
                $("#gbLCD").removeClass('hidden');
                $("#noGameLoadedDisplay").addClass("hidden");
            })
        }
        Gameboy.resume();
    }

    Module.onAuthenticated = function(){
    }

    function setFullScreenMode(enabled){
        $("#gbOuterContainer").fullScreen(true);
        $(window).resize();
    }

    function turnGameboyOff(callback){
        $("#gameboyOff").attr('disabled',"disabled");
        overlay = App.createMessageOverlay(container,"Turning Gameboy Off...");
        Gameboy.terminateGame(function(){
            currentGameTitle = null;
            currentGameId = null;
            updateUrlAndTitle();
            blankScreen();
            overlay.remove();
            $("#gbLCD").addClass('hidden');
            $("#noGameLoadedDisplay").removeClass("hidden");
            if (callback)
                callback();
        });
    }

    function blankScreen(){
        var ctx = canvas[0].getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0,0,canvas.attr("width"),canvas.attr("height"));
    }

    Module.onFreeze = function(){
        Gameboy.pause();
        active = false;
        Gameboy.setButtonState(0,Gameboy.BUTTON_LEFT,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_RIGHT,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_UP,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_DOWN,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_A,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_B,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_START,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_SELECT,Gameboy.BUTTON_NOT_PRESSED);
    }

    var quickSaveState = null;

    var keyhandler = function(event){
        if (!active)
            return;
        switch (event.button){
            case App.constants.BUTTON_LEFT:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_LEFT,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_RIGHT:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_RIGHT,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case  App.constants.BUTTON_UP:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_UP,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_DOWN:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_DOWN,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_A:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_A,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_B:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_B,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_START:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_START,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_SELECT:
                Gameboy.setButtonState(event.player,Gameboy.BUTTON_SELECT,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                break;
            case App.constants.QUICK_LOAD_STATE:
                Gameboy.setSaveState(quickSaveState);
                break;
            case App.constants.QUICK_SAVE_STATE:
                quickSaveState = Gameboy.getSaveState();
                break;
        }
    };

    $(document).keyup(function(event){
        event.up = true;
        var events = App.settings.controller.transformKeyInput(event);
        for (var i = 0, li = events.length; i < li; i++)
            keyhandler(events[i]);
    });

    $(document).keydown(function(event){
        event.up = false;
        var events = App.settings.controller.transformKeyInput(event);
        for (var i = 0, li = events.length; i < li; i++)
            keyhandler(events[i]);
    });

    Gamepad.addListener(function(event){
        var events = App.settings.controller.transformGamepadInput(event);
        for (var i = 0, li = events.length; i < li; i++)
            keyhandler(events[i]);
    });

    var checkFrames = function(){
        $("#FPSCounter").text(Math.floor(Gameboy.getFPS()));
        setTimeout(checkFrames,1000);
    }

    checkFrames();

    return Module;
})