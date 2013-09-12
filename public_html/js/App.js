define(["GoogleAPIs"],function(GoogleAPIs){
    var App = {};

    var compiledTemplates = {};

    var driveOverlay;

    var overlayTemplate = null;

    App.davis = Davis();
    App.davis.get("/test",function(req){
        console.log("route!");
        console.log(req);
    });
    App.davis.start();

    var totalModules = 0;
    var loadedModules = 0;



    App.initialize = function(){
        App.loadMustacheTemplate("globalTemplates.html","greyMessageOverlay",function(template){
            overlayTemplate = template;
            if (driveState != null)
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
                        $("ul.nav").append($("<li id='webstoreinstallparent'><a href='#' id='webstoreinstalllink'>Add to Chrome</a></li>"));
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

            function setActiveModule(){
                if (loadedModules < totalModules){
                    setTimeout(setActiveModule,10);
                    return;
                }
                if (App.davis.lookupRoute("get",Davis.location.current()) != null)
                    Davis.location.assign(Davis.location.current());
                else
                    Davis.location.assign("/home");

            }
            setActiveModule();

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

        $("#coreModuleContainer .moduleContainer").addClass("hidden");
        if (activeModule != null){
            activeModule.onFreeze();
        }

        if (!params.initOnly){
            var navitems = $("ul.nav li");
            for (var i = 0; i < navitems.length; i++){
                var li = $(navitems[i]);
                var link = $(li.children("a")[0]);
                li.removeClass("active");
                if (link.attr("modulename") == modulename)
                    li.addClass("active");
            }
        }

        require(["modules/" + modulename + "/Module"],function(Module){
            modules[modulename] = Module;
            App.loadMustacheTemplate("modules/" + modulename + "/template.html","mainDisplay",function(template){

                var container = $("#coreModuleContainer #moduleContainer" + modulename);
                if (container.length == 0){
                    container = $("<div class='moduleContainer hidden' id='moduleContainer" + modulename + "'></div>");
                    $("#coreModuleContainer").append(container);
                    container.append(template.render());
                    Module.init(container);
                }
                else if (params.initOnly){
                    Module.init(container);
                    loadedModules++;
                }
                if (!params.initOnly){
                    activeModule = Module;
                    activeModuleName = modulename;
                    container.removeClass("hidden");
                    activeModule.onActivate(params);
                }
            });
        });
    }

    function onAuthenticated(){
        GoogleAPIs.getUserInfo(function(userInfo){
            $("#googleUserInfo").html("");
            $("#googleUserInfo").append($("<div class= 'center'><img style='height:32px' src='" + (userInfo.picture ? userInfo.picture : "img/genericPicture.png") + "'</img> Welcome " + (userInfo.name ? userInfo.name : "Stranger") + "</div>"));
            for (var modulename in modules){
                modules[modulename].onAuthenticated();
            }
            if (driveState != null){
                App.setActiveModule("library",{driveState:driveState,driveOverlay:driveOverlay});
                driveOverlay = null;
                driveState = null;
                delete driveState;
            }
        });
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
            App.makeModal(template.render({title:title,message:text})).on("hidden",function(){
                closeCallback();
            });
        });
    }

    App.showModalConfirmation = function(title,text,closeCallback){
        if (closeCallback == null) closeCallback = function(){};
        App.loadMustacheTemplate("dialogTemplates.html","GenericConfirmationModal",function(template){
            var dialog = App.makeModal(template.render({title:title,message:text}));
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
            location.reload();
        }
    }

    return App;
});