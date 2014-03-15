define(["GameUtils","CopyUtils"],function(GameUtils,CopyUtils){
    "use strict";

    var MemoryBankController1 = {};

    MemoryBankController1.loadROM = function(romData){
        var controller = {};
        controller.ROMData = romData;
        controller.ROMBanks = romData.length >> 14;
        controller.RAMData = new Uint8Array(0x8000);
        controller.currentSecondaryBank = 1;
        controller.currentRAMBank = 0;
        controller.largeRAMMode = false;
        controller.RAMEnabled = false;


        controller.reset = function(){
            this.currentSecondaryBank = 1;
            this.currentRAMBank = 0;
            this.largeRAMMode = false;
            this.RAMEnabled = false;
        }

        controller.cleanup = function(){
        }

        controller.readROMByte = function(offset,secondaryBank){
            if (offset < 0x4000){
                return this.ROMData[offset];
            }
            else{
                return this.ROMData[offset - 0x4000 + (secondaryBank << 14)];
            }
        }

        controller.writeROMByte = function(offset,secondaryBank,data){
            if (offset < 0x4000){
                this.ROMData[offset] = data;
            }
            else{
                this.ROMData[offset - 0x4000 + (secondaryBank << 14)] = data;
            }
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
                        return this.RAMData[offset - 0xA000 + this.currentRAMBank * 0x2000];
                    }
            }
            //console.error("MBC tried to: read from 0x" + offset.toString(16).toUpperCase());
            return 0xFF;
        }

        controller.writeByte = function(offset, data) {
            switch (offset & 0xF000){
                case 0x0000:
                case 0x1000: //set RAM state
                    this.RAMEnabled = (data & 0x0F) == 0x0A;
                    return;
                case 0x2000:
                case 0x3000: //set lower ROM bank number
                    data &= 0x1F;
                    if (data == 0) data = 1;
                    this.currentSecondaryBank =  (this.currentSecondaryBank & 0x60) | data;
                    while (this.currentSecondaryBank > this.ROMBanks)
                        this.currentSecondaryBank -= this.ROMBanks;
                    if (this.currentSecondaryBank == 0)
                        this.currentSecondaryBank = 1;
                    return;
                case 0x4000:
                case 0x5000: //set RAM bank number or upper ROM bank number
                    if (this.largeRAMMode){
                        this.currentRAMBank = data & 3;
                    }
                    else{
                        this.currentSecondaryBank = ((data & 3) << 5) | (this.currentSecondaryBank & 0x1F);
                        while (this.currentSecondaryBank > this.ROMBanks)
                            this.currentSecondaryBank -= this.ROMBanks;
                        if (this.currentSecondaryBank == 0)
                            this.currentSecondaryBank = 1;
                    }
                    return;
                case 0x6000:
                case 0x7000: //select RAM mode
                    this.largeRAMMode = data == 1;
                    return;
                case 0xA000:
                case 0xB000://RAM
                    if (this.RAMEnabled){
                        this.RAMData[offset - 0xA000 + this.currentRAMBank * 0x2000] = data;
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

        controller.getSaveState = function(){
            return {
                type: GameUtils.MBC_1,
                ramData: CopyUtils.makeUntypedArrayCopy(this.RAMData),
                romBanks: this.ROMBanks,
                currentSecondaryBank: this.currentSecondaryBank,
                currentRAMBank: this.currentRAMBank,
                RAMEEnabled: this.RAMEnabled,
                largeRAMMode: this.largeRAMMode
            };
        }

        controller.setSaveState = function(saveState){
            if (saveState.type != GameUtils.MBC_1){
                console.error("Attempted to load wrong bank type");
                return;
            }
            CopyUtils.copy(saveState.ramData,this.RAMData);
            this.ROMBanks = saveState.romBanks;
            this.currentSecondaryBank = saveState.currentSecondaryBank;
            this.currentRAMBank = saveState.currentRAMBank;
            this.RAMEnabled = saveState.RAMEEnabled;
            this.largeRAMMode = saveState.largeRAMMode;
            return this;
        }

        return controller;
    }

    return MemoryBankController1;


});