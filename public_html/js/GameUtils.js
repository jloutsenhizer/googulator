define(function(){
    var GameUtils = {};

    GameUtils.getHeader = function(gameData){
        if (this.isGameboyGame(gameData))
            return getGBCHeader(gameData);
        if (this.isNESGame(gameData))
            return getNESHeader(gameData);
        return null;
    }

    var NESIdentifierBytes = new Uint8Array(4);

    for (var i = 0; i < 5; i++){
        NESIdentifierBytes[i] = "NES\x1a".charCodeAt(i);
    }

    function getNESHeader(gameData){
        var header = {};

        header.type = "nes";
        header.valid = true;

        for (var i = 0, li = NESIdentifierBytes.length; i < li && header.valid; i++){
            header.valid = NESIdentifierBytes[i] == gameData[i];
        }
        if (!header.valid)
            return header;

        header.romCount = gameData[4];
        header.vromCount = gameData[5]*2; // Get the number of 4kB banks, not 8kB
        header.mirroring = ((gameData[6] & 1) !== 0 ? 1 : 0);
        header.saveableRAM = (gameData[6] & 2) !== 0;
        header.trainer = (gameData[6] & 4) !== 0;
        header.fourScreen = (gameData[6] & 8) !== 0;
        header.mapperType = (gameData[6] >> 4) | (gameData[7] & 0xF0);

        header.RAMSize = header.saveableRAM ? 0x2000 : 0;

        // Check whether byte 8-15 are zero's:
        var foundError = false;
        for (i=8; i<16; i++) {
            if (gameData[i] !== 0) {
                foundError = true;
                break;
            }
        }
        if (foundError) {
            header.mapperType &= 0xF; // Ignore byte 7
        }

        var checksum = 0;
        for (var i = 0, li = gameData.length; i < li; i++){
            checksum = (checksum + gameData[i]) & 0xFFFFFFFF;
        }

        checksum = checksum.toString(16).toUpperCase();
        while (checksum.length < 8)
            checksum = "0" + checksum;

        header.id = "NES_" + checksum;

        return header;
    }

    function getGBCHeader(gameData){
        var header = {};

        header.type = "gameboy";

        var id = '';
        header.gbcEnabled = (gameData[0x143] & 0x80) == 0x80;
        header.sgbEnabled = gameData[0x146] == 3 && gameData[0x14B] == 0x33;

        for (var i = 0; i < (header.gbcEnabled ? 15 : 16) && gameData[0x134 + i] != 0; i++)
            id += String.fromCharCode(gameData[0x134 + i]);
        header.id = (header.sgbEnabled ? "S" : "") + "GB" + (header.gbcEnabled ? "C" : "") + "_" + id.trim();

        var mfcode = '';
        for (var i = 0; i < 4 && gameData[0x13F + i] != 0 && gameData[0x13F + i] != ' '; i++)
            mfcode +=  String.fromCharCode(gameData[0x13F + i]);
        header.manufacturer_code = mfcode;

        var cartType = gameData[0x147];
        switch (cartType){
            default:
                header.mbcType = GameUtils.MBC_UNKNOWN;
                break;
            case 0x00:
            case 0x08:
            case 0x09: //ROM only
                header.mbcType = GameUtils.MBC_N;
                break;
            case 0x01:
            case 0x02:
            case 0x03://MBC1
                header.mbcType = GameUtils.MBC_1;
                break;
            case 0x05:
            case 0x06://MBC2
                header.mbcType = GameUtils.MBC_2;
                break;
            case 0x0F:
            case 0x10:
            case 0x11:
            case 0x12:
            case 0x13://MBC3
                header.mbcType = GameUtils.MBC_3;
                break;
            case 0x19:
            case 0x1A:
            case 0x1B:
            case 0x1C:
            case 0x1D:
            case 0x1E:
            case 0x1F://MBC5
                header.mbcType = GameUtils.MBC_5;
                break;
            case 0xFC://MBCamera
                header.mbcType = GameUtils.MBCAMERA;
                break;
        }

        switch (gameData[0x149]){
            default:
                header.RAMSize = 0;
                break;
            case 1:
                header.RAMSize = 2 * 1024;
                break;
            case 2:
                header.RAMSize = 8 * 1024;
                break;
            case 3:
                header.RAMSize = 32 * 1024;
                break;
            case 4:
                header.RAMSize = 128 * 1024;
                break;
        }

        switch (cartType){
            default:
                header.saveableRAM = header.RAMSize != 0;
                break;
            case 0x02:
            case 0x03:
            case 0x05:
            case 0x06:
            case 0x08:
            case 0x09:
            case 0x0C:
            case 0x0D:
            case 0x0F:
            case 0x10:
            case 0x12:
            case 0x13:
            case 0x16:
            case 0x17:
            case 0x1A:
            case 0x1B:
            case 0x1D:
            case 0x1E:
            case 0xFF:
                header.saveableRAM = true;
                break;
        }

        //verify header checksum

        var checksum = 0
        header.headerChecksum = gameData[0x14D];

        for (var i = 0x0134; i < 0x14D; i++){
            checksum -= gameData[i] + 1;
            checksum &= 0xFF;
        }

        header.headerChecksumMatch = header.headerChecksum == checksum;
        return header;
    }

    GameUtils.isGame = function(gameData){
        return this.isGameboyGame(gameData) || this.isNESGame(gameData);
    }

    GameUtils.isGameboyGame = function(gameData){
        return getGBCHeader(gameData).headerChecksumMatch;
    }

    var patchIdentifierBytes = new Uint8Array(5);

    for (var i = 0; i < 5; i++){
        patchIdentifierBytes[i] = "PATCH".charCodeAt(i);
    }

    GameUtils.isPatch = function(data){
        for (var i = 0; i < patchIdentifierBytes.length; i++){
            if (data[i] != patchIdentifierBytes[i])
                return false;
        }
        return true;
    }

    GameUtils.isNESGame = function(gameData){
        return getNESHeader(gameData).valid;
    }

    var patchEOF = new Uint8Array(3);
    for (var i = 0; i < 3; i++){
        patchEOF[i] = "EOF".charCodeAt(i);
    }

    GameUtils.applyPatch = function(patchData,gameData){
        var patchIndex = 5;
        gameData = new Uint8Array(gameData);
        while (true){
            var eof = true;
            for (var i = 0; i < 3 && eof; i++){
                eof = patchData[patchIndex+i] == patchEOF[i];
            }
            if (eof)
                break;
            //not eof then we have a patch record;
            var offset = (patchData[patchIndex] << 16) | (patchData[patchIndex+1] << 8) | patchData[patchIndex+2];
            var size = (patchData[patchIndex+3] << 8) | patchData[patchIndex+4];
            if (size == 0){//RLE
                var rleSize = (patchData[patchIndex+5] << 8) | patchData[patchIndex+6];
                for (var i = 0; i < rleSize; i++){
                    gameData[offset+i] = patchData[patchIndex+7];
                }
                patchIndex += 8;
            }
            else{
                for (var i = 0; i < size; i++){
                    gameData[offset+i] = patchData[patchIndex+5+i];
                }
                patchIndex += 5 + size;
            }
        }
        return gameData;
    }

    GameUtils.MBC_UNKNOWN = -1;
    GameUtils.MBC_N = 0;
    GameUtils.MBC_1 = 1;
    GameUtils.MBC_2 = 2;
    GameUtils.MBC_3 = 3;
    GameUtils.MBC_5 = 4;
    GameUtils.MBCAMERA = 5;

    return GameUtils;

});