define(function(){

    var MemoryController = {};

    var ram = new Uint8Array(0x8000);
    var hram = new Uint8Array(0x80);
    var bootROM = new Uint8Array(0x100);
    var ioram = new Uint8Array(0x80);
    var ramBank = 0;
    var biosEnabled = false;
    var gbcEnabled = false;

    var gpu;
    var loadedGame;

    var listeners = [];

    MemoryController.getSaveState = function(){
        var r = new Array(ram.length);
        var hr = new Array(hram.length);
        var br = new Array(bootROM.length);
        var ir = new Array(ioram.length);
        for (var i = 0, li = r.length; i < li; i++){
            r[i] = ram[i];
        }
        for (var i = 0, li = hr.length; i < li; i++){
            hr[i] = hram[i];
        }
        for (var i = 0, li = br.length; i < li; i++){
            br[i] = bootROM[i];
        }
        for (var i = 0, li = ir.length; i < li; i++){
            ir[i] = ioram[i];
        }
        return {
            ram: r,
            hram: hr,
            bootROM: br,
            ioram: ir,
            ramBank: ramBank,
            biosEnabled: biosEnabled,
            gbcEnabled: gbcEnabled
        };
    }

    MemoryController.setSaveState = function(saveState,game){
        for (var i = 0, li = ram.length; i < li; i++){
            ram[i] = saveState.ram[i];
        }
        for (var i = 0, li = hram.length; i < li; i++){
            hram[i] = saveState.hram[i];
        }
        for (var i = 0, li = bootROM.length; i < li; i++){
            bootROM[i] = saveState.bootROM[i];
        }
        for (var i = 0, li = ioram.length; i < li; i++){
            ioram[i] = saveState.ioram[i];
        }
        ramBank = saveState.ramBank;
        biosEnabled = saveState.biosEnabled;
        gbcEnabled = saveState.gbcEnabled;
        loadedGame = game;
    }

    MemoryController.setGBCEnabled = function(enabled){
        gbcEnabled = enabled;
    }

    MemoryController.setLoadedGame = function(game){
        loadedGame = game;
    }

    MemoryController.setGPU = function(g){
        gpu = g;
    }

    MemoryController.addIOListener = function(listener){
        listeners.push(listener);
    }

    MemoryController.readByte = function(offset){
        offset &= 0xFFFF;
        switch (offset & 0xF000){
            case 0x0000:
                if (biosEnabled && offset < 0x100)
                    return bootROM[offset] & 0xFF;
            case 0x1000:
            case 0x2000:
            case 0x3000:
            case 0x4000:
            case 0x5000:
            case 0x6000:
            case 0x7000: //ROM
                return loadedGame.readByte(offset); //game genie read goes here
            case 0xA000:
            case 0xB000: //external RAM   ROM LOADING UNIMPLEMENTED
                return loadedGame.readByte(offset);
            case 0x8000:
            case 0x9000: //VRAM
                return gpu.readByte(offset);
            case 0xC000://RAM
                return  ram[offset - 0xC000] & 0xFF;
            case 0xD000: //RAM
                return  ram[offset - 0xD000 + ramBank * 0x1000] & 0xFF;
            case 0xE000://ECHO
                return  (ram[offset - 0xE000] & 0xFF);
            case 0xF000:
                if (offset >= 0xFF80){
                    return hram[offset - 0xFF80] & 0xFF;
                }
                else if (offset >= 0xFF00){
                    return ioram[offset - 0xFF00];
                }
                else if (offset >= 0xFE00 && offset <= 0xFE9F){ //OAM
                    return gpu.readByte(offset);
                }
                else if (offset <= 0xFDFF){//ECHO
                    return ram[offset - 0xF000 + ramBank * 0x1000] & 0xFF;
                }
        }
    }

    MemoryController.signByte = function(value){
        if ((value & 0x80) == 0x80)
            return value - 0x100;
        return value;
    }

    MemoryController.readSignedByte = function(offset){
        return this.signByte(this.readByte(offset));
    }

    MemoryController.readWord = function(offset){
        offset &= 0xFFFF;
        return this.readByte(offset) | (this.readByte(offset+1) << 8);
    }

    MemoryController.signWord = function(value){
        if ((value & 0x8000) == 0x8000)
            return value - 0x10000;
        return value;
    }

    MemoryController.readSignedWord = function(offset){
        return this.signWord(this.readWord(offset));
    }

    MemoryController.writeRAMByte = function(offset,ramBankNo,data,silent){
        loadedGame.writeRAMByte(offset,ramBankNo,data);
    }

     MemoryController.writeByte = function(offset, data, silent){
        data &= 0xFF;
        offset &= 0xFFFF;
        switch (offset & 0xF000){
            case 0x0000:
            case 0x1000:
            case 0x2000:
            case 0x3000:
            case 0x4000:
            case 0x5000:
            case 0x6000:
            case 0x7000: //ROM
            case 0xA000:
            case 0xB000: //external RAM
                loadedGame.writeByte(offset,data);
                return;
            case 0x8000:
            case 0x9000: //VRAM
                gpu.writeByte(offset, data);
                return;
            case 0xC000:
                ram[offset - 0xC000] = data;
                break;
            case 0xD000: //RAM
                ram[offset - 0xD000 + ramBank * 0x1000] = data;
                return;
            case 0xE000://ECHO
                ram[offset - 0xE000] = data;
                return;
            case 0xF000:
                if (offset >= 0xFF80){
                    hram[offset - 0xFF80] = data;
                    return;
                }
                else if (offset >= 0xFF00){
                    ioram[offset-0xFF00] =  data;
                    if (!silent)
                        this.notifyRegisterChanged(offset,data);
                    return;
                }
                else if (offset >= 0xFE00 && offset <= 0xFE9F){ //OAM
                    gpu.writeByte(offset, data);
                    return;
                }
                else if (offset <= 0xFDFF){//ECHO
                    ram[offset - 0xF000 + ramBank * 0x1000] = data;
                    return;
                }
                break;
            default:
        }
    }

    MemoryController.writeWord = function(offset, data, silent){
        offset &= 0xFFFF;
        this.writeByte(offset, data & 0xFF);
        this.writeByte(offset + 1, (data >> 8) & 0xFF);
    }

    MemoryController.initialize = function(){
        for (var i = 0; i < ram.length; i++)
            ram[i] = 0;
        for (var i = 0; i < hram.length; i++)
            hram[i] = 0;
        ramBank = 1;
        biosEnabled = false;
    }

    MemoryController.notifyRegisterChanged = function(address,value){
        for (var i = 0; i < listeners.length; i++){
            listeners[i].IORegisterWritten(address,value);
        }
    }

    MemoryController.IORegisterWritten = function(address, value){
        switch (address){
            case 0xFF50: //disbale bios
                if (biosEnabled)
                    if (value == 1){
                        biosEnabled = false;
                    }
                break;
            case 0xFF70: //chooser RAM bank
            {
                if (!gbcEnabled)
                    break;
                ramBank = value & 7;
                if (ramBank == 0)
                    ramBank = 1;
            }
        }
    }

    MemoryController.reset = function(){
        for (var i = 0; i < ram.length; i++){
            ram[i] = 0;
        }
        for (var i = 0; i < hram.length; i++){
            hram[i] = 0;
        }
        for (var i = 0; i < ioram.length; i++){
            ioram[i] = 0;
        }
        ramBank = 1;
        biosEnabled = true;
    }

    MemoryController.addIOListener(MemoryController);

    return MemoryController;
});