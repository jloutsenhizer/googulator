define(["CopyUtils"], function(CopyUtils){

    var Joypad = {};

    var keyDown = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
    var MODE_NONE = 0, MODE_JPAD = 1, MODE_DPAD = 2, MODE_SWITCH_PLAYER = 3;
    var curPlayer = 0;
    var mode = MODE_NONE;

    var maxPlayers = 1;

    Joypad.BUTTON_A = 0, Joypad.BUTTON_B = 1, Joypad.BUTTON_SELECT = 2, Joypad.BUTTON_START = 3,
        Joypad.BUTTON_RIGHT = 4, Joypad.BUTTON_LEFT = 5, Joypad.BUTTON_UP = 6, Joypad.BUTTON_DOWN = 7;

    Joypad.BUTTON_PRESSED = true, Joypad.BUTTON_NOT_PRESSED = false;

    var cpu;
    var memoryController;

    Joypad.getSaveState = function(){
        return {
            curPlayer: curPlayer,
            mode: mode,
            maxPlayers: maxPlayers
        }
    }

    Joypad.setSaveState = function(saveState){
        curPlayer = saveState.curPlayer;
        mode = saveState.mode;
        maxPlayers = saveState.maxPlayers;
    }

    Joypad.setCPU = function(c){
        cpu = c;
    }

    Joypad.setMemoryController = function(mController){
        memoryController = mController;
    }

    Joypad.reset = function(){
        for (var j = 0; j < keyDown.length; j++)
            for (var i = 0; i < keyDown[j].length; i++)
                keyDown[j][i] = false;
        mode = MODE_NONE;
        maxPlayers = 1;
        curPlayer = 0;
        readDPad = readButtons = false;
    }

    Joypad.setButtonState = function(player, button, state){
        if (keyDown[player][button] == state)
            return;
        keyDown[player][button] = state;
        if (mode == MODE_NONE || mode == MODE_SWITCH_PLAYER)
            return;
        if (curPlayer == player && state && button >= (mode - 1) * 4 && button < mode * 4){
            cpu.interrupt(INT_JPAD);
        }
    }

    Joypad.clearButtonStates = function(){
        for (var i = 0, li = keyDown.length; i < li; i++){
            for (var j = 0, lj = keyDown[i].length; j < lj; j++){
                keyDown[i][j] = Joypad.BUTTON_NOT_PRESSED;
            }
        }
    }

    Joypad.getButtonState = function(player,button){
        return keyDown[player,button];
    }

    var readDPad = false, readButtons  = false;

    Joypad.IORegisterWritten = function(address, value) {
        switch (address){
            case 0xFF00://JOYP
            {
                value &= 0x30;
                switch (value){
                    case 0x30:
                        mode = MODE_SWITCH_PLAYER;
                        break;
                    case 0x20: //dpad
                        readDPad = true;
                        mode = MODE_DPAD;
                        break;
                    case 0x10://buttons
                        readButtons = true;
                        mode = MODE_JPAD;
                        break;
                    default:
                        mode = MODE_NONE;
                }
                if (mode == MODE_SWITCH_PLAYER){
                    if (readDPad && readButtons){
                        curPlayer++;
                        if (curPlayer >= maxPlayers) curPlayer -= maxPlayers;
                        readDPad = readButtons = false;
                    }
                    value |= 0xF - curPlayer;
                }
                else if (mode != MODE_NONE){
                    for (var i = 0; i < 4; i++){
                        if (!keyDown[curPlayer][(mode - 1) * 4 + i])
                            value |= (1 << i);
                    }
                }

                memoryController.writeByte(address, value, true);

            }
        }
    }

    Joypad.setMaxPlayers = function(players){
        maxPlayers = players;
        curPlayer = 0;
        readDPad = readButtons = false;
    }

    Joypad.clearButtonStates();

    return Joypad;

});