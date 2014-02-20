define(function(){
    "use strict";

    var SGB = {};

    var sgbEnabled = false;
    var joypad, gpu, memoryController;

    SGB.setJoypad = function(jpad){
        joypad = jpad;
    }

    SGB.setGPU = function(g){
        gpu = g;
    }

    SGB.setMemoryController = function(m){
        memoryController = m;
    }

    SGB.reset = function(){
        mode = WAITING;
        bitsToGo = 0;
        bitsRead = 0;
    }

    SGB.setSGBEnabled = function(enabled){
        sgbEnabled = enabled;
    }

    SGB.IORegisterWritten = function(address,value){
        if (!sgbEnabled)
            return;
        if (address == 0xFF00){
            switch (value & 0x30){
                case 0:
                    inputBit(RESET);
                    break;
                case 0x20:
                    inputBit(0);
                    break;
                case 0x10:
                    inputBit(1);
                    break;
            }
        }
    }

    var RESET = 2;

    var WAITING = 0;
    var READING = 1;

    var mode = WAITING;

    var bitsToGo = 0;

    var commandData = new Uint8Array(112);
    var bitsRead = 0;

    var paletteData = new Uint8Array(0x1000);
    var attributeData = new Uint8Array(0xFD2);

    SGB.getSaveState = function(){
        var pal = new Array(paletteData.length);
        var attr = new Array(attributeData.length);
        var cmd = new Array(commandData.length);
        for (var i = 0, li = pal.length; i < li; i++)
            pal[i] = paletteData[i];
        for (var i = 0, li = attr.length; i < li; i++)
            attr[i] = attributeData[i];
        for (var i = 0, li = cmd.length; i < li; i++)
            cmd[i] = commandData[i];
        return {
            pal: pal,
            attr: attr,
            cmd: cmd,
            enabled: sgbEnabled,
            bitsToGo: bitsToGo,
            bitsRead: bitsRead
        };
    }

    SGB.setSaveState = function(saveState){
        for (var i = 0, li = saveState.pal.length; i < li; i++)
            paletteData[i] = saveState.pal[i];
        for (var i = 0, li = saveState.attr.length; i < li; i++)
            attributeData[i] = saveState.attr[i];
        for (var i = 0, li = saveState.cmd.length; i < li; i++)
            commandData[i] = saveState.cmd[i];
        sgbEnabled = saveState.sgbEnabled;
        bitsToGo = saveState.bitsToGo;
        bitsRead = saveState.bitsRead;
    }

    function doVRAMTransfer(destination){
        var destinationSize = destination.length;
        var destinationPos = 0;
        var vram = gpu.getVRAM();
        var LCDC = memoryController.readByte(0xFF40);
        var tileMap = ((LCDC & 8) != 0) ? 0x1C00 : 0x1800;
        var tileData = ((LCDC & 16) != 0) ? 0 : 0x1000;
        for (var yTile = 0; yTile < 18; yTile++){
            for (var xTile = 0; xTile < 20; xTile++){
                var tile = vram[tileMap + xTile + yTile * 32];
                if ((LCDC & 16) == 0)
                    tile = memoryController.signByte(tile);
                for (var i = 0; i < 16; i++){
                    destination[destinationPos++] = vram[tileData + tile * 16 + i];
                    if (destinationPos == destinationSize)
                        return;
                }
            }
        }
    }

    function PAL_TRN(){//palette transfer
        doVRAMTransfer(paletteData);
    }

    function ATTR_TRN(){//attribute transfer
        doVRAMTransfer(attributeData);
    }

    function PAL_SET(){//palette set
        var applyAttributeFile = (commandData[9] & 0x80) != 0;
        var cancelMask = (commandData[9] & 0x40) != 0;
        var attributeFileNumber = commandData[9] & 0x3F;
        if (cancelMask)
            gpu.setMaskingMode(0);
        if (applyAttributeFile){
            loadAttrFile(attributeFileNumber);
        }
        for (var i = 0; i < 4; i++){
            var paletteIndex = commandData[1+i*2] | (commandData[2+i*2] << 8);
            var palDat = new Uint8Array(8);
            for (var j = 0; j < 8; j++){
                palDat[j] = paletteData[(paletteIndex << 3) + j];
            }
            gpu.setSGBPal(i,palDat);
        }
    }

    function ATTR_SET(){
        var cancelMask = (commandData[1] & 0x40) != 0;
        var attributeFileNumber = commandData[1] & 0x3F;
        if (cancelMask)
            gpu.setMaskingMode(0);
        loadAttrFile(attributeFileNumber);
    }

    function loadAttrFile(fileNumber){
        for (var y = 0; y < 18; y++){
            for (var x = 0; x < 20; x++){
                gpu.setSGBAttr(x,y,(attributeData[fileNumber*90 + y * 5 + (x >> 2)] >> (2 * (3 - (x & 3)))) & 3);
            }
        }
    }

    function setPals(pal1,pal2){
        var palDat = new Uint8Array(8);
        for (var i = 0; i < 8; i++){
            palDat[i] = commandData[1+i];
        }
        gpu.setSGBPal(pal1,palDat);
        for (var i = 0; i < 6; i++){
            palDat[2+i] = commandData[9+i];
        }
        gpu.setSGBPal(pal2,palDat);
    }

    function PAL01(){
        setPals(0,1);

    }

    function PAL23(){
        setPals(2,3);

    }

    function PAL03(){
        setPals(0,3);

    }

    function PAL12(){
        setPals(1,2);
    }

    function ATTR_BLK(){//block attr assign
        var datasets = commandData[1];
        for (var i = 0; i < datasets; i++){
            var changeInside = (commandData[2+i*6] & 1) != 0;
            var changeSurrounding = (commandData[2+i*6] & 2) != 0;
            var changeOutside = (commandData[2+i*6] & 4) != 0;
            var insidePalette = (commandData[3+i*6]) & 3;
            var surroundingPalette = (commandData[3+i*6] >> 2) & 3;
            var outsidePalette = (commandData[3+i*6] >> 4) & 3;
            if (changeInside && !changeOutside && !changeSurrounding){
                changeSurrounding = true;
                surroundingPalette = insidePalette;
            }
            else if (changeOutside && !changeInside && !changeSurrounding){
                changeSurrounding = true;
                surroundingPalette = outsidePalette;
            }
            var x1 = commandData[4+i*6];
            var y1 = commandData[5+i*6];
            var x2 = commandData[6+i*6];
            var y2 = commandData[7+i*6];
            for (var y = 0; y < 18; y++){
                for (var x = 0; x < 20; x++){
                    if (x < x1 || x > x2 || y < y1 || y > y2){
                        if (changeOutside){
                            gpu.setSGBAttr(x,y,outsidePalette);
                        }
                    }
                    else if (x > x1 && x < x2 && y > y1 && y < y2){
                        if (changeInside){
                            gpu.setSGBAttr(x,y,insidePalette);
                        }
                    }
                    else{
                        if (changeSurrounding){
                            gpu.setSGBAttr(x,y,surroundingPalette);
                        }
                    }
                }
            }
        }
    }

    function ATTR_CHR(){//sequential attr assign
        var x = commandData[1];
        var y = commandData[2];
        var count = (commandData[3] << 8) || commandData[4];
        if (commandData[5] == 0){//left to right mode
            for (var i = 0; i < count; i++){
                var palette = (commandData[6 + (i >> 2)] >> ((i & 3) * 2)) & 3;
                gpu.setSGBAttr(x++,y,palette);
                if (x > 20){
                    x -= 20;
                    y++;
                    if (y > 18)
                        y -= 18;
                }
            }
        }
        else{//top to bottom mode
            for (var i = 0; i < count; i++){
                var palette = (commandData[6 + (i >> 2)] >> ((i & 3) * 2)) & 3;
                gpu.setSGBAttr(x,y++,palette);
                if (y > 18){
                    y -= 18;
                    x++;
                    if (x > 20)
                        x -= 20;
                }
            }

        }
    }

    function ATTR_DIV(){//division attr assign
        var afterPalette = commandData[1] & 3;
        var beforePalette = (commandData[1] >> 2) & 3;
        var onPalette = (commandData[1] >> 4) & 3;
        var position = commandData[2];
        if ((commandData[1] & 64) != 0){//vertical
            for (var y = 0; y < 18; y++){
                var palette;
                if (y < position)
                    palette = beforePalette;
                else if (y > position)
                    palette = afterPalette;
                else
                    palette = onPalette;
                for (var x = 0; x < 20; x++){
                    gpu.setSGBAttr(x,y,palette);
                }
            }
        }
        else{
            for (var x = 0; x < 20; x++){
                var palette;
                if (x < position)
                    palette = beforePalette;
                else if (x > position)
                    palette = afterPalette;
                else
                    palette = onPalette;
                for (var y = 0; y < 18; y++){
                    gpu.setSGBAttr(x,y,palette);
                }
            }
        }
    }

    function ATTR_LIN(){
        var dataSets = commandData[1];
        for (var i = 0; i < dataSets; i++){
            var lineNumber = commandData[2+i] & 0x1F;
            var palette = (commandData[2+i] >> 5) & 3;
            var horizontal = commandData[2+i] & 0x80 != 0;
            if (horizontal){
                for (var x = 0; x < 20; x++){
                    gpu.setSGBAttr(x,lineNumber,palette);
                }
            }
            else{
                for (var y = 0; y < 18; y++){
                    gpu.setSGBAttr(lineNumber,y,palette);
                }
            }
        }
    }


    function inputBit(value){
        if (mode == WAITING){
            if (value == RESET){
                mode = READING;
                bitsToGo = 128;
            }
            return;
        }
        else if (bitsToGo == 0){
            var commandPacketLength = commandData[0] & 7;
            var PacketsRead = bitsRead >> 7;
            if (commandPacketLength == PacketsRead){
                executeCommand();
                bitsRead = 0;
            }
            mode = WAITING;
        }
        else{
            bitsToGo--;
            var curByte = bitsRead >> 3;
            var byteBit = bitsRead & 7;
            if (value == 1){
                commandData[curByte] |= 1 << byteBit;
            }
            else{
                commandData[curByte] &= ~(1 << byteBit);
            }
            bitsRead++;
        }
    }

    function MLT_REQ(){
        switch (commandData[1] & 3){
            case 0:
                joypad.setMaxPlayers(1);
                break;
            case 1:
                joypad.setMaxPlayers(2);
                break;
            case 3:
                joypad.setMaxPlayers(4);
                break;
        }

    }

    function MASK_EN(){
        gpu.setMaskingMode(commandData[1] & 3);
    }

    function printCommandName(){
        console.log(getCommandName(commandData[0] >> 3));
    }

    var commandNames = ["PAL01","PAL23","PAL03","PAL12","ATTR_BLK","ATTR_LIN","ATTR_DIV",
                        "ATTR_CHR","SOUND","SOU_TRN","PAL_SET","PAL_TRN","MASK_EN","TEST_EN",
                        "ICON_EN","DATA_SND","DATA_TRN","MLT_REQ","JUMP","CHR_TRN","PCT_TRN",
                        "ATTR_TRN","ATTR_SET","MASK_EN","OBJ_TRN"];

    var commandFunctions = [
        PAL01,                              //0x00
        PAL23,                              //0x01
        PAL03,                              //0x02
        PAL12,                              //0x03
        ATTR_BLK,                           //0x04
        ATTR_LIN,                           //0x05
        ATTR_DIV,                           //0x06
        ATTR_CHR,                           //0x07
        printCommandName,//SOUND            //0x08
        printCommandName,//SOU_TRN          //0x09
        PAL_SET,                            //0x0A
        PAL_TRN,                            //0x0B
        printCommandName,//ATRC_EN          //0x0C
        printCommandName,//TEST_EN          //0x0D
        printCommandName,//ICON_EN          //0x0E
        printCommandName,//DATA_SND         //0x0F
        printCommandName,//DATA_TRN         //0x10
        MLT_REQ,                            //0x11
        printCommandName,//JUMP             //0x12
        printCommandName,//CHR_TRN          //0x13
        printCommandName,//PCT_TRN          //0x14
        ATTR_TRN,                           //0x15
        ATTR_SET,                           //0x16
        MASK_EN,                            //0x17
        printCommandName //OBJ_TRN          //0x18
    ];

    function executeCommand(){
        var command = commandData[0] >> 3;
        if (command < commandFunctions.length)
            commandFunctions[command]();
        else
            printCommandName();
    }

    function getCommandName(command){
        if (command < commandNames.length)
            return commandNames[command];
        return "UNKNWON_COMMAND";
    }

    return SGB;
})