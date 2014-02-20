define(["CopyUtils"],function(CopyUtils){
    "use strict";

    var GPUEmulator = {};
    var vram = new Uint8Array(0x4000);
    var oam = new Uint8Array(0xA0);

    var SCREEN_WIDTH = 160, SCREEN_HEIGHT = 144;

    var notTransparentBG = [];
    var oamBlocked = []

    for (var i = 0; i < SCREEN_WIDTH; i++){
        notTransparentBG[i] = [];
        oamBlocked[i] = [];
    }

    var cpu;
    var memoryController;

    var modeClock = 0, mode = HBLANK, curLine = 0;

    var lcdEnabled = false;

    var HBLANK = 0, VBLANK = 1, OAM = 2, VRAM = 3;
    var SCY = 0, WX = 0;
    var SCX = 0, WY = 0;

    var frameSkip = 0;
    var curSkip = 0;

    var colors = [new Uint8Array([0xFF,0xFF,0xFF,0xFF]), new Uint8Array([0xAA,0xAA,0xAA,0xFF]), new Uint8Array([0x55,0x55,0x55,0xFF]), new Uint8Array([0,0,0,0xFF])];
    var bgPal = [0,0,0,0];
    var obj0Pal = [0,0,0,0];
    var obj1Pal = [0,0,0,0];

    var objHeights = [8,16];
    var objHeight = objHeights[0];

    var bgEnabled = false, windowEnabled = false, objEnabled = false;

    var bgMap = 0, windowMap = 0;
    var bgDataLocation = 0;

    var coincidenceIntEnabled = false, oamIntEnabled = false, hblankIntEnabled = false, vblankIntEnabled = false;;
    var LYC = 0;

    var gbcBGPal = new Uint8Array(0x40);
    var curBGColorIndex = 0;
    var autoIncBGIndex = false;
    var gbcOBJPal = new Uint8Array(0x40);
    var curOBJColorIndex = 0;
    var autoIncOBJIndex = false;

    var precompiledBGPal = [[],[],[],[],[],[],[],[]];
    var precompiledOBJPal = [[],[],[],[],[],[],[],[]];

    var gbcEnabled;

    var vramBank = 0;

    var hdmaSource = 0, hdmaDest = 0, hdmaTransferRemaining = 0;
    var hdmaRunning = false;

    var display;
    var currentFrame;
    var listeners = [];

    var SGBPal = [];
    var SGBAttrMap = new Uint8Array(20*18);

    GPUEmulator.setSGBAttr = function(x,y,palette){
        SGBAttrMap[x+y*20] = palette;
    }


    var MASK_NONE = 0, MASK_FREEZE = 1, MASK_BLACK = 2, MASK_BG = 3;

    var maskingMode = MASK_NONE;

    GPUEmulator.getSaveState = function(){
        return {
            vram: CopyUtils.makeUntypedArrayCopy(vram),
            oam: CopyUtils.makeUntypedArrayCopy(oam),
            modeClock: modeClock,
            mode: mode,
            curLine: curLine,
            lcdEnabled: lcdEnabled,
            SCY: SCY,
            SCX: SCX,
            WX: WX,
            WY: WY,
            frameSkip: frameSkip,
            curSkip: curSkip,
            colors: CopyUtils.makeUntypedArrayCopy(colors),
            bgPal: CopyUtils.makeUntypedArrayCopy(bgPal),
            obj0Pal: CopyUtils.makeUntypedArrayCopy(obj0Pal),
            obj1Pal: CopyUtils.makeUntypedArrayCopy(obj1Pal),
            objHeight: objHeight,
            bgEnabled: bgEnabled,
            windowEnabled: windowEnabled,
            objEnabled: objEnabled,
            bgMap: bgMap,
            windowMap: windowMap,
            bgDataLocation: bgDataLocation,
            coincidenceIntEnabled: coincidenceIntEnabled,
            oamIntEnabled: oamIntEnabled,
            hblankIntEnabled: hblankIntEnabled,
            vblankIntEnabled: vblankIntEnabled,
            LYC: LYC,
            gbcBGPal: CopyUtils.makeUntypedArrayCopy(gbcBGPal),
            curBGColorIndex: curBGColorIndex,
            autoIncBGIndex: autoIncBGIndex,
            gbcOBJPal: CopyUtils.makeUntypedArrayCopy(gbcOBJPal),
            curOBJColorIndex: curOBJColorIndex,
            autoIncOBJIndex: autoIncOBJIndex,
            precompiledBGPal:  CopyUtils.makeUntypedArrayCopy(precompiledBGPal),
            precompiledOBJPal: CopyUtils.makeUntypedArrayCopy(precompiledOBJPal),
            gbcEnabled: gbcEnabled,
            vramBank: vramBank,
            hdmaSource: hdmaSource,
            hdmaDest: hdmaDest,
            hdmaTransferRemaining: hdmaTransferRemaining,
            hdmaRunning: hdmaRunning,
            SGBPal: CopyUtils.makeUntypedArrayCopy(SGBPal),
            SGBAttrMap: CopyUtils.makeUntypedArrayCopy(SGBAttrMap)
        };
    }

    GPUEmulator.setSaveState = function(saveState){
        CopyUtils.copy(saveState.vram,vram);
        CopyUtils.copy(saveState.oam,oam);
        modeClock = saveState.modeClock;
        mode = saveState.mode;
        curLine = saveState.curLine;
        lcdEnabled = saveState.lcdEnabled;
        SCY = saveState.SCY;
        SCX = saveState.SCX;
        WX = saveState.WX;
        WY = saveState.WY;
        frameSkip = saveState.frameSkip;
        curSkip = saveState.curSkip;
        CopyUtils.copy(saveState.colors,colors);
        CopyUtils.copy(saveState.bgPal,bgPal);
        CopyUtils.copy(saveState.obj0Pal,obj0Pal);
        CopyUtils.copy(saveState.obj1Pal,obj1Pal);
        objHeight = saveState.objHeight;
        bgEnabled = saveState.bgEnabled;
        windowEnabled = saveState.windowEnabled;
        objEnabled = saveState.objEnabled;
        bgMap = saveState.bgMap;
        windowMap = saveState.windowMap;
        bgDataLocation = saveState.bgDataLocation;
        coincidenceIntEnabled = saveState.coincidenceIntEnabled;
        oamIntEnabled = saveState.oamIntEnabled;
        hblankIntEnabled = saveState.hblankIntEnabled;
        vblankIntEnabled = saveState.vblankIntEnabled;
        LYC = saveState.LYC;
        CopyUtils.copy(saveState.gbcBGPal,gbcBGPal);
        curBGColorIndex = saveState.curBGColorIndex;
        autoIncBGIndex = saveState.autoIncBGIndex;
        CopyUtils.copy(saveState.gbcOBJPal,gbcOBJPal);
        curOBJColorIndex = saveState.curOBJColorIndex;
        autoIncOBJIndex = saveState.autoIncOBJIndex;
        CopyUtils.copy(saveState.precompiledBGPal,precompiledBGPal);
        CopyUtils.copy(saveState.precompiledOBJPal,precompiledOBJPal);
        gbcEnabled = saveState.gbcEnabled;
        vramBank = saveState.vramBank;
        hdmaSource = saveState.hdmaSource;
        hdmaDest = saveState.hdmaDest;
        hdmaTransferRemaining = saveState.hdmaTransferRemaining;
        hdmaRunning = saveState.hdmaRunning;
        CopyUtils.copy(saveState.SGBPal,SGBPal);
        CopyUtils.copy(saveState.SGBAttrMap,SGBAttrMap);
    }

    var internalDisplay = $("<canvas width='" + SCREEN_WIDTH + "'height='" + SCREEN_HEIGHT + "'></canvas>")[0].getContext("2d");

    GPUEmulator.setMaskingMode = function(mode){
        maskingMode = mode;
    }

    GPUEmulator.getVRAM = function(){
        return vram;
    }

    GPUEmulator.reset = function(){
        var g = display;
        g.fillStyle = "#FFFFFF"
        g.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        for (var i = 0, li = listeners.length; i < li; i++){
            listeners[i].frameRendered(this);
        }

        currentFrame = internalDisplay.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);

        var frameTimes = [];
        for (var i = 0, li = vram.length; i < li; i++)
            vram[i] = 0;
        for (var i = 0, li = oam.length; i < li; i++)
            oam[i] = 0;
        for (var i = 0, li = bgPal.length; i < li; i++)
            bgPal[i] = 0;
        for (var i = 0, li = obj0Pal.length; i < li; i++)
            obj0Pal[i] = 0;
        for (var i = 0, li = obj1Pal.length; i < li; i++)
            obj1Pal[i] = 0;
        for (var i = 0, li = gbcBGPal.length; i < li; i++)
            gbcBGPal[i] = 0;
        for (var i = 0, li = gbcOBJPal.length; i < li; i++)
            gbcOBJPal[i] = 0;

        for (var i = 0; i < 8; i++){
            for (var j = 0; j < 4; j++){
                precompiledBGPal[i][j] = new Uint8Array(4);
                precompiledBGPal[i][j][3] = 0xFF;
                precompiledOBJPal[i][j] = new Uint8Array(4);
                precompiledOBJPal[i][j][3] = 0xFF;
            }
            this.precompileBGPal(i);
            this.precompileOBJPal(i);
        }

        SGBPal = [];
        var color0 = new Uint8Array([0xFF,0xFF,0xFF,0xFF]);
        for (var i = 0; i < 8; i++){
            SGBPal[i] = [color0, new Uint8Array([0xAA,0xAA,0xAA,0xFF]), new Uint8Array([0x55,0x55,0x55,0xFF]), new Uint8Array([0,0,0,0xFF])];
        }
        for (var i = 0, li = SGBAttrMap.length; i < li; i++){
            SGBAttrMap[i] = 0;
        }

        modeClock = 0;
        mode = HBLANK;
        curLine = 0;
        lcdEnabled = false;
        SCY = 0;
        WX = 0;
        SCX = 0;
        WY = 0;
        curSkip = 0;
        objHeight = objHeights[0];
        bgEnabled = false;
        windowEnabled = false;
        objEnabled = false;
        bgMap = 0;
        windowMap = 0;
        bgDataLocation = 0;
        coincidenceIntEnabled = false;
        oamIntEnabled = false;
        hblankIntEnabled = false;
        LYC = 0;
        curBGColorIndex = 0;
        autoIncBGIndex = false;
        curOBJColorIndex = 0;
        autoIncOBJIndex = false;
        vramBank = 0;
        hdmaSource = 0;
        hdmaDest = 0;
        hdmaTransferRemaining = 0;
        hdmaRunning = false;
        maskingMode = MASK_NONE;


        memoryController.writeByte(0xFF55,0xFF,true);
    }

    GPUEmulator.setGBCEnabled = function(enabled){
        gbcEnabled = enabled;
    }

    GPUEmulator.setFrameSkip = function(skip){
        frameSkip = skip;
    }

    GPUEmulator.getBGPal = function(index){
        return precompiledBGPal[index];
    }

    GPUEmulator.getOBJPal = function(index){
        return precompiledOBJPal[index];
    }

    GPUEmulator.precompileBGPal = function(index){
        for (var i = 0; i < 4; i++){
            var val = gbcBGPal[index * 8 + i * 2] | (gbcBGPal[index * 8 + i * 2 + 1] << 8);
            var red = val & 0x1F;
            var green = (val >> 5) & 0x1F;
            var blue = (val >> 10) & 0x1F;
            red = (red << 3) & 0xFF;
            green = (green << 3) & 0xFF;
            blue = (blue << 3) & 0xFF;
            precompiledBGPal[index][i][0] = red;
            precompiledBGPal[index][i][1] = green;
            precompiledBGPal[index][i][2] = blue;
        }

    }

    GPUEmulator.precompileOBJPal = function(index){
        for (var i = 0; i < 4; i++){
            var val = gbcOBJPal[index * 8 + i * 2] | (gbcOBJPal[index * 8 + i * 2 + 1] << 8);
            var red = val & 0x1F;
            var green = (val >> 5) & 0x1F;
            var blue = (val >> 10) & 0x1F;
            red = (red << 3) & 0xFF;
            green = (green << 3) & 0xFF;
            blue = (blue << 3) & 0xFF;
            precompiledOBJPal[index][i][0] = red;
            precompiledOBJPal[index][i][1] = green;
            precompiledOBJPal[index][i][2] = blue;
        }

    }

    GPUEmulator.setSGBPal = function(index, data){
        for (var i = 0; i < 4; i++){
            var val = data[i * 2] | (data[i * 2 + 1] << 8);
            var red = val & 0x1F;
            var green = (val >> 5) & 0x1F;
            var blue = (val >> 10) & 0x1F;
            red = (red << 3) & 0xFF;
            green = (green << 3) & 0xFF;
            blue = (blue << 3) & 0xFF;
            SGBPal[index][i][0] = red;
            SGBPal[index][i][1] = green;
            SGBPal[index][i][2] = blue;
        }
    }

    GPUEmulator.setCPU = function(c){
        cpu = c;
    }

    GPUEmulator.setDisplay = function(d){
        display = d;
    }

    GPUEmulator.setMemoryController = function(mController){
        memoryController = mController;
    }

    GPUEmulator.addListener = function(listener){
        listeners.push(listener);
    }

    GPUEmulator.writeByte = function(address, value){
        switch (address & 0xF000){
            case 0x8000:
            case 0x9000://VRAM
                if (gbcEnabled)
                    vram[address - 0x8000 + vramBank * 0x2000] = value;
                else
                    vram[address - 0x8000] = value;
                return;
            case 0xF000:
                if (address >= 0xFE00 && address <= 0xFE9F){ // oam;
                    oam[address - 0xFE00] = value;
                    return;
                }
                break;
        }
        console.error("GPU attempted to write to 0x" + address.toString(16).toUpperCase());
    }

    GPUEmulator.readByte = function(address){
        switch (address & 0xF000){
            case 0x8000:
            case 0x9000://VRAM
                if (gbcEnabled)
                    return vram[address - 0x8000 + vramBank * 0x2000];
                else
                    return vram[address - 0x8000];
            case 0xF000:
                if (address >= 0xFE00 && address <= 0xFE9F){ // oam;
                    return oam[address - 0xFE00];
                }
                break;
        }
        console.error("GPU attempted to read from 0x" + address.toString(16).toUpperCase());
    }

    function horizontalLine(y,color){
        for (var x = 0; x < SCREEN_WIDTH; x++){
            setPixel(x,y,color);
        }
    }

    function setPixel(x,y,color){
        //currentFrame.data.set(color,(x + y * SCREEN_WIDTH) << 2);

        var start = x + y * SCREEN_WIDTH << 2;
        for (i = 0; i < 4; i++){
            currentFrame.data[start++] = color[i];
        }
    }

    var spritesThisLine = new Uint8Array(10);
    var xPoses = new Uint8Array(10);

    GPUEmulator.drawLine = function(){
        if (frameSkip != curSkip)
            return;
        //draw background
        var realY = curLine;
        if (gbcEnabled || bgEnabled){
            var y = realY + SCY;
            if (y > 255)
                y -= 256;
            var bgY = (y & 0xF8) << 2;
            if (bgMap == 0)
                bgY += 0x1800;
            else
                bgY += 0x1C00;
            var yInTile = y & 7;
            for (var realX = 0; realX < SCREEN_WIDTH; realX++){
                var x = realX + SCX;
                if (x > 255)
                    x -= 256;
                var xInTile = x & 7;
                var tile = vram[bgY + (x >> 3)];
                var gbcPal = [];
                var bankNo = 0;
                var oamBlock = false;
                var yInTileCalc = yInTile;
                if (gbcEnabled){
                    var flags = vram[0x2000 + bgY + (x >> 3)];
                    gbcPal = this.getBGPal(flags & 7);
                    bankNo = (flags >> 3) & 1;
                    if ((flags & 0x20) == 0x20)
                        xInTile = 7 - xInTile;
                    if ((flags & 0x40) == 0x40)
                        yInTileCalc = 7 - yInTileCalc;
                    oamBlock = (flags & 0x80) == 0x80;
                }
                var vramOffset;
                if (bgDataLocation == 1)
                    vramOffset = (tile << 4) + (yInTileCalc << 1) + bankNo * 0x2000;
                else
                    vramOffset = (memoryController.signByte(tile) << 4) + (yInTileCalc << 1) + 0x1000 + bankNo * 0x2000;
                var byteData = vram[vramOffset];
                var byteData2 = vram[vramOffset+1];
                var bit1 = (byteData >> (7 - xInTile)) & 1;
                var bit2 = (byteData2 >> (7 - xInTile)) & 1;
                var color = (bit2 << 1) | bit1;
                if (gbcEnabled)
                    setPixel(realX, realY, gbcPal[color]);
                else
                    setPixel(realX,realY,SGBPal[SGBAttrMap[(realY >> 3) * 20 + (realX >> 3)]][bgPal[color]]);
                notTransparentBG[realX][realY] = color != 0;
                oamBlocked[realX][realY] = oamBlock;
            }
        }
        else{
            horizontalLine(realY,colors[0]);
            for (var i = 0 ; i < 160; i++){
                notTransparentBG[i][realY] = false;
                oamBlocked[i][realY] = false;
            }
        }
        if (windowEnabled && realY >= WY){
            var y = realY - WY;
            var bgY = (y & 0xF8) << 2;
            if (windowMap == 0)
                bgY += 0x1800;
            else
                bgY += 0x1C00;
            var yInTile = y & 7;
            for (var x = 0; x < SCREEN_WIDTH + 7; x++){//in cases WX is set to 0
                var realX = x + WX - 7;
                if (realX >= 160)
                    break;
                if (realX >= 0){
                    if (x > 255)
                        x -= 256;
                    var xInTile = x & 7;
                    var tile = vram[bgY + (x >> 3)];
                    var gbcPal = [];
                    var bankNo = 0;
                    var oamBlock = false;
                    var yInTileCalc = yInTile;
                    if (gbcEnabled){
                        var flags = vram[0x2000 + bgY + (x >> 3)];
                        gbcPal = this.getBGPal(flags & 7);
                        bankNo = (flags >> 3) & 1;
                        if ((flags & 0x20) == 0x20)
                            xInTile = 7 - xInTile;
                        if ((flags & 0x40) == 0x40)
                            yInTileCalc = 7 - yInTileCalc;
                        oamBlock = (flags & 0x80) == 0x80;
                    }
                    var vramOffset;
                    if (bgDataLocation == 1)
                        vramOffset = (tile << 4) + (yInTileCalc << 1) + bankNo * 0x2000;
                    else
                        vramOffset = (memoryController.signByte(tile) << 4) + (yInTileCalc << 1) + 0x1000 + bankNo * 0x2000;
                    var byteData = vram[vramOffset];
                    var byteData2 = vram[vramOffset+1];
                    var bit1 = (byteData >> (7 - xInTile)) & 1;
                    var bit2 = (byteData2 >> (7 - xInTile)) & 1;
                    var color = (bit2 << 1) | bit1;
                    if (gbcEnabled)
                        setPixel(realX, realY, gbcPal[color]);
                    else
                        setPixel(realX,realY,SGBPal[SGBAttrMap[(realY >> 3) * 20 + (realX >> 3)]][bgPal[color]]);
                    notTransparentBG[realX][realY] = color != 0;
                    oamBlocked[realX][realY] = oamBlock;
                }
            }
        }
        if (objEnabled){
            var count = 0;
            //xPoses spritesThisLine
            for (var i = 0; i < 40 && count < 10; i++){
                var yPos = (oam[i * 4]) - 16;
                var xPos = (oam[i * 4 + 1]) - 8;
                if (yPos <= realY && yPos + objHeight - 1 >= realY){
                    var j;
                    for (j = 0; j < count && ((!gbcEnabled && xPoses[j] > xPos) || (xPoses[j] == xPos && spritesThisLine[j] > i)); j++);
                    for (var k = count - j - 1; k >= 0; k--){
                        spritesThisLine[j+k+1] = spritesThisLine[j+k];
                        xPoses[j+k+1] = spritesThisLine[j+k];
                    }
                    spritesThisLine[j] = i;
                    xPoses[j] = xPos;
                    count++;
                }
            }

            for (var s = 0; s < count; s++){
                var i = spritesThisLine[s];
                var yPos = (oam[i * 4]) - 16;
                var xPos = (oam[i * 4 + 1]) - 8;
                if (yPos + 16 > 0 && yPos + 16 < 160 && xPos + 8 > 0 && xPos + 8 < 168 && yPos <= realY && yPos + objHeight - 1 >= realY){
                    var index = oam[i * 4 + 2];
                    if (objHeight == 16)
                        index &= 0xFE;//in double height mode the least significant bit is ignored
                    var flags = oam[i * 4 + 3];
                    var pal = obj0Pal;
                    if ((flags & (1 << 4)) != 0)
                        pal = obj1Pal;
                    var yFlip = (flags & (1 << 6)) != 0;
                    var xFlip = (flags & (1 << 5)) != 0;
                    var behindBG = (flags & 0x80) != 0;
                    var bankNo = 0;
                    if (gbcEnabled){
                        pal = this.getOBJPal(flags & 7);
                        bankNo = (flags >> 3) & 1;
                    }
                    if (xFlip)
                        xPos += 7;
                    for (var x = 0; x < 8; x++){
                        if (xPos >= 0 && xPos < 160){
                            var dataPos = index * 16;
                            if (yFlip)
                                dataPos += (objHeight - 1 - (realY - yPos)) * 2;
                            else
                                dataPos += (realY - yPos) * 2;
                            dataPos += 0x2000 * bankNo;
                            var byteData = vram[dataPos];
                            var byteData2 = vram[dataPos+1];
                            var bit1 = (byteData >> (7 - x)) & 1;
                            var bit2 = (byteData2 >> (7 - x)) & 1;
                            var color = (bit2 << 1) | bit1;
                            if (color != 0)
                                if ((!behindBG || !notTransparentBG[xPos][realY]) && (!oamBlocked[xPos][realY] || !notTransparentBG[xPos][realY]))
                                    if (gbcEnabled)
                                        setPixel(xPos, realY, pal[color]);
                                    else
                                        setPixel(xPos,realY,SGBPal[SGBAttrMap[(realY >> 3) * 20 + (xPos >> 3)]][pal[color]]);
                        }
                        if (xFlip){
                            xPos--;
                            if (xPos < 0)
                                break;
                        }
                        else{
                            xPos++;
                            if (xPos > 160)
                                break;
                        }
                    }
                }
            }
        }
    }

    GPUEmulator.pushFrame = function(){
        if (curSkip >= frameSkip){
            if (maskingMode == MASK_NONE){
                internalDisplay.putImageData(currentFrame,0,0);
                display.drawImage(internalDisplay.canvas,0,0,parseInt(display.canvas.getAttribute("width")),parseInt(display.canvas.getAttribute("height")));
            }
            curSkip = 0;
        }
        else curSkip++;
        for (var i = 0, li = listeners.length; i < li; i++){
            listeners[i].frameRendered(this);
        }
    }

    GPUEmulator.updateCycles = function(cycles){
        modeClock += cycles;
        switch (mode){
            case OAM:
                if (modeClock >= 80){
                    modeClock = 0;
                    this.setMode(VRAM);
                }
                break;
            case VRAM:
                if (modeClock >= 172){
                    modeClock = 0;
                    this.setMode(HBLANK);
                    if (lcdEnabled)
                        this.drawLine();
                }
                break;
            case HBLANK:
                if (modeClock >= 204){
                    modeClock = 0;
                    curLine++;
                    this.checkLYCInt();
                    memoryController.writeByte(0xFF44, curLine);
                    if (curLine >= 144){
                        this.setMode(VBLANK);
                        this.pushFrame();
                        return true;
                    }
                    else{
                        this.setMode(OAM);
                    }
                }
                break;
            case VBLANK:
                if (modeClock >= 456){
                    modeClock = 0;
                    curLine++;
                    this.checkLYCInt();
                    memoryController.writeByte(0xFF44, curLine);
                    if (curLine > 153){
                        curLine = 0;
                        memoryController.writeByte(0xFF44, curLine);
                        this.checkLYCInt();
                        this.setMode(OAM);
                    }
                }
                break;
        }
        return false;
    }

    GPUEmulator.checkLYCInt = function(){
        memoryController.writeByte(0xFF41,memoryController.readByte(0xFF41));
        if (LYC == curLine && coincidenceIntEnabled)
            cpu.interrupt(INT_LCDSTAT);
    }

    GPUEmulator.setMode = function(m){
        mode = m;
        memoryController.writeByte(0xFF41, memoryController.readByte(0xFF41));
        if (mode == HBLANK && hdmaRunning){
            for (var j = 0; j < 0x10; j++){
                var data = memoryController.readByte(hdmaSource++);
                vram[vramBank * 0x2000 + hdmaDest++] = data;
            }
            if (--hdmaTransferRemaining == 0){
                hdmaRunning = false;
                memoryController.writeByte(0xFF55,0xFF,true);
            }
            else{
                memoryController.writeByte(0xFF55, hdmaTransferRemaining - 1,true);
            }
        }
        if (!lcdEnabled)
            return;
        switch (mode){
            case VBLANK:
                cpu.interrupt(INT_VBLANK);
                if (vblankIntEnabled)
                    cpu.interrupt(INT_LCDSTAT);
                break;
            case HBLANK:
                if (hblankIntEnabled)
                    cpu.interrupt(INT_LCDSTAT);
                break;
            case OAM:
                if (oamIntEnabled)
                    cpu.interrupt(INT_LCDSTAT);
                break;
        }
    }


    GPUEmulator.IORegisterWritten = function(address, value) {
        switch (address){
            case 0xFF40: //LCDC
            {
                lcdEnabled = (value & 0x80) == 0x80;
                windowMap = (value >> 6) & 1;
                windowEnabled = (value & 0x20) == 0x20;
                bgDataLocation = (value >> 4) & 1;
                bgMap = (value >> 3) & 1;
                objHeight = objHeights[(value >> 2) & 1];
                objEnabled = (value & 2) == 2;
                bgEnabled = (value & 1) == 1;
                break;
            }
            case 0xFF41: //LCD STAT
            {
                coincidenceIntEnabled = (value & 0x40) == 0x40;
                oamIntEnabled = (value & 0x20) == 0x20;
                vblankIntEnabled = (value & 0x10) == 0x10;
                hblankIntEnabled = (value & 0x8) == 0x8;
                value &= 0xF8;
                if (LYC == curLine)
                    value |= 4;
                value |= mode;
                memoryController.writeByte(address, value, true);
                break;
            }
            case 0xFF42: //SCY
            {
                SCY = value;
                break;
            }
            case 0xFF43: //SCX
            {
                SCX = value;
                break;
            }
            case 0xFF45: //LYC
            {
                LYC = value;
                this.checkLYCInt();
                break;
            }
            case 0xFF46: //DMA transfer
            {
                var pos = value << 8;
                for (var i = 0, li = oam.length; i < li; i++){
                    oam[i] = memoryController.readByte(pos + i);
                }
                break;
            }
            case 0xFF47: //BG palette
            {
                for (var i = 0; i < 4; i++){
                    bgPal[i] = (value >> (i * 2)) & 3;
                }
                break;
            }
            case 0xFF48: //OBJ0 pal
            {
                for (var i = 1; i < 4; i++){
                    obj0Pal[i] = (value >> (i * 2)) & 3;
                }
                break;
            }
            case 0xFF49: //OBJ1 pal
            {
                for (var i = 1; i < 4; i++){
                    obj1Pal[i] = (value >> (i * 2)) & 3;
                }
                break;
            }
            case 0xFF4A: //WY
            {
                WY = value;
                break;
            }
            case 0xFF4B: //WX
            {
                WX = value;
                break;
            }
            case 0xFF68: //background palette index
            {
                curBGColorIndex = value & 0x3F;
                autoIncBGIndex = (value & 0x80) == 0x80;
                memoryController.writeByte(0xFF69, gbcBGPal[curBGColorIndex],true);
                break;
            }
            case 0xFF69: //set background palette
            {
                gbcBGPal[curBGColorIndex] = value;
                this.precompileBGPal(curBGColorIndex >> 3);
                if (autoIncBGIndex){
                    curBGColorIndex++;
                    curBGColorIndex &= 0x3F;
                    memoryController.writeByte(0xFF68, curBGColorIndex | 0x80,true);
                }
                break;
            }
            case 0xFF6A: //background palette index
            {
                curOBJColorIndex = value & 0x3F;
                autoIncOBJIndex = (value & 0x80) == 0x80;
                memoryController.writeByte(0xFF6B, gbcBGPal[curOBJColorIndex],true);
                break;
            }
            case 0xFF6B: //set background palette
            {
                gbcOBJPal[curOBJColorIndex] = value;
                this.precompileOBJPal(curOBJColorIndex >> 3);
                if (autoIncOBJIndex){
                    curOBJColorIndex++;
                    curOBJColorIndex &= 0x3F;
                    memoryController.writeByte(0xFF6A, curOBJColorIndex | 0x80, true);
                }
                break;
            }
            case 0xFF4F: //select VRAM Bank
            {
                vramBank = value & 1;
                break;
            }
            case 0xFF51: //hdma source, high
            {
                hdmaSource = (hdmaSource & 0xFF) | (value << 8);
                break;
            }
            case 0xFF52: //hdma source, low
            {
                hdmaSource = (hdmaSource & 0xFF00) | (value & 0xF0);
                break;
            }
            case 0xFF53: //hdma dest, high
            {
                hdmaDest = (hdmaDest & 0xFF) | ((value & 0x1F) << 8);
                break;
            }
            case 0xFF54: //hdma dest, low
            {
                hdmaDest = (hdmaDest & 0xFF00) | (value & 0xF0);
                break;
            }
            case 0xFF55: //hdma control
            {
                if (!gbcEnabled)
                    break;
                if ((value & 0x80) == 0){
                    if (!hdmaRunning){
                        for (var i = 0; i < (value & 0x7F) + 1; i++){
                            for (var j = 0; j < 0x10; j++){
                                var data = memoryController.readByte(hdmaSource++);
                                vram[vramBank * 0x2000 + hdmaDest++] = data;
                            }
                        }
                    }
                    else
                        hdmaRunning = false;
                    memoryController.writeByte(0xFF55, 0xFF, true);
                }
                else if (!hdmaRunning){
                    hdmaTransferRemaining = (value & 0x7F) + 1;
                    hdmaRunning = true;
                    memoryController.writeByte(0xFF55, hdmaTransferRemaining - 1,true);
                }
            }
        }
    }

    return GPUEmulator;

});