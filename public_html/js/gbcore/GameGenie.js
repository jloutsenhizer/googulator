/*
    The real GameGenie works by replacing the data being read from the game ROM when the address and data being read
    match what's specified in the code.
    Implementing in the same way would add yet another function and some comparisons for each time a byte is read
        (millions of times per second)
    So to efficiently implement game genie, we simply write to the game's ROM since we know it can't be modified in any
    external way and we can record where we wrote to be able to reverse the patches. As long as we clean up properly when
    we are done, no harm is done and we get an efficient Game Genie implementation
 */
define(function(){
    "use strict";

    var GameGenie = {};

    var mbc = null;

    var codes = [];

    GameGenie.setLoadedGame = function(m){
        this.unapplyAllCodes();
        mbc = m;
        this.reapplyAllCodes();
    }

    GameGenie.reset = function(){
        this.unapplyAllCodes();
        codes = [];
    }

    function applyCode(code){
        if (mbc != null){
            for (var i = 1; i < mbc.ROMBanks; i++){
                var oldData = mbc.readROMByte(code.address,i);
                if (oldData == code.oldData){
                    mbc.writeROMByte(code.address,i,code.newData);
                    code.affectedBanks[i] = true;
                }
            }
        }

    }
    function unapplyCode(code){
        if (mbc != null){
            for (var bank in code.affectedBanks){
                mbc.writeROMByte(code.address,bank,code.oldData);
            }
            code.affectedBanks = {};
        }
    }

    GameGenie.reapplyAllCodes = function(){
        for (var i = 0, li = codes.length; i < li; i++){
            applyCode(codes[i]);
        }
    }

    GameGenie.unapplyAllCodes = function(){
        for (var i = 0, li = codes.length; i < li; i++){
            unapplyCode(codes[i]);
        }
    }

    GameGenie.removeCode = function(code){
       for (var i = 0, li = codes.length; i < li; i++){
           if (codes[i].code == code){
               unapplyCode(codes[i]);
               codes.splice(i,1);
               break;
           }
       }
    }

    GameGenie.addCode = function(code){
        if (code.length != 11 || code.charAt(3) != '-' || code.charAt(7) != '-')
            return false;

        for (var i = 0, li = codes.length; i < li; i++){ //no duplicates
            if (codes[i].code == code){
                return false;
            }
        }

        var newData = parseInt(code.substring(0,2),16);
        var address = parseInt(code.charAt(6) + code.charAt(2) + code.substring(4,6),16) ^ 0xF000;
        if (address >= 0x8000)
            return false;
        var oldData = parseInt(code.charAt(8) + code.charAt(10), 16);
        oldData = (((oldData) >>> 2) | ((oldData & 0x03) << 6));
        oldData ^= 0xBA;
        var H = code.charAt(9);
        code = {
            newData: newData,
            address: address,
            oldData: oldData,
            H: H,
            affectedBanks: {},
            code: code
        }
        codes.push(code);
        applyCode(code);
        return true;
    }

    GameGenie.getCodeList = function(){
        var result = [];
        for (var i = 0, li = codes.length; i < li; i++){
            result.push(codes[i].code);
        }
        return result;
    }

    return GameGenie;
});