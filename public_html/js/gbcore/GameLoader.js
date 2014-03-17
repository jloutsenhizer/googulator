define(["GameUtils", "CopyUtils", "gbcore/mbc/NoMemoryBankController", "gbcore/mbc/MemoryBankController1", "gbcore/mbc/MemoryBankController2", "gbcore/mbc/MemoryBankController3", "gbcore/mbc/MemoryBankController5",
        "gbcore/mbc/MemoryBankCamera"],function(GameUtils, CopyUtils, NoMBC, MBC1, MBC2, MBC3, MBC5, MBCAMERA){
    "use strict";

    var GameLoader = {};

    GameLoader.loadGame = function(gameData){
        gameData = CopyUtils.makeUntypedArrayCopy(gameData);//we copy it so that we don't mess up the original game
        var header = GameUtils.getHeader(gameData);
        switch (header.mbcType){
            case GameUtils.MBC_N:
                return NoMBC.loadROM(gameData);
            case GameUtils.MBC_1:
                return MBC1.loadROM(gameData);
            case GameUtils.MBC_2:
                return MBC2.loadROM(gameData);
            case GameUtils.MBC_3:
                return MBC3.loadROM(gameData);
            case GameUtils.MBC_5:
                return MBC5.loadROM(gameData);
            case GameUtils.MBCAMERA:
                return MBCAMERA.loadROM(gameData);
            default:
                console.error("Failed to load game, unsupported MBC!");
                return null;
        }
    }


    return GameLoader;

});