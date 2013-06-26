define(function(){
    var PPUEmulator = {};

    var spriteRAM = new Uint8Array(0xFF);

    var memoryController;
    var NMIOnVBlank = false;
    var largeSprites = false;
    var patternTableBGAddr = 0;
    var patternTableSPRAddr = 0;
    var vramAddressIncrement = 1;
    var nameTableScrollAddress= 0x2000;
    var colorEmphasis = 0;
    var spritesVisible = false;
    var backgroundVisible = false;
    var spriteClipping = false;
    var backgroundClipping = false;
    var monochromeMode = false;

    var spriteRAMAddress = 0;

    var vblank = false;//true when in vblank
    var sprite0Collision = false;//true if sprite 0 collides with background
    var tooManySprites = false;//true when more than 8 sprites are on a scan line

    PPUEmulator.setMemoryController = function(m){
        memoryController = m;
    }

    function writeStatus(){
        memoryController.writeByte(0x2002,
            (vblank ? 0x80 : 0) |
            (sprite0Collision ? 0x40 : 0) |
            (tooManySprites ? 0x20 : 0),true);
    }

    PPUEmulator.IORegisterWritten = function(address, value){
        switch (address){
            case 0x2000://PPU Control Register 1
                NMIOnVBlank = (value & 0x80) != 0;
                //bit6 is mater/slave selection and is unused
                largeSprites = (value & 0x20) != 0;
                patternTableBGAddr = (value & 0x10) == 0 ? 0 : 0x1000;
                patternTableSPRAddr = (value & 0x08) == 0 ? 0 : 0x1000;
                vramAddressIncrement = (value & 0x04) == 0 ? 1 : 32;
                nameTableScrollAddress = 0x2000 + (value & 3) * 0x400;
                break;
            case 0x2001://PPU Control Register 2
                colorEmphasis = (value >> 5) & 7;
                spritesVisible = (value & 0x10) != 0;
                backgroundVisible = (value & 0x08) != 0;
                spriteClipping = (value & 0x04) == 0;
                backgroundClipping = (value & 0x02) == 0;
                monochromeMode = (value & 0x01) != 0;
                break;
            case 0x2002://PPU Status Register (Read Only)
                writeStatus();
                break;
            case 0x2003://SPR-RAM Address Register
                spriteRAMAddress = value;
                memoryController.writeByte(0x2004,spriteRAM[spriteRAMAddress],true);
                break;
            case 0x2004://SPR-RAM Data Register
                spriteRAM[spriteRAMAddress] = value;
                memoryController.writeByte(0x2003,spriteRAMAddress + 1);
                break;
            case 0x2005://PPU Background Scrolling Offset
            case 0x2006://VRAM Address Register
            case 0x2007://VRAM Read/Write Data Register
            case 0x4014://Sprite DMA
                var source = value << 8;
                for (var i = 0; i < 0xFF; i++){
                    memoryController.writeByte(0x2004,memoryController.readByte(source++));
                }
                break;
        }
    }


    return PPUEmulator;

});