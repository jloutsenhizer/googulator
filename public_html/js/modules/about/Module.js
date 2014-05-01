define(function(){
    "use strict";

    var Module = {};

    var container;

    Module.init = function(c){
        App.davis.get("/help",function(req){
            App.setActiveModule("help");
            document.title = "Googulator - Help";
        });
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/help")
            Davis.location.assign("/help");
    }

    Module.onFreeze = function(){

    }

    Module.onAuthenticated = function(){
    }

    return Module;
})