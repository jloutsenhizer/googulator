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
        $.ajax("/php/getLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()),{
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
                            if (GameUtils.isHTML5Game(game.id)){
                                require(["html5apps/" + game.id + "/App"],function(app){
                                    game.data = app;
                                    game.header = app.header;
                                    callback(game.data);
                                });
                            }
                            else{
                                GoogleAPIs.getFile(this.fileId,function (gameData){
                                    gameData = GameUtils.decompress(gameData);
                                    if (game.patchFileId == ""){
                                        game.data = gameData;
                                        game.header = GameUtils.getHeader(game.data);
                                        callback(game.data,game.header);
                                    }
                                    else{
                                        GoogleAPIs.getFile(game.patchFileId,function(patchData){
                                            patchData = GameUtils.decompress(patchData);
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
                                    saveData = GameUtils.decompress(saveData);
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

                    library[i].getGameSaveStateData = function(callback,progresscallback){
                        if (progresscallback == null) progresscallback = function(){};
                        var game = this;
                        if (typeof game.saveState !== "undefined"){
                            callback(game.saveState);
                        }
                        else{
                            if (this.saveStateFileId != ""){
                                GoogleAPIs.getFile(this.saveStateFileId,function (saveState){
                                    saveState = GameUtils.decompress(saveState);
                                    game.saveState = JSON.parse(App.stringFromArrayBuffer(saveState));
                                    callback(game.saveState);
                                },function(loaded,total){
                                    progresscallback(loaded/total * 100);
                                });
                            }
                            else{
                                callback(null);
                            }
                        }
                    }

                    library[i].createGameSaveStateData = function(callback){
                        var game = this;
                        game.saveState = null;
                        GoogleAPIs.uploadBinaryFile(game.getDefaultSaveStateFileName(),App.stringToArrayBuffer(JSON.stringify(game.saveState)),function(result){
                            game.saveStateFileId = result.id;
                            $.ajax("/php/setGameSaveState.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&uid=" + encodeURIComponent(game.uid) + "&savestateid=" + encodeURIComponent(game.saveStateFileId),{
                                success: function(data){
                                    callback(game.saveState);
                                },
                                error: function(){
                                    callback(game.saveState);
                                }
                            })
                        });
                    }

                    library[i].setGameSaveStateFileId = function(fileid,callback,progresscallback){
                        if (fileid == null) fileid = "";
                        delete this.saveState;
                        this.saveStateFileId = fileid;
                        var game = this;
                        $.ajax("/php/setGameSaveState.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&uid=" + encodeURIComponent(game.uid) + "&savestateid=" + encodeURIComponent(game.saveStateFileId),{
                            success: function(data){
                                game.getGameSaveStateData(callback,progresscallback)
                            },
                            error: function(){
                                callback(null);
                            }
                        });

                    }

                    library[i].getDefaultSaveFileName = function(){
                        return this.id + ".sav";
                    }

                    library[i].getDefaultSaveStateFileName = function(){
                        return this.id + ".state";
                    }

                    library[i].createGameSaveData = function(callback){
                        var game = this;
                        var ramSize = game.header.RAMSize;
                        if (game.header.mbcType == GameUtils.MBC_3)
                            ramSize += 13;
                        game.saveData = new Uint8Array(ramSize);
                        GoogleAPIs.uploadBinaryFile(game.getDefaultSaveFileName(),game.saveData,function(result){
                            game.saveFileId = result.id;
                            $.ajax("/php/setGameSave.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&uid=" + encodeURIComponent(game.uid) + "&saveid=" + encodeURIComponent(game.saveFileId),{
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
                        $.ajax("/php/setGameSave.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&uid=" + encodeURIComponent(game.uid) + "&saveid=" + encodeURIComponent(game.saveFileId),{
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

                    library[i].updateSaveStateData = function(saveState,callback,progresscallback){
                        if (this.saveStateFileId === ""){
                            callback();
                            return;
                        }
                        if (progresscallback == null) progresscallback = function(){};
                        var game = this;
                        GoogleAPIs.updateBinaryFile(game.saveStateFileId,App.stringToArrayBuffer(JSON.stringify(saveState)),function(result){
                            game.saveState = saveState
                            callback();
                        },function(loaded,total){
                            progresscallback(loaded/total*100);
                        });
                    }

                    library[i].setGameTitle = function(title,callback){
                        var game = this;
                        if (title != null){
                            $.ajax("/php/setGameTitle.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&uid=" + encodeURIComponent(game.uid) + "&title=" + encodeURIComponent(title),{
                                success:function(){
                                    game.title = title;
                                    callback(true);

                                },
                                error:function(){
                                    callback(false);
                                }

                            });
                        }
                        else{
                            $.ajax("/php/resetGameTitle.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&uid=" + encodeURIComponent(game.uid),{
                                success:function(result){
                                    try{
                                        if (typeof result === "object")
                                            game.title = result.title
                                        callback(true);
                                    } catch(e){
                                        callback(false);
                                    }


                                },
                                error:function(){
                                    callback(false);
                                }

                            });

                        }
                    }

                    library[i].removeFromLibrary = function(callback){
                        $.ajax("/php/removeGameFromLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&uid=" + encodeURIComponent(this.uid),{
                            success: function(data){
                                callback();
                            },
                            error: function(){
                                callback();
                            }
                        });
                    }

                    library[i].equals = function(game){
                        return game != null && game.id == this.id && game.saveFileId == this.saveFileId && this.fileId == game.fileId && this.patchFileId == game.patchFileId;
                    }
                }

                library.getGameById = function(id){
                    for (var i = 0, li = this.length; i < li; i++){
                        if (this[i].id === id)
                            return this[i];
                    }
                    return null;

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
        $.ajax("/php/addGameToLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&gameid=" + encodeURIComponent(gameid) + "&fileid=" + encodeURIComponent(fileid),{
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
            baseGameData = GameUtils.decompress(baseGameData);
            GoogleAPIs.getFile(patchfileid,function(patchData){
                patchData = GameUtils.decompress(patchData);
                var gameData = GameUtils.applyPatch(patchData,baseGameData);
                var header = GameUtils.getHeader(gameData);
                $.ajax("/php/addGameToLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&gameid=" + encodeURIComponent(header.id) + "&fileid=" + encodeURIComponent(basegame.fileId)
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