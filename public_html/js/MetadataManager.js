define(["GoogleAPIs","OfflineUtils"],function(GoogleAPIs,OfflineUtils){
    "use strict";

    var MetadataManager = {};

    var currentMetadataVersion = 0;

    function createEmptyMetadata(){
        return {
            version: currentMetadataVersion,
            library: []
        };
    }

    function validateAndUpdateMetadata(metadata,callback){
        if (metadata.version == currentMetadataVersion){
            if (metadata.library != null){
                callback(metadata,false);
            }
            else{
                throw "invlaid metadata file";
            }
        }
        else{
            throw "invlaid metadata file";
        }
    }

    function importLegacyLibrary(callback){
        if (App.userInfo.needsLibraryExport){
            var overlay = App.createMessageOverlay($("body"),"Updating library format...");
            $.ajax("/php/getLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()),{
                success:function(library){
                    MetadataManager.metadata.library = [];
                    for (var i = 0, li = library.length; i < li; i++){
                        if (library[i].saveFileId == "") library[i].saveFileId = null;
                        if (library[i].saveStateFileId == "") library[i].saveStateFileId = null;
                        if (library[i].patchFileId == "") library[i].patchFileId = null;
                        if (MetadataManager.lookupGameTitle(library[i].id) === library[i].title){
                            library[i].title = null;
                        }
                        MetadataManager.addGameToLibrary(library[i].id,library[i].fileId,library[i].saveFileId,library[i].saveStateFileId,library[i].patchFileId,library[i].title,null);
                    }
                    MetadataManager.persistChanges(function donePersist(){

                        $.ajax("/php/obliterateLibrary.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()),{
                            success:function(){
                                overlay.remove();
                                App.userInfo.needsLibraryExport = false;
                                OfflineUtils.storeUserInfo();
                                callback();
                            },
                            error: donePersist

                        });

                    });
                },
                error:function(){
                    setTimeout(function(){
                        importLegacyLibrary(callback);
                    },1000);
                }
            });
        }
        else{
            callback();
        }
    }

    MetadataManager.loadMetadata = function(callback){
        var overlay = App.createMessageOverlay($("body"),"Loading metadata...");
        if (App.userInfo.metadataFileId == "" || App.userInfo.metadataFileId == null){
            App.loadMustacheTemplate("dialogTemplates.html","metadataFileNotFound",function(template){
                var modal = App.makeModal(template.render());
                modal.on("hidden",function(){
                    overlay.remove();
                    MetadataManager.loadMetadata(callback);
                });
                modal.find("#createMetadataFile").click(function(){
                    overlay.remove();
                    overlay = App.createMessageOverlay($("body"),"Creating metadata...");
                    modal.off("hidden");
                    modal.modal("hide");
                    var metadata = createEmptyMetadata();
                    GoogleAPIs.uploadBinaryFile("googulator.metadata",App.stringToArrayBuffer(JSON.stringify(metadata)),function(fileid){
                        $.ajax("/php/setMetadataFileId.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&id=" + fileid,{
                            success:function(result2){
                                if (result2.success){
                                    App.userInfo.metadataFileId = fileid;
                                    OfflineUtils.storeUserInfo();
                                    overlay.remove();
                                    MetadataManager.loadMetadata(callback);
                                }
                                else{
                                    App.showModalMessage("Error","Failed to update metadata reference id!",function(){
                                        overlay.remove();
                                        MetadataManager.loadMetadata(callback);
                                    });
                                }
                            },
                            error: function(){
                                App.showModalMessage("Error","Failed to update metadata reference id!",function(){
                                    overlay.remove();
                                    MetadataManager.loadMetadata(callback);
                                });
                            }

                        });
                    });

                });

                modal.find("#loadMetadataFile").click(function(){
                    GoogleAPIs.showFilePicker(function(result){
                        if (result != null && result.docs.length == 1){
                            overlay = App.createMessageOverlay($("body"),"Updating metadata reference...");
                            $.ajax("/php/setMetadataFileId.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&id=" + result.docs[0].id,{
                                success:function(result2){
                                    if (result2.success){
                                        App.userInfo.metadataFileId = result.docs[0].id;
                                        OfflineUtils.storeUserInfo();
                                        overlay.remove();
                                        MetadataManager.loadMetadata(callback);
                                    }
                                    else{
                                        App.showModalMessage("Error","Failed to update metadata reference id!",function(){
                                            overlay.remove();
                                            MetadataManager.loadMetadata(callback);
                                        });
                                    }
                                },
                                error: function(){
                                    App.showModalMessage("Error","Failed to update metadata reference id!",function(){
                                        overlay.remove();
                                        MetadataManager.loadMetadata(callback);
                                    });

                                }

                            });
                        }
                        else{
                            MetadataManager.loadMetadata(callback);
                        }
                    },{
                        multiSelect:false,
                        query:"googulator.metadata"
                    });
                    overlay.remove();
                    modal.off("hidden");
                    modal.modal("hide");

                });
            });
        }
        else{
            GoogleAPIs.getFile(App.userInfo.metadataFileId,function(fileData){
                try{
                    if (fileData == null){
                        overlay.remove();
                        App.userInfo.metadataFileId = "";
                        MetadataManager.loadMetadata(callback);
                        return;
                    }
                    var metadata = JSON.parse(App.stringFromArrayBuffer(fileData));
                    validateAndUpdateMetadata(metadata,function(metadata,changed){
                        if (changed){//need to persist the change

                        }
                        else{
                            MetadataManager.metadata = metadata;
                            (function loadTitleDB(){
                                function dbReady() {
                                    overlay.remove();
                                    importLegacyLibrary(function onImportDone(){
                                        overlay.remove();
                                        callback();
                                    });
                                }
                                $.ajax("/php/titlesDB.php",{
                                    success:function(dbInfo){
                                        MetadataManager.titlesDB = dbInfo.db;
                                        dbReady();

                                    },
                                    error:function(){
                                        MetadataManager.titlesDB = {};
                                        dbReady();
                                    }
                                })
                            })();
                        }
                    });
                }
                catch(e){
                    overlay.remove();
                    App.userInfo.metadataFileId = "";
                    MetadataManager.loadMetadata(callback);
                }
            });
        }
    };

    MetadataManager.addGameToLibrary = function(id,fileId,saveFileId,saveStateFileId,patchFileId,title,image){
        MetadataManager.metadata.library.push({
            id: id,
            fileId: fileId,
            image: image,
            title: title,
            saveFileId: saveFileId,
            patchFileId: patchFileId,
            saveStateFileId: saveStateFileId
        });
    }

    MetadataManager.setGameSaveStateFileId = function(index,saveStateFileId){
        MetadataManager.metadata.library[index].saveStateFileId = saveStateFileId;
    }
    MetadataManager.setGameSaveFileId = function(index,saveFileId){
        MetadataManager.metadata.library[index].saveFileId = saveFileId;
    }

    MetadataManager.getLibrary = function(){
        return $.extend(true, [], MetadataManager.metadata.library);
    }

    MetadataManager.removeGameFromLibrary = function(index){
        MetadataManager.metadata.library.splice(index,1);
    }

    MetadataManager.setGameTitle = function(index,title){
        MetadataManager.metadata.library[index].title = title;
    }

    MetadataManager.persistChanges = function(callback){
        GoogleAPIs.updateBinaryFile(App.userInfo.metadataFileId,App.stringToArrayBuffer(JSON.stringify(MetadataManager.metadata)),function(){
            callback();
        });
    }

    MetadataManager.lookupGameTitle = function(id){
        var title = MetadataManager.titlesDB[id];
        if (title == null){
            title = id;
        }
        return title;
    }

    MetadataManager.lookupGameImage = function(id){
        return "/img/ROMPictures/" + id + ".jpg";
    }

    return MetadataManager;

});