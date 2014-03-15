define(["GameUtils","gbcore/CPUEmulator","gbcore/GameLoader","gbcore/GPUEmulator","gbcore/MemoryController","gbcore/Joypad",
        "gbcore/APUEmulator", "gbcore/SGB","gbcore/Gameshark","gbcore/GameGenie"],function(GameUtils, CPUEmulator,GameLoader,GPUEmulator,MemoryController, Joypad, APUEmulator, SGB,Gameshark,GameGenie){
    "use strict";

    var Gameboy = {};

    var html = $("<div style='height:100%'><canvas style='height:100%'></canvas></div>");
    var canvas = html.find("canvas")[0];
    var twitchOutput = html.find(".twitchOutput");

    var loadedGame;
    var game;

    var quickSaveState = null;

    Gameboy.BUTTON_A = Joypad.BUTTON_A, Gameboy.BUTTON_B = Joypad.BUTTON_B, Gameboy.BUTTON_SELECT = Joypad.BUTTON_SELECT, Gameboy.BUTTON_START = Joypad.BUTTON_START,
    Gameboy.BUTTON_RIGHT = Joypad.BUTTON_RIGHT, Gameboy.BUTTON_LEFT = Joypad.BUTTON_LEFT, Gameboy.BUTTON_UP = Joypad.BUTTON_UP, Gameboy.BUTTON_DOWN = Joypad.BUTTON_DOWN;

    Gameboy.BUTTON_PRESSED = Joypad.BUTTON_PRESSED, Gameboy.BUTTON_NOT_PRESSED = Joypad.BUTTON_NOT_PRESSED;

    GPUEmulator.setCPU(CPUEmulator);
    GPUEmulator.setMemoryController(MemoryController);
    GPUEmulator.setDisplay(canvas.getContext("2d"));
    CPUEmulator.setMemoryController(MemoryController);
    CPUEmulator.setGameshark(Gameshark);
    APUEmulator.setMemoryController(MemoryController);
    MemoryController.setGPU(GPUEmulator);
    MemoryController.addIOListener(CPUEmulator);
    MemoryController.addIOListener(GPUEmulator);
    Joypad.setCPU(CPUEmulator);
    Joypad.setMemoryController(MemoryController);
    MemoryController.addIOListener(Joypad);
    MemoryController.addIOListener(APUEmulator);
    MemoryController.addIOListener(SGB);
    SGB.setJoypad(Joypad);
    SGB.setGPU(GPUEmulator);
    SGB.setMemoryController(MemoryController);
    Gameshark.setMemoryController(MemoryController);

    Gameboy.loadGame = function(g){
        game = g;
        loadedGame = GameLoader.loadGame(game.data);
        if (loadedGame == null)
            return false;
        if (game.saveData != null)
            loadedGame.setRAM(game.saveData);
        CPUEmulator.setGBCEnabled(game.header.gbcEnabled);
        GPUEmulator.setGBCEnabled(game.header.gbcEnabled);
        MemoryController.setGBCEnabled(game.header.gbcEnabled);
        SGB.setSGBEnabled(game.header.sgbEnabled);
        MemoryController.setLoadedGame(loadedGame);
        GameGenie.reset();
        Gameshark.reset();
        GameGenie.setLoadedGame(loadedGame);
        MemoryController.reset();
        SGB.reset();
        loadedGame.reset();
        CPUEmulator.reset();
        GPUEmulator.reset();
        APUEmulator.reset();
        Joypad.reset();
        CPUEmulator.simulateBIOS();
        this.setSaveState(game.saveState);
        frameTimes = [];
        return true;
    }

    var normalFrameTime = 1000 / 60;

    var onterminate = null;
    var running = false;
    var paused = false;
    var waitForTerminate = false;

    var inPauseMode = false;

    var frameTimes = [];

    Gameboy.start = function(){
        this.run();
    }

    Gameboy.run = function(){
        running = true;
        var gb = this;
        var frameRendered = false;
        var start = new Date().getTime();
        while (!frameRendered){
            var cycles = CPUEmulator.takeStep();
            if (CPUEmulator.isInDoubleSpeed())
                cycles /= 2;
            APUEmulator.updateCycles(cycles);
            frameRendered = GPUEmulator.updateCycles(cycles);
        }
        var end = new Date().getTime();
        if (frameTimes.length < 10)
            frameTimes.push(end);
        else{
            for (var i = 0; i < frameTimes.length - 1; i++)
                frameTimes[i] = frameTimes[i + 1];
            frameTimes[frameTimes.length - 1] = end;
        }
        var sleepTime = normalFrameTime - (end - start);
        if (sleepTime < 0) sleepTime = 0;


        var repeatFunction = function(){
            if (onterminate != null){
                GameGenie.removeAllCodes();
                loadedGame.cleanup();
                APUEmulator.stop();
                var callback = onterminate;
                onterminate = null;
                running = false;
                waitForTerminate = false;
                callback();
                return;
            }
            if (!paused && !waitForTerminate){
                inPauseMode = false;
                gb.run();
            }
            else{
                inPauseMode = true;
                setTimeout(repeatFunction,20);
            }
        };

        setTimeout(repeatFunction,sleepTime);
    }

    Gameboy.pause = function(){
        paused = true;
        APUEmulator.stop();
    }

    Gameboy.resume = function(){
        paused = false;
        APUEmulator.start();
    }

    Gameboy.isRunning = function(){
        return running;
    }

    Gameboy.terminateGame = function(callback,saveprogresscallback){
        APUEmulator.stop();
        if (!running){
            callback();
        }
        else{
            var gb = this;
            waitForTerminate = true;
            game.updateSaveData(loadedGame.getSaveData(),function(){
                game.updateSaveStateData(gb.getSaveState(),function(){
                    onterminate = callback;
                },saveprogresscallback);
            },saveprogresscallback);

        }
    }

    Gameboy.getFPS = function(){
        if (frameTimes.length <= 1){
            return 60;
        }
        else{
            var totalTime = frameTimes[frameTimes.length - 1] - frameTimes[0];
            return (frameTimes.length - 1) * 1000 / totalTime;
        }
    }

    Gameboy.getVolume = function(){
        return APUEmulator.getVolume();
    }

    Gameboy.setVolume = function(volume){
        APUEmulator.setVolume(volume);
    }

    Gameboy.setButtonState = function(player,button,state){
        Joypad.setButtonState(player,button,state);
    }

    Gameboy.clearButtonStates = function(){
        Joypad.clearButtonStates();
    }

    Gameboy.getSaveState = function(){
        return {
            gameid: game.id,
            gpu: GPUEmulator.getSaveState(),
            apu: APUEmulator.getSaveState(),
            cpu: CPUEmulator.getSaveState(),
            mcontroller: MemoryController.getSaveState(),
            joypad: Joypad.getSaveState(),
            SGB: SGB.getSaveState(),
            loadedGame: loadedGame.getSaveState()
        }
    }

    Gameboy.setSaveState = function(saveState){
        if (saveState == null || saveState.gameid != game.id){
            console.error("Cannot load state, it's for the wrong game!");
            return;
        }
        if (this.isRunning())
            this.pause();
        var gb = this;
        var doLoad = function(){
            if (gb.isRunning() && !inPauseMode){
                setTimeout(doLoad,20);
                return;
            }

            GPUEmulator.setSaveState(saveState.gpu);
            APUEmulator.setSaveState(saveState.apu);
            CPUEmulator.setSaveState(saveState.cpu);
            Joypad.setSaveState(saveState.joypad);
            SGB.setSaveState(saveState.SGB);
            loadedGame.setSaveState(saveState.loadedGame)
            MemoryController.setSaveState(saveState.mcontroller,loadedGame);

            gb.resume();
        }

        doLoad();
    }

    Gameboy.handleKey = function(event){
        switch (event.button){
            case App.constants.BUTTON_LEFT:
                Joypad.setButtonState(event.player,this.BUTTON_LEFT,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_RIGHT:
                Joypad.setButtonState(event.player,this.BUTTON_RIGHT,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_UP:
                Joypad.setButtonState(event.player,this.BUTTON_UP,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_DOWN:
                Joypad.setButtonState(event.player,this.BUTTON_DOWN,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_A:
                Joypad.setButtonState(event.player,this.BUTTON_A,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_B:
                Joypad.setButtonState(event.player,this.BUTTON_B,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_START:
                Joypad.setButtonState(event.player,this.BUTTON_START,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.BUTTON_SELECT:
                Joypad.setButtonState(event.player,this.BUTTON_SELECT,event.pressed ? this.BUTTON_PRESSED : this.BUTTON_NOT_PRESSED);
                break;
            case App.constants.QUICK_LOAD_STATE:
                this.setSaveState(quickSaveState);
                break;
            case App.constants.QUICK_SAVE_STATE:
                quickSaveState = this.getSaveState();
                break;
            default:
                return false;
        }
        return true;
    }

    Gameboy.handleMouseEvent = function(){

    }

    Gameboy.onResize = function(){
        var canvasHeight = $(canvas).height();
        var canvasWidth =  canvasHeight/9*10;
        twitchOutput.css("width",canvasWidth*54/90);
        $(canvas).attr("width",canvasWidth);
        $(canvas).attr("height",canvasHeight);

    }

    Gameboy.getHTML = function(){
        return html;
    }

    return Gameboy;
});