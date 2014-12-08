define(["OfflineUtils"], function(OfflineUtils){
    "use strict";

    var GoogleAPIs = {};

    var exponentialBackoffBase = 1.5; //the base ammount to backoff each api call failure

    var clientId = window.configuration.google.clientId;
    var apiKey = window.configuration.google.apiKey;
    var scopes = "https://www.googleapis.com/auth/drive " +
        "https://www.googleapis.com/auth/drive.file " +
        "https://www.googleapis.com/auth/drive.metadata.readonly " +
        "https://www.googleapis.com/auth/drive.readonly " +
        "https://www.googleapis.com/auth/drive.install " +
        "https://www.googleapis.com/auth/userinfo.profile";

    var initialized = false;
    var authenticated = false;

    var fileCache = {};
    var fileCacheModifiedDate = {};

    window.GoogleApiException = function(type,message){
        this.type = type;
        this.message = message;
    };
    GoogleApiException.prototype.isGoogleApiError = true;
    GoogleApiException.NO_TOKEN = 1;
    GoogleApiException.prototype.toString = function(){
        var type;
        switch (this.type) {
            case GoogleApiException.NO_TOKEN:
                type = "NO_TOKEN";
                break;
            default:
                type = "UNKNOWN_ERROR(" + this.type + ")";
        }
        return "GoogleApiException " + type + " " + this.message;
    };

    GoogleAPIs.checkAuthentication = function(callback,errorCount,overlay){
        if (gapi == null){
            console.error("no gapi");
            if (OfflineUtils.enableGoogleOffline()){
                App.showModalMessage("Offline Mode","We were unable to load Google scripts, offline mode has been enabled!",function(){
                    callback(true);
                });
            }
            else{
                callback(false,true);
            }
            return;
        }

        if (errorCount == null) errorCount = 0;
        if (!initialized){
            if (gapi.client == null){
                if (errorCount >= 1500 && overlay == null){
                    overlay = App.createMessageOverlay($("body"),$("<span>We're having difficulties loading Google APIs. These are needed to login and play games.<br>If you have anti tracking software, it could be causing the issue and you should try disabling it for www.googulator.com and then <a href='javascript:void(0);' class='reloadLink'>reloading the app</a>.<br><a href='javascript:void(0);' class='dismissLink'>Click here to dismiss this popup</a></span>"));
                    overlay.find(".reloadLink").click(function(){
                        App.refreshPage();
                    });
                    overlay.find(".dismissLink").click(function(){
                        overlay.remove();
                    });

                }
                var that = this;
                setTimeout(function(){
                    that.checkAuthentication(callback,errorCount + 1, overlay);
                },1);
                return;
            }
            if (overlay != null)
                overlay.remove();
            gapi.client.setApiKey(apiKey);
            window.setTimeout(function(){
                gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: true}, function (authResult) {
                    initialized = true;
                    authenticated = authResult != null && !authResult.error;
                    if (authenticated){
                        if (window.getParams.revokeGoogleAccess){//if we are logging out we do a jsonp request to revoke the access token. Otherwise we just ignore this parameter since it doesn't matter
                            $.ajax("https://accounts.google.com/o/oauth2/revoke?token=" + GoogleAPIs.getTokenMember("access_token"),{
                                type: "GET",
                                contentType: "application/json",
                                dataType: 'jsonp',
                                success:function(){
                                    authenticated = false;
                                    callback(false);
                                }, error: function(){
                                    console.error("Failed to revoke access token");
                                    console.error(arguments);
                                    var modal = App.showModalMessage("Failed to Log Out","Sorry but we have failed to log out!, you can manually logout by going here:\nhttps://security.google.com/settings/security/permissions",function(){
                                        onAuthenticate(callback);
                                    });
                                }
                            })
                        }
                        else{
                            onAuthenticate(callback);
                        }
                    }
                    else
                        callback(authenticated)
                });
            },1);
        }
        else{
            callback(authenticated);
        }
    };

    GoogleAPIs.revokeAccess = function(){
        //we do it this way as an easy way to trigger the might loose data notification from closing a game without saving
        window.getParams = {"revokeGoogleAccess":"true"};
        App.refreshPage();
    }

    GoogleAPIs.authenticate = function(callback){
        if (initialized){
            var returnVal = gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: false}, function(authResult){
                authenticated = authResult != null && !authResult.error;
                if (authenticated){
                    onAuthenticate(callback);
                }
                else
                    callback(authenticated);
            });
            if (returnVal){
                if (typeof returnVal.screenX == "undefined" || returnVal.screenX == 0)
                    return false;
            }
            else{
                return false;
            }

            return true;
        }
        else{
            callback(authenticated);
        }
    };

    function onAuthenticationLost(ondismiss){
        authenticated = false;
        if (reauthInterval != null){
            clearInterval(reauthInterval);
            reauthInterval = null;
        }
        //first we should try to silently relogin
        gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: true}, function (authResult) {
            authenticated = authResult != null && !authResult.error;
            //if we can't do so we should prompt the user if requested
            if (!authenticated) {
                if (ondismiss != null) {
                    App.showModalConfirmation("Authentication Lost","You seem to have been logged out form Google. Would you like to log back in?",function(response){
                        if (response){
                            GoogleAPIs.authenticate(function(authetnicated){
                                ondismiss(true);
                            });
                        }
                        else{
                            App.showModalConfirmation("Authentication Lost","Are you sure?? Not logging back in could cause you to lose data!\n\nPlease confirm, would you like to log back in?",function(response){
                                if (response){
                                    GoogleAPIs.authenticate(function(authetnicated){
                                        ondismiss(true);
                                    });
                                }
                                else{
                                    //try to go into offline mode
                                    if (OfflineUtils.enableGoogleOffline()) {
                                        App.showModalMessage("Offline Mode Enabled","You have gone into offline mode.",function(){
                                            ondismiss(true);
                                        });
                                    }
                                    else{
                                        ondismiss(false);
                                    }
                                }
                            });
                        }
                    });
                }
            }
            else{
                onAuthenticate(function(){
                    if (ondismiss != null)
                        ondismiss(true);
                });
            }
        });


    }

    var oldOnError = window.onerror;
    if (typeof oldOnError != "function")
        oldOnError = function(){};

    window.onerror = function(exceptionString,file,line,column,exceptionObject){
        if (exceptionObject.isGoogleApiError) {
            console.log("uncaught googleAPIError!");
        }
        oldOnError.apply(this,arguments);
    };

    var reauthInterval = null;

    function setupReauth(){
        if (reauthInterval != null){
            clearInterval(reauthInterval);
            reauthInterval = null;
        }
        try{
            reauthInterval = setInterval(function(){
                if (!authenticated){
                    onAuthenticationLost();
                    return;
                }
                gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: true},function(authResult){
                    authenticated = authResult != null && !authResult.error;
                    if (!authenticated){
                        onAuthenticationLost();
                        return;
                    }
                });
            }, GoogleAPIs.getTokenMember("expires_in") * 100);
        } catch(exception) {
            console.error("Exception in GoogleAPIs setupReauth");
            console.error(exception);
            if (reauthInterval != null){
                onAuthenticationLost();
            }
        }
    }

    function onAuthenticate(callback){
        if (gapi.client.drive == null){
            gapi.client.load('drive', 'v2', function(){
                onAuthenticate(callback);
            });
            return;
        }
        if (gapi.client.oauth2 == null){
            gapi.client.load("oauth2", "v2", function(){
                onAuthenticate(callback);
            });
            return;
        }
        if (window.google == null || google.picker == null){
            gapi.load("picker", {callback:function(){
                onAuthenticate(callback);
            }});
            return;
        }
        setupReauth();
        callback(true);
    }

    GoogleAPIs.getTokenMember = function(member) {
        var token = gapi.auth.getToken();
        if (token == null)
            throw new GoogleApiException(GoogleApiException.NO_TOKEN,"Token was null");
        else
            return token[member];

    }

    GoogleAPIs.showFilePicker = function(callback,options){
        this.getUserInfo(function(userInfo){
            var multiSelect = true;
            var query = null;
            if (options != null){
                if (options.multiSelectDisabled != null)
                    multiSelect = options.multiSelect;
                query = options.query;
            }
            var view = new google.picker.View(google.picker.ViewId.DOCS);
            view.setMimeTypes("application/octet-stream");
            if (query != null)
                view.setQuery(query);
            try{
                var picker = new google.picker.PickerBuilder()
                    //.enableFeature(google.picker.Feature.NAV_HIDDEN)
                    .setAppId(clientId)
                    .setDeveloperKey(apiKey)
                    .setAuthUser(userInfo.id)
                    .setOAuthToken(GoogleAPIs.getTokenMember("access_token"))
                    .addView(view)
                    .addView(new google.picker.View(google.picker.ViewId.FOLDERS))
                    .addView(new google.picker.DocsUploadView().setIncludeFolders(true))
                    .setCallback(function(data){
                        if (data.action == google.picker.Action.PICKED)
                            callback(data);
                        else if (data.action == google.picker.Action.CANCEL)
                            callback(null);
                    });
                if (multiSelect)
                    picker.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
                picker = picker.build();
                picker.setVisible(true);
            }
            catch (exception) {
                console.error("Exception in GoogleAPIs.showFilePicker");
                console.error(exception);
                if (exception.isGoogleApiError && exception.type == GoogleApiException.NO_TOKEN){
                    onAuthenticationLost(function(retry){
                        if (retry){
                            GoogleAPIs.showFilePicker(callback,options);
                        }
                        else{
                            callback(null);
                        }

                    });
                }
                else{
                    callback(null);
                }
            }
        });
    }

    GoogleAPIs.getUserInfo = function(callback){
        if (App.googleUserInfo != null){
            callback(App.googleUserInfo);
            return;
        }
        else{
            this.refreshUserInfo(callback);
        }
    }

    GoogleAPIs.getAuthToken = function(){
        var token = gapi.auth.getToken();
        for (var member in token){
            if (typeof token[member] == "object")
                delete token[member];
        }
        return JSON.stringify(token);
    }

    GoogleAPIs.refreshUserInfo = function(callback){
        if (App.googleOffline){
            if (App.googleUserInfo == null){
                App.googleUserInfo = {};
                OfflineUtils.storeGoogleUserInfo();
            }
            this.getUserInfo(callback);
            return;
        }
        var that = this;
        gapi.client.oauth2.userinfo.get().execute(function(result){
            App.googleUserInfo = result;
            if (App.googleUserInfo == null)
                App.googleUserInfo = {};
            OfflineUtils.storeGoogleUserInfo();
            that.getUserInfo(callback);
        });
    }

    GoogleAPIs.uploadBinaryFile = function(filename, contents, callback, progresscallback){
        if (progresscallback == null) progresscallback = function(){};

        //TODO: handle if google is offline gracefully

        var boundary = '-------314159265358979323846';
        var delimiter = "\r\n--" + boundary + "\r\n";
        var close_delim = "\r\n--" + boundary + "--";

        var contentType = 'application/octet-stream';
        var metadata = {
            'title': filename,
            'mimeType': contentType
        };

        var base64Data = App.base64ArrayBuffer(contents);
        var multipartRequestBody =
            delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                base64Data +
                close_delim;

        var request = gapi.client.request({
            'path': '/upload/drive/v2/files',
            'method': 'POST',
            'params': {'uploadType': 'multipart'},
            'headers': {
                'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody});
        request.execute(function(result,rawResponse){
            var response = JSON.parse(rawResponse);
            if (response.gapiRequest != null && response.gapiRequest.data.status == 200){
                fileCache[result.id] = contents;
                fileCacheModifiedDate[result.id] = new Date(result.modifiedDate);
                OfflineUtils.cacheGoogleDriveFile(result.id,contents,new Date(result.modifiedDate),function(success){
                    //should we do something if the local filesystem fails??
                    callback(result.id);
                });
            }
            else{
                console.error("Upload failed trying again in 1 second...");
                console.error(rawResponse);
                setTimeout(function(){
                    GoogleAPIs.uploadBinaryFile(filename,contents,callback,progresscallback);
                },1000);//wait a second and try again
            }
        });
    }

    GoogleAPIs.uploadAllOutOfSyncFiles = function(callback,progresscallback){
        if (progresscallback == null) progresscallback = function(){};
        progresscallback(0,100);
        if (App.googleOffline){
            callback();
            return;
        }
        OfflineUtils.getListOfResyncFiles(function(fileList){
            if (fileList == null){
                callback();
                return;
            }
            function processNext(i){
                function proceed(){
                    progresscallback(i+1,fileList.length);
                    processNext(i+1);
                }
                if (i == fileList.length){
                    callback();
                    return;
                }
                OfflineUtils.getGoogleDriveFileContents(fileList[i],function(data){
                    if (data == null){
                        proceed();
                        return;
                    }
                    GoogleAPIs.updateBinaryFile(fileList[i],data,function(success){
                        if (success){
                            OfflineUtils.unmarkFileNeedResync(fileList[i],function(){
                                proceed();

                            });
                        }
                        else{
                            proceed();
                            processNext(i+1);
                        }

                    },function(current,total){
                        progresscallback(i + current / total,fileList.length);
                    });
                })
            }
            processNext(0);
        })
    }

    GoogleAPIs.updateBinaryFile = function(fileid,contents,callback,progresscallback,failurecount){
        //TODO: we should check if the file has been changed since we last fetched it, if it is we should prompt the user
        if (progresscallback == null) progresscallback = function(){};
        if (failurecount == null) failurecount = 0;

        if (App.googleOffline){//if google is offline then we should just update the local file
            OfflineUtils.cacheGoogleDriveFile(fileid,contents,null,function(success){
                callback(success);
            });
            return;
        }


        var boundary = '-------314159265358979323846';
        var delimiter = "\r\n--" + boundary + "\r\n";
        var close_delim = "\r\n--" + boundary + "--";

        var contentType = 'application/octet-stream';
        var metadata = {
            'mimeType': contentType
        };
        // Updating the metadata is optional and you can instead use the value from drive.files.get.
        var base64Data = App.base64ArrayBuffer(contents);
        var multipartRequestBody =
            delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                base64Data +
                close_delim;

        var request = gapi.client.request({
            'path': '/upload/drive/v2/files/' + fileid,
            'method': 'PUT',
            'params': {'uploadType': 'multipart', 'alt': 'json'},
            'headers': {
                'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody});
        request.execute(function(result,rawResponse){
            var response = JSON.parse(rawResponse);
            if (response.gapiRequest != null && response.gapiRequest.data.status == 200){
                fileCache[result.id] = contents;
                fileCacheModifiedDate[result.id] = new Date(result.modifiedDate);
                OfflineUtils.cacheGoogleDriveFile(fileid,contents,new Date(result.modifiedDate),function(success){
                    //should we do something if the local filesystem fails??
                    callback(true);
                });
            }
            else{
                console.error("Update failed!");
                console.error("Parameters of response");
                console.error(arguments);
                //if we get a 401 response we lost our connection :(
                if (result.error != null && result.error.code == 401) {
                    //here we try to get the user to reauthenticate
                    onAuthenticationLost(function(retry){
                        if (retry) {
                            GoogleAPIs.updateBinaryFile(fileid,contents,callback,progresscallback,0);
                        }
                        else{
                            callback(false);
                        }
                    });
                }
                else if (failurecount > 5) {

                }
                else{
                    var seconds = Math.pow(exponentialBackoffBase,failurecount);
                    console.error("Retrying in " + seconds + " seconds....");
                    setTimeout(function(){
                        GoogleAPIs.updateBinaryFile(fileid,contents,callback,progresscallback,failurecount+1);
                    },seconds * 1000);
                }
            }
        });

    };

    GoogleAPIs.hasFileInMemoryCache = function(fileid){
        return fileCache[fileid] != null;
    };

    GoogleAPIs.getFile = function(fileid,callback,progresscallback,failurecount){
        if (progresscallback == null) progresscallback = function(){};
        if (failurecount == null) failurecount = 0;
        progresscallback(0,100);



        if (fileCache[fileid] != null){
            OfflineUtils.googleDriveFileExists(fileid,function(exists){
                if (!exists){
                    OfflineUtils.cacheGoogleDriveFile(fileid,fileCache[fileid],fileCacheModifiedDate[fileid],function(success){
                        callback(fileCache[fileid]);
                    });
                }
                else{
                    callback(fileCache[fileid]);
                }
            });
            return;
        }

        if (App.googleOffline){//if google is offline our only hope is to get the file from the offline cache
            OfflineUtils.getGoogleDriveFileContents(fileid,function(data){
                if (data != null)
                    fileCache[fileid] = data;
                callback(data);
            });
            return;
        }

        gapi.client.drive.files.get({fileId:fileid,updateViewedDate:true}).execute(function(driveMetadata){
            if (driveMetadata.error == null) {
                OfflineUtils.getGoogleDriveFileMetadata(fileid,function(metadata){
                    if (metadata == null || metadata.contentsModifiedDate.getTime() < new Date(driveMetadata.modifiedDate).getTime()){
                        try{
                            App.downloadBinaryFile(driveMetadata.downloadUrl,{
                                accessToken: GoogleAPIs.getTokenMember("access_token"),
                                success: function(data){
                                    fileCache[fileid] = data;
                                    fileCacheModifiedDate[fileid] = new Date(driveMetadata.modifiedDate);
                                    OfflineUtils.cacheGoogleDriveFile(fileid,data,new Date(driveMetadata.modifiedDate),function(){
                                        callback(data);
                                    });
                                },
                                error: function(){
                                    console.error("error happened!");
                                    callback(null);
                                },
                                onProgress:function(event){
                                    progresscallback(event.loaded,event.total);
                                }
                            });
                        }
                        catch (exception) {
                            console.error("Exception in GoogleAPIs.getFile");
                            console.error(exception);
                            if (exception.isGoogleApiError && exception.type == GoogleApiException.NO_TOKEN){
                                onAuthenticationLost(function(retry){
                                    if (retry){
                                        GoogleAPIs.getFile(fileid,callback,progresscallback,0);
                                    }
                                    else{
                                        callback(null);
                                    }
                                });
                            }
                            else{
                                callback(null);
                            }


                        }
                    }
                    else{
                        OfflineUtils.getGoogleDriveFileContents(fileid,function(data){
                            if (data != null){
                                fileCache[fileid] = data;
                                fileCacheModifiedDate[fileid] = metadata.contentsModifiedDate;
                            }
                            callback(data);
                        });
                    }
                });
            }
            else {
                console.error("Failed to get file");
                console.error(driveMetadata);
                if (driveMetadata.error.code == 401) { //need reauth
                    onAuthenticationLost(function(retry){
                        if (retry) {
                            GoogleAPIs.getFile(fileid,callback,progresscallback,0);
                        }
                        else{
                            callback(null);
                        }
                    })
                }
                else if (failurecount > 5) {
                    console.error("Failed 5 times. Giving up :(");
                    callback(null);
                }
                else {
                    var seconds = Math.pow(exponentialBackoffBase,failurecount);
                    console.error("Retrying in " + seconds + " seconds....");
                    setTimeout(function(){
                        GoogleAPIs.getFile(fileid,callback,progresscallback,failurecount+1);
                    }, seconds * 1000);
                }
            }
        });
    };

    return GoogleAPIs;
});