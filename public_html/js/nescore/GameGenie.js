define(function(){

    var GameGenie = function(nes){
        this.nes = nes;
    };

    var codes = [];

    GameGenie.prototype.reset = function(){
        this.unapplyAllCodes();
        codes = [];

    };

    GameGenie.prototype.reapplyAllCodes = function(){
        this.unapplyAllCodes();
        for (var i = 0, li = codes.length; i < li; i++){
            applyCode(this,codes[i]);
        }
    }

    function applyCode(gg,code){
        if ((code.oldData == null || gg.nes.cpu.mem[code.address] == code.oldData) && gg.nes.cpu.mem[code.address] != code.data){
            code.isActive = true;
            code.writeBackData = gg.nes.cpu.mem[code.address];
            gg.nes.cpu.mem[code.address] = code.data;
        }
    }

    function unapplyCode(gg,code){
        if (code.isActive){
            if (gg.nes.cpu.mem[code.address] == code.data)//sanity check
                gg.nes.cpu.mem[code.address] = code.writeBackData;
            code.isActive = false;
        }
    }

    GameGenie.prototype.unapplyAllCodes = function(){
        for (var i = codes.length - 1; i >= 0; i--){
            unapplyCode(this,codes[i]);
        }
    }

    GameGenie.prototype.removeCode = function(code){
        this.unapplyAllCodes();
        for (var i = 0, li = codes.length; i < li; i++){
            if (codes[i].code == code){
                codes.splice(i--,1);
                li--;
            }
        }
        this.reapplyAllCodes();
    }

    var characterMapping = {
        A: 0x0,
        P: 0x1,
        Z: 0x2,
        L: 0x3,
        G: 0x4,
        I: 0x5,
        T: 0x6,
        Y: 0x7,
        E: 0x8,
        O: 0x9,
        X: 0xA,
        U: 0xB,
        K: 0xC,
        S: 0xD,
        V: 0xE,
        N: 0xF
    };

    GameGenie.prototype.addCode = function(code){
        if (code.length != 6 && code.length != 8)
            return false;
        var bytes = [];
        for (var i = 0, li = code.length; i < li; i++){
            bytes[i] = characterMapping[code.charAt(i)];
            if (bytes[i] == null)
                return false;
        }
        var address = 0x8000 |
            (((bytes[3] & 7) << 12)
            | ((bytes[5] & 7) << 8) | ((bytes[4] & 8) << 8)
            | ((bytes[2] & 7) << 4) | ((bytes[1] & 8) << 4)
            |  (bytes[4] & 7)       |  (bytes[3] & 8));
        var data, oldData;
        if (code.length == 6){
            oldData = null;
            data = ((bytes[1] & 7) << 4) | ((bytes[0] & 8) << 4) | (bytes[0] & 7) | (bytes[5] & 8);
        }
        else{
            data = ((bytes[1] & 7) << 4) | ((bytes[0] & 8) << 4) |(bytes[0] & 7) | (bytes[7] & 8);
            oldData = ((bytes[7] & 7) << 4) | ((bytes[6] & 8) << 4) | (bytes[6] & 7) | (bytes[5] & 8);
        }
        var newCode = {
            address: address,
            data: data,
            oldData: oldData,
            isActive: false,
            writeBackData: null,
            code: code
        };
        codes.push(newCode);
        applyCode(this,newCode);
        return true;
    };

    GameGenie.prototype.getCodeList = function(){
        var result = [];
        for (var i = 0, li = codes.length; i < li; i++){
            result.push(codes[i].code);
        }
        return result;
    }


    return GameGenie;

});