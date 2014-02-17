define(["GoogleAPIs","MetadataManager","OfflineUtils"],function(GoogleAPIs,MetadataManager,OfflineUtils){
    var App = {};

    var compiledTemplates = {};

    var driveOverlay;

    var overlayTemplate = null;

    App.davis = Davis();
    App.davis.use(Davis.googleAnalytics);
    App.davis.start();

    App.userRoles = [];
    App.userInfo = null;
    App.googleUserInfo = null;

    App.metadataManager = MetadataManager;

    App.websiteBrokenMode = false;
    App.googulatorOffline = false;
    App.googleOffline = false;

    var totalModules = 0;
    var loadedModules = 0;

    var additionalRoleMapping = {
        "ROLE_ADMIN": ["ROLE_PRO"]
    }

    App.userHasRole = function(role){
        for (var i = 0, li = App.userInfo.roles.length; i < li; i++){
            if (App.userInfo.roles[i] == role)
                return true;
            var mapping = additionalRoleMapping[App.userInfo.roles[i]];
            if (mapping != null && mapping.indexOf(role) >= 0)
                return true;
        }
        return false;
    }

    function setupIntialActiveModule(){
        if (App.davis.lookupRoute("get",Davis.location.current().split("?")[0]) != null)
            Davis.location.assign(Davis.location.current().split("?")[0]);
        else
            Davis.location.assign("/home");

    }

    App.twitchLogin = function(){
        if (!App.twitchReady)
            return;
        Twitch.login({
            redirect_uri: "http://localhost:8081/settings",
            scope: ['chat_login',"user_read"]
        });

    }



    App.initialize = function(){
        Twitch.init({clientId: configuration.twitch.clientId}, function(error, status) {
            App.twitchReady = true;
            if (status.authenticated){
                App.twitchAccessToken = status.token;
            }
            console.log(arguments);
        });
        App.loadMustacheTemplate("globalTemplates.html","greyMessageOverlay",function(template){
            overlayTemplate = template;
            OfflineUtils.initialize(function(){
                if (getParams.unsubscribe != null){
                    App.showModalConfirmation("Unsubscribe from Googulator Updates","Are you sure you no longer want to receive emails about Googulator updates?",function(result){
                        if (result){
                            $.ajax("/php/unsubscribeFromUpdates.php?address=" + encodeURIComponent(getParams.unsubscribe),{
                                success:function(result){
                                    if (result.result == "success"){
                                        App.showModalMessage("Email Updates Unsubscribed","You will no longer get emails about Googulator updates!");
                                    }
                                    else{
                                        App.showModalMessage("An Error Occurred","We were unable to remove your email address from the email list!");
                                    }

                                },
                                error:function(){
                                    App.showModalMessage("An Error Occurred","We were unable to remove your email address from the email list!");
                                }
                            })
                        }
                    });
                }
                if (getParams.state != null)
                    driveOverlay = App.createMessageOverlay($("body"),"Loading your file...");
                $(document).on("click","a",function(event){
                    var moduleName = event.target.getAttribute("modulename");
                    if (moduleName == null){
                        return true;
                    }
                    App.setActiveModule(moduleName,{});
                    return false;
                });

                var navItems = $("ul.nav li a");

                $.each(navItems,function(index,item){
                    if ($(item).attr("modulename") != null){
                        totalModules++;
                        App.setActiveModule($(item).attr("modulename"),{initOnly:true});
                    }
                });

                if (!navigator.cookieEnabled){
                    App.showModalMessage("Cookies are Required!","Due to issues with google's picker api, games cannot be added to your library with cookies disabled. Hopefully google will fix these issues or we'll come up with a work around, but unfortunately for the time being you need to enable cookies for the app to function correctly. Sorry to be a nuisance!");
                }

                GoogleAPIs.checkAuthentication(function(authenticated){
                    if (!authenticated){
                        $("#loadText").addClass("hidden");
                        $("#loadButton").removeClass("hidden");
                        $("#loadButton").click(function(){
                            if (GoogleAPIs.authenticate(function(auth){
                                if (auth){
                                    onAuthenticated();
                                }
                                else{
                                    $("#loadText").addClass("hidden");
                                    $("#loadButton").removeClass("hidden");
                                }
                            })){
                                $("#loadButton").addClass("hidden");
                                $("#loadText").removeClass("hidden");
                            }
                        });
                    }
                    else{
                        onAuthenticated();
                    }
                });

                if (typeof chrome != "undefined"){
                    if (chrome.app != null && chrome.app.getIsInstalled != null && chrome.webstore != null && chrome.webstore.install != null){
                        if (!chrome.app.getIsInstalled()){
                            $("ul.nav").append($("<li id='webstoreinstallparent'><a href='javascript:void(0);' id='webstoreinstalllink'>Add to Chrome</a></li>"));
                            $("#webstoreinstalllink").click(function(){
                                event.preventDefault();
                                chrome.webstore.install($("link[rel='chrome-webstore-item']").attr("href"),function(){
                                    $("#webstoreinstallparent").remove();
                                },function(){
                                });
                            });
                        }
                    }
                }
            });
        });
    };

    var activeModuleName = null;
    var activeModule = null;
    var modules = {};

    App.setActiveModule = function(modulename,params){
        if (params == null) params = {initOnly: false};
        if (params.initOnly == null) params.initOnly = false;

        if (activeModuleName == modulename)
            return;



        if (!params.initOnly){
            if (activeModule != null){
                $("#coreModuleContainer #moduleContainer" + activeModuleName).addClass("unactive");
                activeModule.onFreeze();
            }
            var navitems = $("ul.nav li");
            for (var i = 0; i < navitems.length; i++){
                var li = $(navitems[i]);
                var link = $(li.children("a")[0]);
                li.removeClass("active");
                if (link.attr("modulename") == modulename)
                    li.addClass("active");
            }
        }

        function finishSettingModule(Module){
            modules[modulename] = Module;
            App.loadMustacheTemplate("modules/" + modulename + "/template.html","mainDisplay",function(template){

                var container = $("#coreModuleContainer #moduleContainer" + modulename);
                if (container.length == 0){
                    container = $("<div class='moduleContainer unactive' id='moduleContainer" + modulename + "'></div>");
                    $("#coreModuleContainer").append(container);
                    container.append(template.render());
                    Module.init(container);
                }
                else if (params.initOnly){
                    Module.init(container);
                    if (++loadedModules == totalModules)
                        setupIntialActiveModule();
                }
                if (!params.initOnly){
                    activeModule = Module;
                    activeModuleName = modulename;
                    container.removeClass("unactive");
                    activeModule.onActivate(params);
                }
            });

        }
        if (modules[modulename] != null)
            finishSettingModule(modules[modulename]);
        else
            require(["modules/" + modulename + "/Module"],finishSettingModule);
    }

    function onAuthenticated(){
        function afterEverything(){
            if (App.userHasRole("ROLE_PRO")){
                $(".adUnit").remove();
                $(".moduleTabgoPro").remove();
            }
            if (App.userHasRole("ROLE_ADMIN")){
                $(".moduleTabadmin").removeClass("hidden");
            }
            else{
                $(".moduleTabadmin").remove();
            }
            GoogleAPIs.getUserInfo(function(userInfo){
                $("#googleUserInfo").html("");
                $("#googleUserInfo").append($("<div class= 'center' style='margin-top:0.25em'><img style='height:32px' onerror='this.src = \"/img/genericProfilePicture.png\"' src='" + (userInfo.picture ? userInfo.picture : "/img/genericProfilePicture.png") + "'></img> Welcome " + (userInfo.name ? userInfo.name : "Stranger") + "</div>"));
                if (!App.websiteBrokenMode){
                    App.metadataManager.loadMetadata(function(){
                        for (var modulename in modules){
                            modules[modulename].onAuthenticated();
                        }
                        if (getParams.state != null){
                            App.setActiveModule("library",{driveState:JSON.parse(getParams.state),driveOverlay:driveOverlay});
                            driveOverlay = null;
                        }

                    });
                }
                else{
                    for (var modulename in modules){
                        modules[modulename].onAuthenticated();
                    }
                }
            });
        }

        function onDone(){
            App.websiteBrokenMode = App.userInfo.websiteState == "broken";
            if (App.websiteBrokenMode){
                App.showModalMessage("The Website is Currently Broken","We apologize for the inconvenience. Check back later. If the problem has been persisting please email our administrative staff: " + window.supportEmailAddress + ". We will now attempt to switch to offline mode.",function(){
                    if (OfflineUtils.enableGoogulatorOffline()){
                        App.showModalMessage("Offline Mode Enabled","You are now in offline mode!");
                        App.websiteBrokenMode = false;
                    }
                    afterEverything();
                });

            }
            else{
                OfflineUtils.storeUserInfo();
                afterEverything();
            }

        }
        function afterResync(){
            if (!App.googulatorOffline){
                $.ajax("/php/getUserData.php?googletoken=" + GoogleAPIs.getAuthToken(),{
                    success: function(result){
                        App.userInfo = result;
                        onDone()
                    },
                    error: function(){
                        App.userInfo = {websiteState: "broken", roles:["ROLE_USER"]};
                        onDone();
                    }
                });
            }
            else{//googulator is offline so we have to depend on the cache
                onDone();
            }
        }
        if (!App.googleOffline){
            var overlay = App.createMessageOverlay($("body"),$("<div>Syncing changes made offline to Google Drive...</div><div class='pbar'></div>"));
            GoogleAPIs.uploadAllOutOfSyncFiles(function(){
                overlay.remove();
                afterResync();
            },function(done,total){
                overlay.find(".pbar").progressbar({value:done / total * 100});
            })
        }
        else{
            afterResync();
        }

    }

    App.loadMustacheTemplate = function(templatePath,templateId,onLoad){
        App.loadAllMustacheTemplates(templatePath,function(templates){
            onLoad(templates[templateId]);
        });
    };

    var templateRegexp = new RegExp("<template id=\"[A-z0-9\\-.]*\">","ig");

    App.loadAllMustacheTemplates = function(templatePath,onLoad){
        if (compiledTemplates[templatePath] != null){
            onLoad(compiledTemplates[templatePath]);
            return;
        }
        require(["text!" + templatePath], function(template){
            var templateData = {};
            var matches = template.match(templateRegexp);
            for (var i = 0; i < matches.length; i++){
                var curMatch = matches[i];
                var templateName = curMatch.substring(14,curMatch.length - 2);
                var start = template.indexOf(curMatch) + curMatch.length;
                var end = template.indexOf("</template>",start);
                var html = template.substring(start,end).trim();
                templateData[templateName] = Hogan.compile(html);
            }
            compiledTemplates[templatePath] = templateData;
            onLoad(compiledTemplates[templatePath]);
        });
    };

    App.makeModal = function(html) {
        var dialog = $(html);
        dialog.addClass("modal");
        dialog.addClass("hide");
        $("body").append(dialog);
        dialog.modal();
        dialog.on("hidden",function(){
            dialog.remove();
        });
        var backdrops = $(".modal-backdrop");
        if (backdrops.length > 1){
            var zIndex = $(backdrops[backdrops.length - 2]).css("zIndex");
            zIndex++;
            zIndex += 19;
            $(backdrops[backdrops.length - 1]).css("zIndex",zIndex);
            zIndex++;
            dialog.css("zIndex",zIndex);

        }
        return dialog;
    };

    App.showModalMessage = function(title,text,closeCallback){
        if (closeCallback == null) closeCallback = function(){};
        App.loadMustacheTemplate("dialogTemplates.html","GenericMessageModal",function(template){

            var dialog = App.makeModal(template.render({title:title,message:text}))
            dialog.find(".modal-body").html(dialog.find(".modal-body").html().replace(/\n/g,"<br>"));
            dialog.on("hidden",function(){
                closeCallback();
            });
        });
    }

    App.showModalConfirmation = function(title,text,closeCallback){
        if (closeCallback == null) closeCallback = function(){};
        App.loadMustacheTemplate("dialogTemplates.html","GenericConfirmationModal",function(template){
            var dialog = App.makeModal(template.render({title:title,message:text}));
            dialog.find(".modal-body").html(dialog.find(".modal-body").html().replace(/\n/g,"<br>"));
            dialog.find(".yesBtn").click(function(){
                closeCallback(true);
                closeCallback = function(){};
                dialog.modal("hide");
            });
            dialog.find(".noBtn").click(function(){
                closeCallback(false);
                closeCallback = function(){};
                dialog.modal("hide");
            });
            dialog.on("hidden",function(){
                closeCallback(false);
            });
        });
    }

    App.downloadBinaryFile = function(url,params){
        var xhr = new XMLHttpRequest();

        if (params.onProgress != null){
            xhr.onprogress = params.onProgress;
            params.onProgress({loaded:0,total:100});
        }

        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';

        if (params.accessToken != null){
            xhr.setRequestHeader("Authorization", "Bearer " + params.accessToken);
        }

        xhr.onload = function(e) {
            if (this.status == 200) {
                params.success(new Uint8Array(this.response));
            }
            else{
                params.error();
            }
        };

        xhr.send();
    }

    App.base64ArrayBuffer = function(arrayBuffer){
        var base64 = "";
        var encoding = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

        var bytes = new Uint8Array(arrayBuffer);
        var leftOvers = bytes.length % 3;



        for (var i = 0; i < bytes.length - 2; i += 3){
            base64 += encoding.charAt((bytes[i] >> 2) & 63);
            base64 += encoding.charAt((((bytes[i]) & 3) << 4) | ((bytes[i+1] >> 4) & 15));
            base64 += encoding.charAt((((bytes[i+1]) & 15) << 2) | ((bytes[i+2] >> 6) & 3));
            base64 += encoding.charAt(bytes[i+2] & 63);
        }
        switch (leftOvers){
            case 1:
                base64 += encoding.charAt((bytes[bytes.length-1] >> 2) & 63);
                base64 += encoding.charAt((bytes[bytes.length-1] & 3) << 4);
                base64 += "==";
                break;
            case 2:
                base64 += encoding.charAt((bytes[bytes.length-2] >> 2) & 63);
                base64 += encoding.charAt((((bytes[bytes.length-2]) & 3) << 4) | ((bytes[bytes.length-1] >> 4) & 15));
                base64 += encoding.charAt((((bytes[bytes.length-1]) & 15) << 2));
                base64 += "=";
                break;
        }
        return base64;
    }

    App.stringToArrayBuffer = function(str){
        var buf = new Uint8Array(str.length);
        for (var i=0, strLen=str.length; i<strLen; i++) {
            buf[i] = str.charCodeAt(i);
        }
        return buf;
    }

    App.stringFromArrayBuffer = function(buf){
        var data = new Uint8Array(buf);
        var result = "";
        for (var i = 0, li = data.length; i < li; i++){
            result += String.fromCharCode(data[i]);
        }
        return result;
    }

    App.createMessageOverlay = function(parent,content){
        if (overlayTemplate == null){
            return null;
        }
        var creation = $(overlayTemplate.render({content: typeof content === "string" ? content : ""}));
        if (typeof content !== "string"){
            creation.find(".messageOverlay").append(content);
        }
        parent.append(creation);
        return creation;
    }

    App.constants = {};

    window.App = App;

    var cacheOverlay = null;

    App.refreshPage = function(){
        location.assign(location.href + getHTTPGetAppendage());
    }

    function getHTTPGetAppendage(){
        var string = "";
        var first = true;
        for (var object in getParams){
            if (first){
                string += "?";
                first = false;
            }
            else{
                string += "&";
            }
            string += encodeURIComponent(object) + "=" + encodeURIComponent(getParams[object]);
        }
        return string;
    }

    App.handleCacheEvent = function(event){
        if (event.type != "noupdate" && cacheOverlay == null){
            cacheOverlay = App.createMessageOverlay($("body"),$("<div class='messageC'></div><div class='pbar'></div>"));
        }
        if (cacheOverlay != null){
            switch (event.type){
                case "checking":
                    cacheOverlay.find(".messageC").text("Checking for updates...");
                    break;
                case "downloading":
                    cacheOverlay.find(".messageC").text("Downloading updates...");
                    cacheOverlay.find(".pbar").progressbar(0);
                    break;
                case "progress":
                    cacheOverlay.find(".messageC").text("Downloading updates...");
                    cacheOverlay.find(".pbar").progressbar({value: event.loaded / event.total * 100});
                    break;
                case "cached":
                case "error":
                case "noupdate":
                    cacheOverlay.remove();
                    break;
            }
        }
        if (event.type == "updateready" || event.type == "obsolete"){
            App.refreshPage();
        }
    }

    return App;
});