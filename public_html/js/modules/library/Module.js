define(["GameLibrary","FreeGamePicker", "GoogleAPIs", "GameUtils"], function(GameLibrary,FreeGamePicker,GoogleAPIs, GameUtils){
    var Module = {};

    var container;

    var library = null;
    var overlay = {};

    var authenticated = false;

    Module.init = function(c){
        container = c;
        $("#addFromDrive").click(addFromDrive);
        $("#addFromFree").click(addFromFree);

        if (!authenticated)
            overlay = App.createMessageOverlay(container,"You must login with google before you can access your library!");
    }

    Module.onActivate = function(params){
        if (params.driveState != null){
            doDriveLoad(params.driveState,params.driveOverlay);
        }
    }

    Module.onFreeze = function(){

    }

    Module.onAuthenticated = function(){
        authenticated = true;
        if (overlay != null)
            overlay.remove();
        overlay = null;
        refreshGameLibrary();
    }

    function doDriveLoad(driveState,driveOverlay){
        if (library == null){
            setTimeout(function(){
                doDriveLoad(driveState,driveOverlay);
            },10);
            return;
        }
        driveOverlay.remove();
        addFiles(driveState.ids,function(){
            var game = null;
            for (var i = 0; i < driveState.ids.length && game == null; i++){
                game = GameLibrary.findGame(driveState.ids[i]);
            }
            if (game != null){
                loadGame(game);
            }
        });
    }


    function refreshGameLibrary(){
        overlay = App.createMessageOverlay(container,"Refreshing Game Library...");
        $("#library").empty();
        GameLibrary.refreshLibrary(function (data){
            library = data;
            onLibraryLoaded();
        });
    }

    function onLibraryLoaded(){
        $("#library").empty();
        App.loadMustacheTemplate("modules/library/template.html","gameCard",function(template){
            library.sort(function(a,b){
                if (a.title.toUpperCase() < b.title.toUpperCase())
                    return -1;
                else if (a.title.toUpperCase() > b.title.toUpperCase())
                    return 1;
                return 0;
            });
            for (var i = 0; i < library.length; i++){
                var html = template.render(library[i]);
                var item = $(html);
                $("#library").append(item);
                item.click({game:library[i]}, function(event){
                    loadGame(event.data.game);
                    return false;
                });
            }
            if (overlay != null)
                overlay.remove();
            overlay = null;
        });

    }

    function progressUpdate(percent){
        overlay.find(".pbar").progressbar({value:percent});
    }


    function loadGame(game){
        overlay = App.createMessageOverlay(container,$("<div>Loading " + game.title + "...</div><div class='pbar'></div>"));
        game.getGameData(function(gameData){
            overlay.remove();
            overlay = App.createMessageOverlay(container,$("<div>Loading Save Data for " + game.title + "...</div><div class='pbar'></div>"));
            game.getGameSaveData(function(saveData){
                if (saveData == null && game.header.saveableRAM){
                    App.loadMustacheTemplate("modules/library/template.html","saveNotFound",function(template){
                        App.makeModal(template.render(game));
                        var noEvent= true;
                        $("#loadSave").click(function(){
                            noEvent = false;
                            $("#chooseRAMDialog").modal("hide");
                            GoogleAPIs.showFilePicker(function(result){
                                if (result != null && result.docs.length == 1){
                                    game.setGameSaveFileId(result.docs[0].id,function(success){
                                        if (success){
                                            switchToEmulator(game);
                                        }
                                        else{
                                            if (overlay != null)
                                                overlay.remove();
                                            overlay = null;
                                        }
                                    },progressUpdate);
                                }
                                else{
                                    if (overlay != null)
                                        overlay.remove();
                                    overlay = null;
                                }
                            },{multiSelect:false,query:game.getDefaultSaveFileName()});
                        });
                        $("#createSave").click(function(){
                            noEvent = false;
                            $("#chooseRAMDialog").modal("hide");
                            game.createGameSaveData(function(saveData){
                                switchToEmulator(game);
                            })
                        });
                        $("#chooseRAMDialog").on("hidden",function(){
                            if (noEvent){
                                if (overlay != null)
                                    overlay.remove();
                                overlay = null;
                            }
                        })
                    })
                }
                else{
                    switchToEmulator(game);
                }
            },progressUpdate);
        },progressUpdate);
    }

    var emulatorModules = {
        gameboy:"gameboy",
        nes:"nes"
    }

    function switchToEmulator(game){
        var module = emulatorModules[game.header.type];
        if (module == null){
            console.log("unsupported game");
        }
        else{
            App.setActiveModule(module,{game: game});
        }
        if (overlay != null)
            overlay.remove();
        overlay = null;
    }

    function addFiles(files,callback){
        if (callback == null) callback = function(){};
        var doneWithFile = function(i){
            if (overlay != null)
                overlay.remove();
            overlay = null;
            i++;
            if (i < files.length){
                loadFile(i);
            }
            else{
                onLibraryLoaded();
                callback();
            }
        }
        var loadFile = function(i){
            var curFile = files[i];
            if (typeof curFile == "string")
                curFile = {id:curFile};
            curFile = $.extend({}, curFile);
            if (curFile.name == null)
                curFile.name = curFile.id;
            for (var j = 0; j < library.length; j++){
                if (GameLibrary.findGame(curFile.id) != null){
                    doneWithFile(i);
                    return;
                }
            }
            overlay = App.createMessageOverlay(container,$("<div>Loading " + curFile.name + " To Your Library...</div><div class='pbar'></div>"));
            GoogleAPIs.getFile(curFile.id,function(data){
                if (GameUtils.isGame(data)){
                    var header = GameUtils.getHeader(data);
                    GameLibrary.addGame(header.id,curFile.id,function(lib,success){
                        library = lib;
                        doneWithFile(i);
                    });
                }
                else if (GameUtils.isPatch(data)){
                    App.loadMustacheTemplate("modules/library/template.html","GamePicker",function(template){
                        var params = {games:[],patchName:curFile.name};
                        for (var i = 0; i < library.length; i++){
                            if (library[i].patchFileId != "")
                                continue;
                            params.games[i] = $.extend({}, library[i]);
                            params.games[i].index = i;
                        }
                        App.makeModal(template.render(params));
                        var selection = -1;
                        $(".selectgamelink").click(function(event){
                            selection = event.delegateTarget.getAttribute("gameindex");
                            $("#gamePicker").modal("hide");
                            return false;
                        });
                        $("#gamePicker").on("hidden",function(){
                            if (selection == -1)
                                doneWithFile(i);
                            else{
                                GameLibrary.addGamePatch(library[selection],curFile.id,function(lib,success){
                                    library = lib;
                                    doneWithFile(i);
                                });
                            }
                        });
                    });
                }
                else{
                    doneWithFile(i);
                }
            },function(loaded,total){
                var percent = loaded / total * 100;
                progressUpdate(percent / files.length + i / files.length * 100);
            });

        }
        if (files != null && files.length > 0)
            loadFile(0);
        else
            callback();
    }

    function addFromDrive(){
        GoogleAPIs.showFilePicker(function(result){
            if (result != null && result.docs.length > 0)
                addFiles(result.docs);
        });
        return false;
    }

    function addFromFree(){
        FreeGamePicker.show(function(gameChosen){
            if (gameChosen != null){
                overlay = App.createMessageOverlay(container,"Downloading " + gameChosen.title + " To Your Drive...");
                App.downloadBinaryFile(gameChosen.path,{
                    success:function(data){
                        GoogleAPIs.uploadBinaryFile(gameChosen.fileName,data,function(result){
                            overlay.remove();
                            overlay = App.createMessageOverlay(container,"Refreshing Game Library...");
                            GameLibrary.addGame(gameChosen.id,result.id,function(lib,success){
                                library = lib;
                                onLibraryLoaded();
                            });
                        });
                    }
                })
            }
        });
        return false;
    }


    return Module;
})