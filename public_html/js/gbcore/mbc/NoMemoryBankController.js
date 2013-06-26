define(function(){
    var NoMemoryBankController = {};

    NoMemoryBankController.loadROM = function(romData){
        var controller = {};
        controller.romData = romData;
        controller.ramData = new Uint8Array(0x2000);

        controller.reset = function(){};

        controller.cleanup = function(){
        }

        controller.readByte = function(offset) {
            switch (offset & 0xF000){
                case 0x0000:
                case 0x1000:
                case 0x2000:
                case 0x3000:
                case 0x4000:
                case 0x5000:
                case 0x6000:
                case 0x7000:
                    return this.romData[offset] & 0xFF;
                case 0xA000:
                case 0xB000://RAM
                    return this.ramData[offset - 0xA000] & 0xFF;
            }
            //console.error("MBC tried to: read from 0x" + offset.toString(16).toUpperCase());
            return 0xFF;
        }

        controller.writeByte = function(offset, data) {
            switch (offset & 0xF000){
                case 0x0000:
                case 0x1000:
                case 0x2000:
                case 0x3000:
                case 0x4000:
                case 0x5000:
                case 0x6000:
                case 0x7000:
                    return;
                case 0xA000:
                case 0xB000://RAM
                    this.ramData[offset - 0xA000] = data;
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

    return NoMemoryBankController;


});