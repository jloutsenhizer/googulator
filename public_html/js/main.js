
(function(){
    "use strict";

    function googleAPILoaded(){
        delete window.googleAPILoaded;
        $(document).ready(function(){
            require(["App"],function(App){
                App.initialize();
                while (eventBacklog.length > 0){
                    App.handleCacheEvent(eventBacklog.shift());
                }
            });
        })

    }

    window.googleAPILoaded = googleAPILoaded;

    var eventBacklog = [];

    function handleCacheEvent(event){
        if (window.App != null){
            while (eventBacklog.length > 0){
                App.handleCacheEvent(eventBacklog.shift());
            }
            App.handleCacheEvent(event);
        }
        else{
            eventBacklog.push(event);
        }
    }

    // Fired after the first cache of the manifest.
    window.applicationCache.addEventListener('cached', handleCacheEvent, false);

    // Checking for an update. Always the first event fired in the sequence.
    window.applicationCache.addEventListener('checking', handleCacheEvent, false);

    // An update was found. The browser is fetching resources.
    window.applicationCache.addEventListener('downloading', handleCacheEvent, false);

    // The manifest returns 404 or 410, the download failed,
    // or the manifest changed while the download was in progress.
    window.applicationCache.addEventListener('error', handleCacheEvent, false);

    // Fired after the first download of the manifest.
    window.applicationCache.addEventListener('noupdate', handleCacheEvent, false);

    // Fired if the manifest file returns a 404 or 410.
    // This results in the application cache being deleted.
    window.applicationCache.addEventListener('obsolete', handleCacheEvent, false);

    // Fired for each resource listed in the manifest as it is being fetched.
    window.applicationCache.addEventListener('progress', handleCacheEvent, false);

    // Fired when the manifest resources have been newly redownloaded.
    window.applicationCache.addEventListener('updateready', handleCacheEvent, false);





    //append an uncachable request for the script
    var gapiScript = document.createElement("script");
    gapiScript.type = "text/javascript";
    gapiScript.src = "https://apis.google.com/js/client.js?onload=googleAPILoaded&t=" + new Date().getTime();
    gapiScript.onerror = function(){
        console.error("error loading gapi");
        window.gapi = null;
        try{
            googleAPILoaded();
        }
        catch(e){}
    }
    document.getElementsByTagName("head")[0].appendChild(gapiScript);

    if (false){ //set to true to agressively load all the modules
        require ([
            "modules/play/Module",
            "text!modules/play/template.html",
            "modules/home/Module",
            "text!modules/home/template.html",
            "modules/library/Module",
            "text!modules/library/template.html",
            "modules/settings/Module",
            "text!modules/settings/template.html",
            "modules/goPro/Module",
            "text!modules/goPro/template.html",
            "FreeROMPicker",
            "text!dialogTemplates.html",
            "text!globalTemplates.html",
            "html5apps/HTML5_TICTACTOE/App",
            "modules/admin/Module",
            "text!modules/admin/template.html",
            "modules/help/Module",
            "text!modules/help/template.html",

        ]);
    }

})();