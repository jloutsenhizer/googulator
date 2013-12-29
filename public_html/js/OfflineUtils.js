define(function(){
    var OfflineUtils = {};

    var MINIMUM_LOCAL_STORAGE = 1024 * 1024 * 20;//20MB used to swap in and out temporary files and for the metadata storage

    window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
    navigator.persistentStorage = navigator.persistentStorage || navigator.webkitPersistentStorage;

    /* This is the offline api for googulator
     * localStorage - used for metadata regarding the local file System and small cached resources, all fields should be JSON encoded when written and JSON decoded when read
     * localStorage.extraQuotaNeeded - used to specify how much extra quota is required for the longTermStorageFiles
     * localStorage.localStorageEnabled - specifies whether or not local file system is enabled for caching google drive files
     * localStorage.userInfo - cached from googulator user info lookup. Key information for emulator operation is metafileid
     * localStorage.googleUserInfo - cached from google user info lookup. Doesn't contain anything particulary important
     *
     * local fileSystem:
     * longTermGDrive/ - used to store google drive files that are meant to be maintained forever (they are named by their id)
     * shortTermGDrive/ - used to store google drive files that are meant to be stored temporarily (they are named by their id)
     *
     */



    function verifyStorageQuota(callback){
        navigator.persistentStorage.queryUsageAndQuota(function(used,remaining){
            var total = used + remaining;
            var totalNeeded = JSON.parse(localStorage.extraNeededQuota) + MINIMUM_LOCAL_STORAGE;
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
                    //all necessary directories are in place
                    callback(true);

                },function(error){
                    callback(false);
                });

            },function(error){
                callback(false);

            });

        });
    }

    OfflineUtils.googleDriveFileExists = function(id,callback){
        if (localStorage.localStorageEnabled == null || !JSON.parse(localStorage.localStorageEnabled)){
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
        if (localStorage.localStorageEnabled == null || !JSON.parse(localStorage.localStorageEnabled)){
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
                    callback({
                        modificationTime: metadata.modificationTime,
                        size: metadata.size,
                        longTerm: longTerm
                    });
                },function(){
                    callback(null);
                });

            }

        });
    }

    OfflineUtils.cacheGoogleDriveFile = function(id,data,callback){
        if (localStorage.localStorageEnabled == null || !JSON.parse(localStorage.localStorageEnabled)){
            callback(false);
            return;
        }
        getFileSystem(function(fileSystem){
            if (fileSystem == null){
                callback(false);
                return;
            }
            if (id == App.userInfo.metadataFileId){
                fileSystem.root.getFile("longTermGDrive/" + id,{create:true},function(file){
                    file.createWriter(function(writer){
                        writer.onwriteend = function(){
                            writer.onwriteend = function(){
                                callback(true);
                                file.getMetadata(function(){console.log(arguments)},function(){console.log(argumnets)})
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
            else{
                callback(false);
                return;
            }

        })

    }



    OfflineUtils.initialize = function(callback){
        if (localStorage.localStorageEnabled == null || !JSON.parse(localStorage.localStorageEnabled) || navigator.persistentStorage == null || window.requestFileSystem == null){
            localStorage.localStorageEnabled = JSON.stringify(false);
            callback();
            return;
        }
        verifyBasicLocalFileSystemSetup(function(isUsable){
            localStorage.localStorageEnabled = JSON.stringify(isUsable);
            callback();
        });
    }

    OfflineUtils.enableLocalStorage = function(enable,callback){
        if (!enable || navigator.persistentStorage == null || window.requestFileSystem == null){
            localStorage.localStorageEnabled = JSON.stringify(false);
            callback(false);
            return;
        }
        if (localStorage.extraNeededQuota == null){
            localStorage.extraNeededQuota = JSON.stringify(0);
        }
        verifyStorageQuota(function(haveEnoughStorage){
            if (!haveEnoughStorage){
                localStorage.localStorageEnabled = JSON.stringify(false);
                callback(false);
                return;
            }
            verifyBasicLocalFileSystemSetup(function(verified){
                localStorage.localStorageEnabled = JSON.stringify(verified);
                callback(verified);
            });



        });
    }

    OfflineUtils.checkLocalStorageEnabled = function(callback){
        if (localStorage.localStorageEnabled == null || !JSON.parse(localStorage.localStorageEnabled) || navigator.persistentStorage == null || window.requestFileSystem == null){
            localStorage.localStorageEnabled = JSON.stringify(false);
            callback(false);
            return;
        }
        //it is enabled and the browser supports it
        navigator.persistentStorage.queryUsageAndQuota(function(used,remaining){
            if ((used + remaining) >= MINIMUM_LOCAL_STORAGE){
                callback(true);
                return;
            }

            localStorage.localStorageEnabled = JSON.stringify(false);
            callback(false);

        },function(e){
            localStorage.localStorageEnabled = JSON.stringify(false);
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
        if (!JSON.parse(localStorage.localStorageEnabled))
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