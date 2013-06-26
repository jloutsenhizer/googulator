define(function(){
    var MemoryBankController2 = {};

    MemoryBankController2.loadROM = function(romData){
        var controller = {};
        controller.ROMData = romData;
        controller.ROMBanks = romData.length >> 14;
        controller.RAMData = new Uint8Array(512);
        controller.currentSecondaryBank = 1;
        controller.RAMEnabled = false;


        controller.reset = function(){
            this.currentSecondaryBank = 1;
            this.RAMEnabled = false;
        }

        controller.cleanup = function(){
        }

        controller.readByte = function(offset) {
            switch (offset & 0xF000){
                case 0x0000:
                case 0x1000:
                case 0x2000:
                case 0x3000:
                    return this.ROMData[offset];
                case 0x4000:
                case 0x5000:
                case 0x6000:
                case 0x7000:
                    return this.ROMData[offset - 0x4000 + this.currentSecondaryBank * 0x4000];
                case 0xA000:
                case 0xB000://RAM
                    if (this.RAMEnabled){
                        return this.RAMData[offset - 0xA000];
                    }
            }
            //console.error("MBC tried to: read from 0x" + offset.toString(16).toUpperCase());
            return 0xFF;
        }

        controller.writeByte = function(offset, data) {
            switch (offset & 0xF000){
                case 0x0000:
                case 0x1000: //set RAM state
                    if (((offset >>> 8) & 0x01) == 0)
                        this.RAMEnabled = (data & 0x0F) == 0x0A;
                    return;
                case 0x2000:
                case 0x3000: //set lower ROM bank number
                    if (((offset >>> 8) & 0x01) == 1){
                        this.currentSecondaryBank =  data & 0x0F;
                        if (this.currentSecondaryBank == 0)
                            this.currentSecondaryBank = 1;
                        while (this.currentSecondaryBank > this.ROMBanks)
                            this.currentSecondaryBank -= this.ROMBanks;
                        if (this.currentSecondaryBank == 0)
                            this.currentSecondaryBank = 1;
                    }
                    return;
                case 0x4000:
                case 0x5000:
                case 0x6000:
                case 0x7000:
                    return;
                case 0xA000://RAM
                    if (this.RAMEnabled){
                        this.RAMData[offset - 0xA000] = data;
                    }
                    return;
            }
            //console.error("MBC tried to: write to 0x" + offset.toString(16).toUpperCase());
        }

        controller.writeRAMByte = function(offset, bank, data) {
            switch (offset & 0xF000){
                case 0xA000:
                case 0xB000://RAM
                    this.ramData[offset - 0xA000 + bank * 0x2000] = data;
                    return;
                default:
            }
            //console.error("MBC tried to: write to RAM: 0x" + offset.toString(16).toUpperCase());
        }

        controller.setRAM = function(saveData){
            for (var i = 0; i < this.RAMData.length && i < saveData.length; i++){
                this.RAMData[i] = saveData[i];
            }
        }

        controller.getSaveData = function(){
            return this.RAMData;
        }
        return controller;
    }

    return MemoryBankController2;


});