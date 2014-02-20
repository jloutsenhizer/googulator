define(["GameUtils","CopyUtils"], function(GameUtils, CopyUtils){
    "use strict";

    var MemoryBankCamera = {};

    MemoryBankCamera.loadROM = function(romData){
        var controller = {};
        controller.ROMData = romData;
        controller.ROMBanks = romData.length >> 14;
        controller.RAMData = new Uint8Array(0x20000);
        controller.currentSecondaryBank = 1;
        controller.currentRAMBank = 0;
        controller.RAMEnabled = false;
        controller.registerMode = false;
        controller.registers = new Uint8Array(0x36);
        controller.brightness = 0;

        Webcam.initVideo();

        controller.captureImage = function(){
            var brightness = this.brightness / 0x8000;
            var imageData = Webcam.getFrame(128,112).data;
            for (var x = 0; x < 128; x++){
                for (var y = 0; y < 112; y++){
                    var r = imageData[(((y << 7) + x) << 2)];
                    var g = imageData[(((y << 7) + x) << 2) + 1];
                    var b = imageData[(((y << 7) + x) << 2) + 2];
                    var color = (Math.max(r, g, b) + Math.min(r, g, b)) / 510 * brightness;
                    color = 1 - color;
                    if (color < 0)
                        color = 0;
                    if (color >= 1)
                        color = 0.999;
                    var pixelColor = Math.floor(color * 4);
                    var pixelColorHi = pixelColor >> 1;
                    var pixelColorLo = pixelColor & 1;
                    var dataOffset = 0x100 + ((y & 0xF8) << 5) + ((y & 7) << 1) + ((x & 0xF8) << 1);
                    var innerDataOffset = 7 - (x & 7);
                    if (pixelColorHi)
                        controller.RAMData[dataOffset+1] |= (1 << innerDataOffset);
                    else
                        controller.RAMData[dataOffset+1] &= ~(1 << innerDataOffset);
                    if (pixelColorLo)
                        controller.RAMData[dataOffset] |= (1 << innerDataOffset);
                    else
                        controller.RAMData[dataOffset] &= ~(1 << innerDataOffset);
                }
            }
        }


        controller.reset = function(){
            this.currentSecondaryBank = 1;
            this.currentRAMBank = 0;
            this.RAMEnabled = false;
        }

        controller.cleanup = function(){
            Webcam.stopVideo();
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
                    if (this.registerMode){
                        if (offset == 0xA000) return 0;
                        return 0xFF;
                    }
                    else{
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
                case 0x2000: //set lower ROM bank number
                    this.currentSecondaryBank =  data;
                    while (this.currentSecondaryBank > this.ROMBanks)
                        this.currentSecondaryBank -= this.ROMBanks;
                    if (this.currentSecondaryBank == 0)
                        this.currentSecondaryBank = 1;
                    return;
                case 0x3000:
                    return;
                case 0x4000:
                    this.registerMode = data == 0x10;
                    this.currentRAMBank = data;
                case 0x5000:
                case 0x6000:
                case 0x7000: //no function
                    return;
                case 0xA000:
                case 0xB000://RAM
                    if (this.registerMode){
                        var register = offset - 0xA000;
                        controller.registers[register] = data;
                        if (register == 0 && data == 3){ //capture camera
                            this.captureImage();
                        }
                        else if (register == 1 || register == 2){
                            this.brightness =  controller.registers[1] | (controller.registers[2] << 8);
                        }
                    }
                    else{
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
                type: GameUtils.MBC_CAMERA,
                romData: CopyUtils.makeUntypedArrayCopy(this.romData),
                ramData: CopyUtils.makeUntypedArrayCopy(this.ramData)
            };
        }

        controller.setSaveState = function(saveState){
            if (saveState != GameUtils.MBC_N){
                console.error("Attempted to load wrong bank type");
                return;
            }
            this.romData = new UInt8Array(saveState.romData.length);
            CopyUtils.copy(saveState.romData,this.romData);
            CopyUtils.copy(saveState.ramData,this.ramData);
        }

        controller.getSaveState = function(){
            return {
                type: GameUtils.MBCAMERA,
                ramData: CopyUtils.makeUntypedArrayCopy(this.RAMData),
                romBanks: this.ROMBanks,
                currentSecondaryBank: this.currentSecondaryBank,
                currentRAMBank: this.currentRAMBank,
                RAMEEnabled: this.RAMEnabled,
                registerMode: this.registerMode,
                registers: CopyUtils.makeUntypedArrayCopy(this.registers),
                brightness: this.brightness
            };
        }

        controller.setSaveState = function(saveState){
            if (saveState.type != GameUtils.MBCAMERA){
                console.error("Attempted to load wrong bank type");
                return;
            }
            CopyUtils.copy(saveState.ramData,this.RAMData);
            CopyUtils.copy(saveState.registers,this.registers);
            this.ROMBanks = saveState.romBanks;
            this.currentSecondaryBank = saveState.currentSecondaryBank;
            this.currentRAMBank = saveState.currentRAMBank;
            this.RAMEnabled = saveState.RAMEEnabled;
            this.registerMode = saveState.registerMode;
            this.brightness = saveState.brightness;
            return this;
        }

        return controller;
    }

    return MemoryBankCamera;


});