define(function(){
    "use strict";

    var Module = {};

    var container;

    Module.init = function(c){
        App.davis.get("/about",function(req){
            App.setActiveModule("about");
            document.title = "Googulator - About";
        });
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/about")
            Davis.location.assign("/about");
    }

    Module.onFreeze = function(){

    }

    Module.onAuthenticated = function(){
    }

    return Module;
})