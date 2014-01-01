define(function(){
    var OfflineUtils = {};

    var MINIMUM_LOCAL_STORAGE = 1024 * 1024 * 40;//40MB used to swap in and out temporary files and for the metadata storage

    window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
    navigator.persistentStorage = navigator.persistentStorage || navigator.webkitPersistentStorage;

    /* This is the offline api for googulator
     * localStorage - used for metadata regarding the local file System and small cached resources, all fields should be JSON encoded when written and JSON decoded when read
     * localStorage.extraQuotaNeeded - used to specify how much extra quota is required for the longTermStorageFiles
     * localStorage.fileSystemEnabled - specifies whether or not local file system is enabled for caching google drive files
     * localStorage.userInfo - cached from googulator user info lookup. Key information for emulator operation is metafileid
     * localStorage.googleUserInfo - cached from google user info lookup. Doesn't contain anything particulary important
     *
     * local fileSystem:
     * longTermGDrive/ - used to store google drive files that are meant to be maintained forever (they are named by their id)
     * shortTermGDrive/ - used to store google drive files that are meant to be stored temporarily (they are named by their id)
     *
     */

    var cacheMetadata = null;
    var defaultCacheMetadata = {version:0,fileMetadata:{}};

    //this is the amount we want to round the quota by so that we constantly don't need to be requesting more quota when fiddling with long term files
    var quotaRoundingFactor = 1024*1024;//1MB


    function roundUpQuota(bytes){
        return Math.ceil(bytes / quotaRoundingFactor) * quotaRoundingFactor;
    }

    function syncCacheMetadata(callback){
        getFileSystem(function(fileSystem){
            if (fileSystem == false)
                callback(false);
            else{
                fileSystem.root.getFile("cache.metadata",{create: true},function(file){
                    if (cacheMetadata == null){//read it if we don't have it
                        file.file(function(file){
                            var reader = new FileReader();
                            reader.onload = function(){
                                try{
                                    if (reader.result.byteLength == 0)
                                        throw "empty";
                                    cacheMetadata = JSON.parse(App.stringFromArrayBuffer(reader.result));
                                    callback(true);
                                }
                                catch (e){
                                    cacheMetadata = defaultCacheMetadata;
                                    syncCacheMetadata(callback);
                                }
                            }
                            reader.onerror = function(){
                                callback(false);
                            }
                            reader.readAsArrayBuffer(file);
                        },function(){
                            callback(false);
                        });
                    }
                    else{
                        var data = App.stringToArrayBuffer(JSON.stringify(cacheMetadata));
                        file.createWriter(function(writer){
                            writer.onwriteend = function(){
                                writer.onwriteend = function(){
                                    callback(true);
                                }
                                writer.write(new Blob([data]));
                            }
                            writer.truncate(data.byteLength);

                        },function(){
                            callback(false);
                        });
                    }
                },function(){
                    callback(false);
                })
            }
        })
    }



    function verifyStorageQuota(callback){
        navigator.persistentStorage.queryUsageAndQuota(function(used,avaiable){
            var total = avaiable;
            var extraAmount = JSON.parse(localStorage.extraNeededQuota);
            if (extraAmount == 0) extraAmount = quotaRoundingFactor;//forces the initial quota request to cover an extra step amount
            var totalNeeded = roundUpQuota(extraAmount + MINIMUM_LOCAL_STORAGE);
            if (total < totalNeeded){
                var overlay = App.createMessageOverlay($("body"),"Googulator needs " + (totalNeeded - total) + "B more of local storage.");
                navigator.persistentStorage.requestQuota(totalNeeded,function(amount){
                    overlay.remove();
                    if (amount < totalNeeded){
                        callback(false);
                    }
                    else{
                        callback(true);
                    }

                },function(e){
                    callback(false);
                });
            }
            else{
                callback(true);
            }
        },function(e){
            callback(false);
        })
    }

    function getFileSystem(callback){
        verifyStorageQuota(function(haveEnough){
            if (!haveEnough){
                callback(null);
                return;
            }
            window.requestFileSystem(PERSISTENT,MINIMUM_LOCAL_STORAGE,function(fileSystem){
                callback(fileSystem);
            },function(e){
                callback(null);
            });
        });

    }

    function verifyBasicLocalFileSystemSetup(callback){
        getFileSystem(function(fileSystem){
            if (fileSystem == null){
                callback(false);
                return;
            }

            //verify necessary directories are in place, create them if they aren't there
            fileSystem.root.getDirectory("longTermGDrive",{create: true, exclusive: false},function(directory){
                if (directory == null){
                    callback(false);
                    return;
                }
                fileSystem.root.getDirectory("shortTermGDrive",{create: true, exclusive: false},function(directory){
                    if (directory == null){
                        callback(false);
                        return;
                    }

                    //all necessary directories exist
                    syncCacheMetadata(callback);

                },function(error){
                    callback(false);
                });

            },function(error){
                callback(false);

            });

        });
    }

    OfflineUtils.googleDriveFileExists = function(id,callback){
        if (localStorage.fileSystemEnabled == null || !JSON.parse(localStorage.fileSystemEnabled)){
            callback(false);
            return;
        }
        getFileSystem(function(fileSystem){
            if (fileSystem == null){
                callback(false);
                return;
            }
            fileSystem.root.getFile("longTermGDrive/" + id,{create: false},function(file){
                if (file == null){
                    checkShortTerm();
                    return;
                }
                callback(true);
            },function(){
                checkShortTerm();
            })

            function checkShortTerm(){
                fileSystem.root.getFile("shortTermGDrive/" + id,{create: false},function(file){
                   callback(file != null);
                },function(){
                    callback(false);
                })

            }

        });
    }

    OfflineUtils.getGoogleDriveFileMetadata = function(id,callback){
        if (localStorage.fileSystemEnabled == null || !JSON.parse(localStorage.fileSystemEnabled)){
            callback(null);
            return;
        }
        getFileSystem(function(fileSystem){
            if (fileSystem == null){
                callback(null);
                return;
            }
            fileSystem.root.getFile("longTermGDrive/" + id,{create: false},function(file){
                if (file == null){
                    checkShortTerm();
                }
                else{
                    processFile(file,true);

                }

            }, function(error){
                checkShortTerm();

            });
            function checkShortTerm(){
                fileSystem.root.getFile("shortTermGDrive/" + id,{create: false},function(file){
                    if (file == null){
                        callback(null);
                    }
                    else{
                        processFile(file,false);
                    }
                }, function(error){
                    callback(null);
                })
            }
            function processFile(file,longTerm){
                file.getMetadata(function(metadata){
                    if (metadata == null){
                        callback(null);
                        return;
                    }
                    var extraMetadata = cacheMetadata.fileMetadata[id];
                    if (extraMetadata == null)
                        extraMetadata = {};
                    metadata = $.extend(extraMetadata,{
                        modificationTime: metadata.modificationTime,
                        size: metadata.size,
                        longTerm: longTerm
                    });
                    metadata.contentsModifiedDate = new Date(metadata.contentsModifiedDate);
                    metadata.lastAccessTime = new Date(metadata.lastAccessTime);
                    callback(metadata);
                },function(){
                    callback(null);
                });

            }

        });
    }

    OfflineUtils.getGoogleDriveFileContents = function(id,callback){
        if (localStorage.fileSystemEnabled == null || !JSON.parse(localStorage.fileSystemEnabled)){
            callback(null);
            return;
        }
        getFileSystem(function(fileSystem){
            if (fileSystem == null){
                callback(null);
                return;
            }
            fileSystem.root.getFile("longTermGDrive/" + id,{create: false},function(file){
                if (file == null){
                    checkShortTerm();
                }
                else{
                    processFile(file,true);

                }

            }, function(error){
                checkShortTerm();

            });
            function checkShortTerm(){
                fileSystem.root.getFile("shortTermGDrive/" + id,{create: false},function(file){
                    if (file == null){
                        callback(null);
                    }
                    else{
                        processFile(file,false);
                    }
                }, function(error){
                    callback(null);
                })
            }
            function processFile(file,longTerm){
                file.file(function(file){
                    var reader = new FileReader();
                    reader.onload = function(){
                        var meta = cacheMetadata.fileMetadata[id];
                        if (meta == null)
                            meta = cacheMetadata.fileMetadata[id] = {};
                        meta.lastAccessTime = new Date().getTime();
                        syncCacheMetadata(function(success){
                            //should we do something if we can't sync the changes?
                            callback(new Uint8Array(reader.result));
                        });

                    }
                    reader.onerror = function(){
                        callback(null);
                    }
                    reader.readAsArrayBuffer(file);
                },function(){
                    callback(null);
                });
            }

        });

    }

    OfflineUtils.cacheGoogleDriveFile = function(id,data,dateModified,callback){
        if (localStorage.fileSystemEnabled == null || !JSON.parse(localStorage.fileSystemEnabled)){
            callback(false);
            return;
        }
        getFileSystem(function(fileSystem){
            if (fileSystem == null){
                callback(false);
                return;
            }

            OfflineUtils.getGoogleDriveFileMetadata(id,function(oldMetadata){//oldMetadata = null if it isn't found
                var longTerm = (cacheMetadata.fileMetadata[id] != null && cacheMetadata.fileMetadata[id].shouldBeInLongTerm);
                var pathStart = longTerm ? "longTermGDrive/" : "shortTermGDrive/";
                function doWrite(){
                    fileSystem.root.getFile(pathStart + id,{create:true},function(file){
                        file.createWriter(function(writer){
                            writer.onwriteend = function(){
                                writer.onwriteend = function(){
                                    //done writing file store its modified date

                                    //if we don't get a date its local modification
                                    if (dateModified == null) dateModified = new Date();

                                    var meta = cacheMetadata.fileMetadata[id];
                                    if (meta == null)
                                        meta = cacheMetadata.fileMetadata[id] = {};
                                    meta.contentsModifiedDate = dateModified.getTime();
                                    meta.lastAccessTime = new Date().getTime();
                                    syncCacheMetadata(function(success){
                                        //should we delete the file if we fail???
                                        callback(success);
                                    })


                                }
                                writer.write(new Blob([data]));
                            }
                            writer.truncate(data.byteLength);

                        },function(){
                            callback(false);
                        })
                    },function(e){
                        callback(false);
                    });
                }
                if (longTerm){
                    var sizeChange = data.byteLength;
                    if (oldMetadata != null){
                        sizeChange -= oldMetadata.size;
                    }
                    localStorage.extraNeededQuota = JSON.stringify(JSON.parse(localStorage.extraNeededQuota) + sizeChange);
                    verifyStorageQuota(function(success){
                        if (success){
                            //TODO: check if we have enough storage, if we don't delete least accessed short term files
                            doWrite();
                        }
                        else{
                            callback(false);
                        }
                    });
                }
                else{
                    //TODO: check if we'll have enough storage, if we won't we should delete least accessed files until we do
                    doWrite();
                }


            });

        });
    }

    OfflineUtils.markFileForLongTermStorage = function(id,callback){

        function applyMetadataChange(callback){
            var metadata = cacheMetadata.fileMetadata[id];
            if (metadata == null){
                metadata = cacheMetadata.fileMetadata[id] = {};
            }
            metadata.shouldBeInLongTerm = true;
            syncCacheMetadata(callback);
        }

        getFileSystem(function(fileSystem){
            if (fileSystem == null)
                callback(false);

            fileSystem.root.getFile("shortTermGDrive/" + id,{create: false},function(file){
                if (file != null){
                    file.getMetadata(function(metadata){
                        if (metadata == null){
                            callback(false);
                        }
                        else{
                            //anytime we adjust this number we round up so that we aren't requesting quota if a file changes by a small amount in size
                            localStorage.extraNeededQuota = JSON.stringify(JSON.parse(localStorage.extraNeededQuota) + metadata.size);
                            verifyStorageQuota(function(success){
                                if (!success){
                                    callback(false);
                                }
                                else{
                                    file.moveTo(fileSystem.root,"longTermGDrive/" + id,function(){
                                        applyMetadataChange(callback);
                                    },function(){
                                        callback(false);
                                    });
                                }
                            })
                        }
                    },function(){
                        callback(false);
                    });
                }
                else{
                    applyMetadataChange(callback);
                }
            },function(){
                applyMetadataChange(callback);
            });

        })
    }

    function alterLocalStorageEnabledProperty(enabled){
        console.log(enabled ? "WRITING TRUE" : "WRITING FALSE");
        localStorage.fileSystemEnabled = enabled;
    }



    OfflineUtils.initialize = function(callback){
        if (localStorage.fileSystemEnabled == null || !JSON.parse(localStorage.fileSystemEnabled) || navigator.persistentStorage == null || window.requestFileSystem == null){
            alterLocalStorageEnabledProperty(false);
            callback();
            return;
        }
        verifyBasicLocalFileSystemSetup(function(isUsable){
            alterLocalStorageEnabledProperty(isUsable);
            callback();
        });
    }

    OfflineUtils.enableLocalStorage = function(enable,callback){
        if (!enable || navigator.persistentStorage == null || window.requestFileSystem == null){
            alterLocalStorageEnabledProperty(false);
            callback(false);
            return;
        }
        if (localStorage.extraNeededQuota == null){
            localStorage.extraNeededQuota = JSON.stringify(0);
        }
        verifyStorageQuota(function(haveEnoughStorage){
            if (!haveEnoughStorage){
                alterLocalStorageEnabledProperty(false);
                callback(false);
                return;
            }
            verifyBasicLocalFileSystemSetup(function(verified){
                if (!verified){
                    callback(false);
                    return;
                }
                function afterDone(){
                    alterLocalStorageEnabledProperty(true);
                    callback(true);
                }
                if (App.userInfo != null && App.userInfo.metadataFileId != null){
                    OfflineUtils.markFileForLongTermStorage(App.userInfo.metadataFileId,function(success){
                        if (success){
                            afterDone();

                        }
                        else{
                            callback(false);
                        }

                    });
                }
                else{
                    afterDone();
                }

            });



        });
    }

    OfflineUtils.checkLocalStorageEnabled = function(callback){
        if (localStorage.fileSystemEnabled == null || !JSON.parse(localStorage.fileSystemEnabled) || navigator.persistentStorage == null || window.requestFileSystem == null){
            alterLocalStorageEnabledProperty(false);
            callback(false);
            return;
        }
        //it is enabled and the browser supports it
        navigator.persistentStorage.queryUsageAndQuota(function(used,available){
            if (available >= MINIMUM_LOCAL_STORAGE){
                callback(true);
                return;
            }

            alterLocalStorageEnabledProperty(false);
            callback(false);

        },function(e){
            alterLocalStorageEnabledProperty(false);
            callback(false);
            return;
        })
    }

    //TODO: Offline utils needs a way to get an offline filesystem for caching drive files

    //persists user info from googulator server into the offline cache
    //TODO: determine scheme to be able to sync local user info changes (really only needed if metadata file changed)
    OfflineUtils.storeUserInfo = function(){
        localStorage.userInfo = JSON.stringify(App.userInfo);
    }

    //persist google user info
    OfflineUtils.storeGoogleUserInfo = function(){
        localStorage.googleUserInfo = JSON.stringify(App.googleUserInfo);
    }

    //attempts to enable googulator offline mode
    OfflineUtils.enableGoogulatorOffline = function(){
        if (App.googulatorOffline)
            return true;
        try{
            if (localStorage.userInfo != null){
                var info = JSON.parse(localStorage.userInfo);
                if (info.metadataFileId != null && info.googleid != null){
                    App.userInfo = info;
                    App.googulatorOffline = true;
                    return true;
                }

            }
        }
        catch (e){}
        return false;
    }

    //attempts to enable google offline mode
    OfflineUtils.enableGoogleOffline = function(){
        if (!JSON.parse(localStorage.fileSystemEnabled))
            return false;
        if (App.googleOffline)
            return true;
        try{
            if (OfflineUtils.enableGoogulatorOffline()){
                App.googleOffline = true;//if we don't have google user info (that's really unlikely!) we can still operate
                if (App.googleUserInfo == null){
                    try{
                        if (localStorage.googleUserInfo != null){
                            var info =  JSON.parse(localStorage.googleUserInfo);
                            App.googleUserInfo = info;
                        }
                    }
                    catch (e){}
                }
                if (App.googleUserInfo == null)
                    App.googleUserInfo = {};
                return true;
            }
        }
        catch (e){}
        return false;
    }

    return OfflineUtils;

});