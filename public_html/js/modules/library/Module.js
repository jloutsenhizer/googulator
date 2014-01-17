define(["GameLibrary","FreeGamePicker", "GoogleAPIs", "GameUtils", "OfflineUtils"], function(GameLibrary,FreeGamePicker,GoogleAPIs, GameUtils, OfflineUtils){
    var Module = {};

    var container;

    var library = null;
    var overlay = {};

    var authenticated = false;
    var gameIdFromUrl = null;



    Module.init = function(c){
        var urlHandler = function(req){
            App.setActiveModule("library");
            document.title = "Googulator - Library"
            if (req.params["gameid"] == null)
                gameIdFromUrl = null;
            else{
                gameIdFromUrl = decodeURIComponent(req.params["gameid"]);
                if (library != null){
                    var game = library.getGameById(gameIdFromUrl);
                    if (game != null)
                        document.title += " - " + (game != null ? game.title : gameIdFromUrl);
                }
            }
        };
        App.davis.get("/library",urlHandler);
        App.davis.get("/library/game/:gameid",urlHandler);
        App.davis.get("/library/game/:gameid/",urlHandler)
        container = c;
        $("#addFromDrive").click(addFromDrive);
        $("#addFromFree").click(addFromFree);

        if (!authenticated)
            overlay = App.createMessageOverlay(container,"You must login with google before you can access your library!");
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/library" && Davis.location.current().indexOf("/library/") != 0){
            if (selectedGame == null)
                Davis.location.assign("/library");
            else
                Davis.location.assign("/library/game/" + encodeURIComponent(selectedGame.id));
        }
        if (params.driveState != null){
            doDriveLoad(params.driveState,params.driveOverlay);
        }
        else if (params.gameid != null){
            doGameLoad(params.gameid);
        }
        OfflineUtils.checkLocalStorageEnabled(function(offlineEnabled){
            if (offlineEnabled)
                container.find("#availableOffline").removeAttr("disabled");
            else
                container.find("#availableOffline").attr("disabled","disabled");
        });
    }

    Module.onFreeze = function(){

    }

    Module.onAuthenticated = function(){
        authenticated = true;
        if (overlay != null)
            overlay.remove();
        overlay = null;
        if (!App.websiteBrokenMode)
            refreshGameLibrary();
        else{
            App.createMessageOverlay(container,"The website isn't functioning currently. Unfortunately you aren't able to access the library tab in this state!");
        }
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
                selectGame(game);
                loadGame(game);
            }
        });
    }

    function doGameLoad(gameid){
        if (library == null){
            setTimeout(function(){
                doGameLoad(gameid);
            },10);
            return;
        }
        var game = library.getGameById(gameid);
        if (game != null){
            selectGame(game);
            loadGame(game);
        }
    }


    function refreshGameLibrary(){
        if (overlay != null)
            overlay.remove();
        overlay = App.createMessageOverlay(container,"Refreshing Game Library...");
        GameLibrary.refreshLibrary(function (data){
            library = data;
            onLibraryLoaded();
        });
    }

    function onLibraryLoaded(){
        $("#libraryList").empty();
        $("#GameDisplayArea").empty();
        App.loadMustacheTemplate("modules/library/template.html","libraryItem",function(template){
            library.sort(function(a,b){
                if (a.title.toUpperCase() < b.title.toUpperCase())
                    return -1;
                else if (a.title.toUpperCase() > b.title.toUpperCase())
                    return 1;
                return 0;
            });
            for (var i = 0; i < library.length; i++){
                var html = template.render($.extend({selected:isSelectedGame(library[i]),
                    iconClass: GameUtils.getGameIconClass(library[i].id)},library[i]));
                var item = $(html);
                $("#libraryList").append(item);
                item.click({game:library[i]}, function(event){
                    var item = $(event.delegateTarget);
                    if (item.hasClass("selected"))
                        return;
                    $("#libraryList .selected").removeClass("selected");
                    item.addClass("selected");
                    selectGame(event.data.game);
                    event.preventDefault();
                });
                item.dblclick({game:library[i]}, function(event){
                    loadGame(event.data.game);
                    event.preventDefault();
                })
            }
            if (overlay != null)
                overlay.remove();
            overlay = null;
        });

    }

    var selectedGame = null;

    function isSelectedGame(game){
        if (game.equals(selectedGame) || game.id == gameIdFromUrl){
            gameIdFromUrl = null;
            selectGame(game);
            return true;
        }
        return false;
    }

    function selectGame(game){
        Davis.location.assign("/library/game/" + encodeURIComponent(game.id));
        selectedGame = game;
        $("#GameDisplayArea").empty();
        OfflineUtils.checkLocalStorageEnabled(function(offlineEnabled){
            game.isMadeAvailableOffline(function(availableOffline){
                App.loadMustacheTemplate("modules/library/template.html","gameDisplay",function(template){
                    var display = $(template.render($.extend({
                        saveStateEnabled: game.saveStateFileId != null,
                        offlineModeEnabled: offlineEnabled,
                        availableOffline: availableOffline
                    },game)));
                    $("#GameDisplayArea").append(display);
                    display.find("#play").click(function(event){
                        event.preventDefault();
                        loadGame(game);
                    });
                    display.find("#remove").click(function(event){
                        event.preventDefault();
                        App.showModalConfirmation("Are you sure?","Are you sure you want to remove " + game.title + " from your library?",function(confirm){
                            if (confirm){
                                if (overlay != null)
                                    overlay.remove();
                                overlay = App.createMessageOverlay(container,"Removing " + game.title + " from your library...");
                                game.removeFromLibrary(function(){
                                    refreshGameLibrary();
                                });
                            }
                        });
                    });
                    display.find("#availableOffline").click(function(event){
                        if (event.delegateTarget.checked){
                            overlay = App.createMessageOverlay(container,"Making " + game.title + " available offline...");
                            game.makeAvailableOffline(function(success){
                                if (!success){
                                    App.showModalMessage("Something Went Wrong","We were unable to make the game available offline!");
                                }
                                event.delegateTarget.checked = success;
                                overlay.remove();
                            });
                        }
                        else{
                            overlay = App.createMessageOverlay(container,"Restoring " + game.title + " to temporary storage...");
                            game.unMakeAvailableOffline(function(success){
                                if (!success){
                                    App.showModalMessage("Something Went Wrong","We were unable to remove the game from offline storage!");
                                }
                                event.delegateTarget.checked = !success;
                                overlay.remove();

                            });
                        }

                    });
                    display.find("#useSaveState").click(function(event){
                        //App.showModalConfirmation
                        if (event.delegateTarget.checked){
                            App.loadMustacheTemplate("modules/library/template.html","saveNotFound",function(template){
                                App.makeModal(template.render(game));
                                var noEvent= true;
                                $("#loadSave").click(function(){
                                    noEvent = false;
                                    $("#chooseRAMDialog").modal("hide");
                                    overlay = App.createMessageOverlay(container,$("<div>Loading saveState for " + game.title + "...</div><div class='pbar'></div>"));
                                    GoogleAPIs.showFilePicker(function(result){
                                        if (result != null && result.docs.length == 1){
                                            game.setGameSaveStateFileId(result.docs[0].id,function(success){
                                                if (!success){
                                                    event.delegateTarget.checked = false;
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
                                    },{multiSelect:false,query:game.getDefaultSaveStateFileName()});
                                });
                                $("#createSave").click(function(){
                                    noEvent = false;
                                    $("#chooseRAMDialog").modal("hide");
                                    overlay = App.createMessageOverlay(container,$("<div>Creating saveState for " + game.title + "...</div><div class='pbar'></div>"));
                                    game.createGameSaveStateData(function(saveState){
                                        if (overlay != null)
                                            overlay.remove();
                                        overlay = null;
                                    })
                                });
                            });
                        }
                        else{
                            App.showModalConfirmation("Dissociate SaveState","Are you sure you want to dissociate the saveState file with this game?",function(result){
                                if (result){
                                    if (overlay != null)
                                        overlay.remove();
                                    overlay = App.createMessageOverlay(container,$("<div>Dissociating saveState for " + game.title + "...</div><div class='pbar'></div>"));
                                    game.setGameSaveStateFileId(null,function(success){
                                        if (overlay != null)
                                            overlay.remove();
                                        overlay = null;
                                    },progressUpdate);
                                }
                                else{
                                    event.delegateTarget.checked = true;
                                }
                            });
                        }
                    });
                    display.find(".editGameTitle").click(function(){
                        App.loadMustacheTemplate("modules/library/template.html","GameRename",function(template){
                            var modal = $(template.render(game));
                            modal.find("#inputNewGameName").keypress(function (e) {
                                if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
                                    modal.find("#Save").click();
                                    return false;
                                }
                                return true;
                            });
                            modal.find("#Save").click(function(){
                                overlay = App.createMessageOverlay(container, "Renaming Game...");
                                game.setGameTitle(modal.find("#inputNewGameName").val(),function(){
                                    onLibraryLoaded();
                                });
                                modal.modal("hide");

                            });
                            modal.find("#useDefault").click(function(){
                                overlay = App.createMessageOverlay(container, "Resetting Game Title...");
                                game.setGameTitle(null,function(){
                                    onLibraryLoaded();
                                });
                                modal.modal("hide");
                            });
                            App.makeModal(modal);
                        });
                    });
                });
            });
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

    function switchToEmulator(game){
        if (overlay != null)
            overlay.remove();
        overlay = App.createMessageOverlay(container,$("<div>Loading SaveState for " + game.title + "...</div><div class='pbar'></div>"));
        game.getGameSaveStateData(function(){
            App.setActiveModule("play",{game: game});
            if (overlay != null)
                overlay.remove();
            overlay = null;
        },progressUpdate);
    }

    function addFiles(files,callback){
        if (callback == null) callback = function(){};
        var failedFiles = [];
        var doneWithFile = function(i){
            if (overlay != null)
                overlay.remove();
            overlay = null;
            i++;
            if (i < files.length){
                loadFile(i);
            }
            else{
                App.loadMustacheTemplate("modules/library/template.html","doneLoadingDialog",function(template){
                    onLibraryLoaded();
                    var dialog = App.makeModal(template.render({
                        numSuccessful: files.length - failedFiles.length,
                        numTried: files.length,
                        someFilesFailed: failedFiles.length != 0,
                        filesFailed: failedFiles
                    }));
                    dialog.on("hidden",function(){
                        callback();
                    });
                });
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
                data = GameUtils.decompress(data);
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
                            if (library[i].patchFileId != null)
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
                    var header = GameUtils.getHeader(data);
                    var failedFileDesc = {fileName: curFile.name};
                    if (header == null)
                        failedFileDesc.reason = "Unsupported or Corrupted File";
                    else if (header.type == "gba")
                        failedFileDesc.reason = "Gameboy Advance is not Supported";
                    else if (header.type == "snes")
                        failedFileDesc.reason = "SNES is not Supported";
                    else
                        failedFileDesc.reason = "Unknown";
                    failedFiles.push(failedFileDesc);
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

    function addFromDrive(event){
        GoogleAPIs.showFilePicker(function(result){
            if (result != null && result.docs.length > 0)
                addFiles(result.docs);
        });
        event.preventDefault();
    }

    function addFromFree(event){
        FreeGamePicker.show(function(gameChosen){
            if (gameChosen != null){
                if (gameChosen.path === null){
                    overlay = App.createMessageOverlay(container,"Refreshing Game Library...");
                    GameLibrary.addGame(gameChosen.id,"",function(lib,success){
                        library = lib;
                        onLibraryLoaded();
                    });
                }
                else{
                    overlay = App.createMessageOverlay(container,"Downloading " + gameChosen.title + " To Your Drive...");
                    App.downloadBinaryFile(gameChosen.path,{
                        success:function(data){
                            GoogleAPIs.uploadBinaryFile(gameChosen.fileName,data,function(fileid){
                                overlay.remove();
                                overlay = App.createMessageOverlay(container,"Refreshing Game Library...");
                                GameLibrary.addGame(gameChosen.id,fileid,function(lib,success){
                                    library = lib;
                                    onLibraryLoaded();
                                });
                            });
                        }
                    })
                }
            }
        });
        event.preventDefault();
    }


    return Module;
})