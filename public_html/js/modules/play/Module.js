define(["gbcore/Gameboy", "nescore/nes"], function(Gameboy,NES){
    //TODO: this merged UI works but is really messy. Need to normalize an emulator interface and clean this up
    var Module = {};

    var container;
    var canvas;
    var active = false;
    var overlay = null;
    var fullScreenSupported = false;
    var currentGameId = null;
    var currentGameTitle = null;
    var nes;

    var canvasWidth = 1;
    var canvasHeight = 1;

    var currentGameType = null;

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
        canvas = $("#gbLCD");
        Gameboy.setCanvas(canvas[0]);
        nes = new NES({canvas:canvas[0]});
        $("#gameboyOff").click(function(){
            turnGameOff();
        });
        $(window).bind("beforeunload",function(){
            if (Gameboy.isRunning()){
                return "Warning you haven't shut off the Gameboy. You may lose save data if it is not shut off!!!!";
            }
            if (nes.isRunning()){
                return "Warning you haven't shut off the NES. You may lose save data if it is not shut off!!!!";

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
                nes.setVolume(ui.value);
            }
        });
        Gameboy.setVolume(0);
        nes.setVolume(0);

        var prevHeight = 0;
        var prevGameType = null;

        $(window).resize(function(){
            var newHeight = canvas.height();
            if (prevHeight != newHeight || prevGameType != currentGameType){
                prevGameType = currentGameType;
                prevHeight = newHeight;
                canvasHeight = newHeight;
                switch (currentGameType){
                    case "nes":
                        canvasWidth = newHeight/240*256;
                        break;
                    case "gameboy":
                        canvasWidth = newHeight/144*160;
                        break;
                    default:
                        canvasWidth = newHeight;
                }
                canvas.attr("width",canvasWidth);
                canvas.attr("height",canvasHeight);
            }
        });
        $.doTimeout( 100, function(){
            $(window).resize();
            return true;
        });

        canvas.mousemove(function(event){
            if (currentGameType !== "nes")
                return;
            var x = Math.floor(event.offsetX / canvasWidth * 256);
            var y = Math.floor(event.offsetY / canvasHeight * 240);
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_X,x);
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_Y,y);
        });
        canvas.mouseleave(function(event){
            if (currentGameType !== "nes")
                return;
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_X,1000);
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_Y,1000);
        });
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
        switch (currentGameType){
            case "nes":
                nes.start();
                break;
            case "gameboy":
                Gameboy.resume();
                break;
        }
    }

    function loadGame(game){
        currentGameType = game.header.type;
        switch (currentGameType){
            case "nes":
                nes.loadROM(game);
                break;
            case "gameboy":
                Gameboy.loadGame(game);
                break;
            default:
                return;
        }
        currentGameTitle = game.title;
        currentGameId = game.id;
        gapi.comments.render('gameboyComments', {
            href: window.location.origin + "/library/game/" + encodeURIComponent(currentGameId),
            width: '625',
            first_party_property: 'BLOGGER',
            view_type: 'FILTERED_POSTMOD'
        });
        updateUrlAndTitle();
        switch (currentGameType){
            case "nes":
                nes.start();
                break;
            case "gameboy":
                Gameboy.run();
                break;
            default:
                return;
        }
        $("#gameboyOff").removeAttr("disabled");
        $("#gbLCD").removeClass('hidden');
        $("#noGameLoadedDisplay").addClass("hidden");
        $(window).resize();
    }

    function setFullScreenMode(enabled){
        $("#gbOuterContainer").fullScreen(true);
        $(window).resize();
    }

    function turnGameboyOff(callback){
        Gameboy.terminateGame(callback);
    }
    function turnNESOff(callback){
        nes.stop();
        nes.unloadROM(callback);
    }

    function turnGameOff(callback){
        $("#gameboyOff").attr('disabled',"disabled");
        overlay = App.createMessageOverlay(container,"Turning Game Off...");
        var terminateFunction = null;
        switch (currentGameType){
            case "nes":
                terminateFunction = turnNESOff;
                break;
            case "gameboy":
                terminateFunction = turnGameboyOff;
                break;
            default:
                terminateFunction = function(callback){callback()};
                break;
        }
        terminateFunction(function(){
            currentGameTitle = null;
            currentGameId = null
            currentGameType = null;
            $("#gameboyComments").empty();
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
        active = false;
        switch (currentGameType){
            case "nes":
                nes.stop(); //TODO: set all nes buttons to released
                break;
            case "gameboy":
                Gameboy.pause();
                Gameboy.setButtonState(0,Gameboy.BUTTON_LEFT,Gameboy.BUTTON_NOT_PRESSED);
                Gameboy.setButtonState(0,Gameboy.BUTTON_RIGHT,Gameboy.BUTTON_NOT_PRESSED);
                Gameboy.setButtonState(0,Gameboy.BUTTON_UP,Gameboy.BUTTON_NOT_PRESSED);
                Gameboy.setButtonState(0,Gameboy.BUTTON_DOWN,Gameboy.BUTTON_NOT_PRESSED);
                Gameboy.setButtonState(0,Gameboy.BUTTON_A,Gameboy.BUTTON_NOT_PRESSED);
                Gameboy.setButtonState(0,Gameboy.BUTTON_B,Gameboy.BUTTON_NOT_PRESSED);
                Gameboy.setButtonState(0,Gameboy.BUTTON_START,Gameboy.BUTTON_NOT_PRESSED);
                Gameboy.setButtonState(0,Gameboy.BUTTON_SELECT,Gameboy.BUTTON_NOT_PRESSED);
                break;
        }
    }

    var quickSaveState = null;

    var keyhandler = function(event){
        if (!active)
            return false;
        switch (currentGameType){
            case "nes":
                switch (event.button){
                    case App.constants.BUTTON_LEFT:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_LEFT,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_RIGHT:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_RIGHT,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case  App.constants.BUTTON_UP:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_UP,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_DOWN:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_DOWN,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_A:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_A,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_B:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_B,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_START:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_START,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_SELECT:
                        nes.joypad.setButtonState(event.player,nes.joypad.BUTTON_SELECT,event.pressed ? nes.joypad.BUTTON_PRESSED : nes.joypad.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.QUICK_SAVE_STATE:
                        quickSaveState = nes.getSaveState();
                        break;
                    case App.constants.QUICK_LOAD_STATE:
                        nes.setSaveState(quickSaveState);
                        break;
                    default:
                        return false;
                }
                break;
            case "gameboy":
                switch (event.button){
                    case App.constants.BUTTON_LEFT:
                        Gameboy.setButtonState(event.player,Gameboy.BUTTON_LEFT,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_RIGHT:
                        Gameboy.setButtonState(event.player,Gameboy.BUTTON_RIGHT,event.pressed ? Gameboy.BUTTON_PRESSED : Gameboy.BUTTON_NOT_PRESSED);
                        break;
                    case App.constants.BUTTON_UP:
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
                    default:
                        return false;
                }
                break;
        }

        return true;
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
        if (currentGameType === "nes")
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.BUTTON_ZAPPER,nes.joypad.BUTTON_PRESSED);
    });

    $(document).mouseup(function(event){
        if (currentGameType === "nes")
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.BUTTON_ZAPPER,nes.joypad.BUTTON_NOT_PRESSED);

    });


    var checkFrames = function(){
        switch (currentGameType){
            case "nes":
                if (nes != null)
                    container.find("#FPSCounter").text(Math.floor(nes.getFPS()));
                break;
            case "gameboy":
                $("#FPSCounter").text(Math.floor(Gameboy.getFPS()));
                break;
            default:
                $("#FPSCounter").text(0);
                break;

        }
        setTimeout(checkFrames,1000);
    }

    checkFrames();

    return Module;
})