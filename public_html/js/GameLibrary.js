define(["GoogleAPIs","GameUtils"], function(GoogleAPIs, GameUtils){

    var GameLibrary = {};

    var library = null;

    GameLibrary.getLibrary = function(callback){
        if (library != null){
            callback(library);
        }
        else{
            this.refreshLibrary(callback);
        }
    }

    GameLibrary.refreshLibrary = function(callback){
        var that = this;
        $.ajax("ROM/getLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()),{
            success: function(data){
                library = data;

                for (var i = 0; i < library.length; i++){
                    library[i].getGameData  = function(callback,progresscallback){
                        if (progresscallback == null) progresscallback = function(){};
                        var game = this;
                        if (this.data != null){
                            callback(this.data);
                        }
                        else{
                            GoogleAPIs.getFile(this.fileId,function (gameData){
                                if (game.patchFileId == ""){
                                    game.data = gameData;
                                    game.header = GameUtils.getHeader(game.data);
                                    callback(game.data,game.header);
                                }
                                else{
                                    GoogleAPIs.getFile(game.patchFileId,function(patchData){
                                        game.data = GameUtils.applyPatch(patchData,gameData);
                                        game.header = GameUtils.getHeader(game.data);
                                        callback(game.data,game.header);
                                    },function(loaded,total){
                                        progresscallback(50 + loaded / total * 50);
                                    });
                                }
                            },function(loaded,total){
                                var multiplier = game.patchFileId == "" ? 100 : 50;
                                progresscallback(loaded / total * multiplier);
                            });
                        }
                    }

                    library[i].getGameSaveData = function(callback,progresscallback){
                        if (progresscallback == null) progresscallback = function(){};
                        var game = this;
                        if (this.header == null || !this.header.saveableRAM){
                            callback(null);
                        }
                        else if (game.saveData != null){
                            callback(game.saveData);
                        }
                        else{
                            if (this.saveFileId != ""){
                                GoogleAPIs.getFile(this.saveFileId,function (saveData){
                                    game.saveData = saveData;
                                    callback(game.saveData);
                                },function(loaded,total){
                                    progresscallback(loaded/total * 100);
                                });
                            }
                            else{
                                callback(null);
                            }
                        }
                    }

                    library[i].getDefaultSaveFileName = function(){
                        return this.id + ".sav";
                    }

                    library[i].createGameSaveData = function(callback){
                        var game = this;
                        var ramSize = game.header.RAMSize;
                        if (game.header.mbcType == GameUtils.MBC_3)
                            ramSize += 13;
                        game.saveData = new Uint8Array(ramSize);
                        GoogleAPIs.uploadBinaryFile(game.getDefaultSaveFileName(),game.saveData,function(result){
                            game.saveFileId = result.id;
                            $.ajax("ROM/setGameSave.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&gameid=" + encodeURIComponent(game.id) + "&fileid=" + encodeURIComponent(game.fileId) +
                                "&saveid=" + game.saveFileId + "&patchid=" + game.patchFileId,{
                                success: function(data){
                                    callback(game.saveData);
                                },
                                error: function(){
                                    callback(game.saveData);
                                }
                            })
                        });
                    }

                    library[i].setGameSaveFileId = function(fileId,callback,progresscallback){
                        var game = this;
                        game.saveFileId = fileId;
                        $.ajax("ROM/setGameSave.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&gameid=" + encodeURIComponent(game.id) + "&fileid=" + encodeURIComponent(game.fileId) +
                            "&saveid=" + game.saveFileId + "&patchid=" + game.patchFileId,{
                            success: function(data){
                                game.getGameSaveData(callback,progresscallback);
                            },
                            error: function(){
                                callback(null);
                            }
                        })

                    }

                    library[i].updateSaveData = function(data,callback,progresscallback){
                        if (progresscallback == null) progresscallback = function(){};
                        var game = this;
                        if (game.header == null || !game.header.saveableRAM || game.saveFileId == ""){
                            callback();
                            return;
                        }
                        GoogleAPIs.updateBinaryFile(game.saveFileId,data,function(result){
                            game.saveData = new Uint8Array(data);
                            callback();
                        },function(loaded,total){
                            progresscallback(loaded/total*100);
                        });
                    }
                }

                that.getLibrary(callback);
            },
            error: function(){
                callback(library);
            }
        });
    }

    GameLibrary.findGame = function(fileId){
        if (library == null) return null;
        for (var i = 0; i < library.length; i++){
            if ((library[i].fileId == fileId && library[i].patchFileId == "") || library[i].patchFileId == fileId)
                return library[i];
        }
        return null;
    }

    GameLibrary.addGame = function(gameid,fileid,callback){
        var that = this;
        $.ajax("ROM/addGameToLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&gameid=" + encodeURIComponent(gameid) + "&fileid=" + encodeURIComponent(fileid),{
            success: function(data){
                that.refreshLibrary(function(lib){
                    callback(lib,data == 1);
                });
            },
            error: function(){
                that.refreshLibrary(function(lib){
                    callback(lib,false);
                });
            }
        });
    }

    GameLibrary.addGamePatch = function(basegame,patchfileid,callback){
        var that = this;
        GoogleAPIs.getFile(basegame.fileId,function(baseGameData){
            GoogleAPIs.getFile(patchfileid,function(patchData){
                var gameData = GameUtils.applyPatch(patchData,baseGameData);
                var header = GameUtils.getHeader(gameData);
                $.ajax("ROM/addGameToLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&gameid=" + encodeURIComponent(header.id) + "&fileid=" + encodeURIComponent(basegame.fileId)
                    + "&patchid=" + encodeURIComponent(patchfileid),{
                    success: function(data){
                        that.refreshLibrary(function(lib){
                            callback(lib,data == 1);
                        });
                    },
                    error: function(){
                        that.refreshLibrary(function(lib){
                            callback(lib,false);
                        });
                    }
                });
            });
        });
    }

    return GameLibrary;
});