define(function(){
    var MemoryBankController3 = {};

    MemoryBankController3.loadROM = function(romData){
        var controller = {};
        controller.ROMData = romData;
        controller.ROMBanks = romData.length >> 14;
        controller.RAMData = new Uint8Array(0x8000);
        controller.currentSecondaryBank = 1;
        controller.currentRAMBank = 0;
        controller.RAMEnabled = false;
        controller.SECONDS = 0, controller.MINUTES = 1, controller.HOURS = 2, controller.DAYS_LO = 3, controller.DAYS_HI = 4;
        controller.RTC = [0,0,0,0,0];
        controller.lastRTCUpdate = new Date().getTime();

        controller.reset = function(){
            this.currentSecondaryBank = 1;
            this.currentRAMBank = 0;
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
                    return this.ROMData[offset] & 0xFF;
                case 0x4000:
                case 0x5000:
                case 0x6000:
                case 0x7000:
                    return this.ROMData[offset + (this.currentSecondaryBank - 1) * 0x4000] & 0xFF;
                case 0xA000:
                case 0xB000://RAM
                    if (this.RAMEnabled){
                        if (this.currentRAMBank < 0x04)
                            return this.RAMData[offset - 0xA000 + this.currentRAMBank * 0x2000] & 0xFF;
                        else{
                            this.updateRTC();
                            return this.RTC[this.currentRAMBank - 0x08] & 0xFF;
                        }
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
                case 0x3000: //set ROM bank number
                    this.currentSecondaryBank =  data & 0x7F;
                    if (this.currentSecondaryBank == 0)
                        this.currentSecondaryBank = 1;
                    while (this.currentSecondaryBank > this.ROMBanks)
                        this.currentSecondaryBank -= this.ROMBanks;
                    if (this.currentSecondaryBank == 0)
                        this.currentSecondaryBank = 1;
                    return;
                case 0x4000:
                case 0x5000: //set RAM bank number or RTC register
                    this.currentRAMBank = data & 0x0F;
                    return;
                case 0x6000:
                case 0x7000: //latch clock ?:|
                    return; //do nothing for now
                case 0xA000:
                case 0xB000://RAM//RTC reg
                    if (this.RAMEnabled){
                        if (this.currentRAMBank < 0x04)
                            this.RAMData[offset  - 0xA000 + this.currentRAMBank * 0x2000] = data;
                    else{
                            this.updateRTC();
                            this.RTC[this.currentRAMBank - 0x08] = data;
                        }
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

        controller.updateRTC = function(){
            var currentTime = new Date().getTime();
            var change = currentTime - this.lastRTCUpdate;
            if (change < 0){
                this.lastRTCUpdate = currentTime;
            }
            if (change > 1000){
                this.lastRTCUpdate = currentTime;
                var secondChange = change / 1000;
                secondChange += this.RTC[this.SECONDS];
                if (secondChange >= 60){
                    var minuteChange = secondChange / 60;
                    secondChange = secondChange % 60;
                    minuteChange += this.RTC[this.MINUTES];
                    if (minuteChange >= 60){
                        var hourChange = minuteChange / 60;
                        minuteChange = minuteChange % 60;
                        hourChange += this.RTC[this.HOURS];
                        if (hourChange >= 24){
                            var dayChange = hourChange / 24;
                            hourChange = hourChange % 24;
                            dayChange += this.RTC[this.DAYS_LO];
                            dayChange += (this.RTC[this.DAYS_HI] & 1) << 8;
                            if (dayChange >= 512){
                                dayChange = dayChange % 512;
                                this.RTC[this.DAYS_HI] |= 0x80;
                            }
                            this.RTC[this.DAYS_LO] =  (dayChange & 0xFF);
                            this.RTC[this.DAYS_HI] &= 0xFE;
                            this.RTC[this.DAYS_HI] |= ((dayChange & 0x100) >> 8);
                        }
                        this.RTC[this.HOURS] = hourChange;
                    }
                    this.RTC[this.MINUTES] = minuteChange;
                }
                this.RTC[this.SECONDS] = secondChange;
            }
        }

        controller.setRAM = function(saveData){
            for (var i = 0; i < this.RAMData.length; i++){
                this.RAMData[i] = saveData[i];
            }
            for (var i = 0; i < 5; i++){
                this.RTC[i] = saveData[0x8000+i];
            }
            var timestamp = 0;
            for (var i = 0; i < 8; i++){
                timestamp += (saveData[0x8005+i] * Math.pow(2,i * 8));
            }
            if (timestamp != 0)
                this.lastRTCUpdate = timestamp;
        }

        controller.getSaveData = function(){
            var timestamp = this.lastRTCUpdate;
            var newRAM = new Uint8Array(0x8000 + 13);
            for (var i = 0; i < 0x8000; i++){
                newRAM[i] = this.RAMData[i];
            }

            for (var i = 0; i < 5; i++){
                newRAM[i+0x8000] = this.RTC[i];
            }

            for (var i = 0; i < 8; i++){
                newRAM[i+0x8005] = Math.floor(timestamp / Math.pow(2,8 * i)) & 0xFF;
            }

            return newRAM;
        }

        return controller;
    }

    return MemoryBankController3;


});