define(["nescore/nes"], function(NES){
    var Module = {};

    var container;
    var canvas;
    var active = false;
    var overlay = null;
    var fullScreenSupported = false;

    var canvasWidth = 1;
    var canvasHeight = 1;

    var nes;

    Module.init = function(c){
        container = c;
        canvas = $("#nesLCD");
        nes = new NES({canvas:canvas[0]});
        $("#nesOff").click(function(){
            turnNESOff();
        });
        $(window).bind("beforeunload",function(){
            if (nes.hasGame()){
                return "Warning you haven't shut off the NES. You may lose save data if it is not shut off!!!!";
            }
        });
        fullScreenSupported = canvas.fullScreen() != null;
        if (fullScreenSupported){
            $(document).bind("fullscreenchange",function(){
                if ($("#nesOuterContainer").fullScreen()){
                    $("#nesOuterContainer").addClass('fullscreen');
                }
                else{
                    $("#nesOuterContainer").removeClass('fullscreen');
                }
            });
            container.find("#fullscreenEnable").removeAttr("disabled");
            container.find("#fullscreenEnable").click(function(){

                setFullScreenMode(true);
            });
        }
       container.find("#volumeSlider").slider({
            min:0,
            max:1,
            step: 0.01,
            value: nes.getVolume(),
            range: "min",
            slide: function(event,ui){
                nes.setVolume(ui.value);
            }
        });

        var prevHeight = 0;

        $(window).resize(function(){
            var newHeight = canvas.height();
            if (prevHeight != newHeight){
                prevHeight = newHeight;
                canvasWidth = canvas.height()/240*256;
                canvasHeight = canvas.height();
                canvas.attr("width",canvasWidth);
                canvas.attr("height",canvasHeight);
            }
        });
        $.doTimeout( 100, function(){
            $(window).resize();
            return true;
        });

        canvas.mousemove(function(event){
            var x = Math.floor(event.offsetX / canvasWidth * 256);
            var y = Math.floor(event.offsetY / canvasHeight * 240);
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_X,x);
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_Y,y);
        });
        canvas.mouseleave(function(event){
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_X,1000);
            nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.ZAPPER_Y,1000);
        });

        canvas.mouseleave();
    }

    Module.onActivate = function(params){
        active = true;
        if (params.game != null){
            turnNESOff(function(){
                nes.loadROM(params.game);
                nes.start();
                $("#nesOff").removeAttr("disabled");
                $("#nesLCD").removeClass('hidden');
                container.find("#noGameLoadedDisplay").addClass("hidden");
            })
        }
        nes.start();
    }

    Module.onAuthenticated = function(){
    }

    function setFullScreenMode(enabled){
        $("#nesOuterContainer").fullScreen(true);
        $(window).resize();
    }

    function turnNESOff(callback){
        if (callback == null) callback = function(){};
        $("#nesOff").attr('disabled',"disabled");
        overlay = App.createMessageOverlay(container,"Turning NES Off...");
        nes.stop();
        nes.unloadROM(function(){
            blankScreen();
            overlay.remove();
            $("#nesLCD").addClass('hidden');
            container.find("#noGameLoadedDisplay").removeClass("hidden");
            callback();
        });
    }

    function blankScreen(){
        var ctx = canvas[0].getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0,0,canvas.attr("width"),canvas.attr("height"));
    }

    Module.onFreeze = function(){
        nes.stop();
        active = false;
        //TODO: set all buttons not not pressed
        /*Gameboy.setButtonState(0,Gameboy.BUTTON_LEFT,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_RIGHT,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_UP,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_DOWN,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_A,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_B,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_START,Gameboy.BUTTON_NOT_PRESSED);
        Gameboy.setButtonState(0,Gameboy.BUTTON_SELECT,Gameboy.BUTTON_NOT_PRESSED);  */
    }

    var quickSaveState = null;

    var keyhandler = function(event){
        if (!active)
            return;
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

    $(document).mousedown(function(event){
        nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.BUTTON_ZAPPER,nes.joypad.BUTTON_PRESSED);
    });

    $(document).mouseup(function(event){
        nes.joypad.setButtonState(nes.joypad.PLAYER_2,nes.joypad.BUTTON_ZAPPER,nes.joypad.BUTTON_NOT_PRESSED);

    });

    Gamepad.addListener(function(event){
        var events = App.settings.controller.transformGamepadInput(event);
        for (var i = 0, li = events.length; i < li; i++)
            keyhandler(events[i]);
    });

    var checkFrames = function(){
        if (nes != null)
            container.find("#FPSCounter").text(Math.floor(nes.getFPS()));
        setTimeout(checkFrames,1000);
    }

    checkFrames();

    return Module;
})