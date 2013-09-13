define(function(){
    var Module = {};

    var container;

    Module.init = function(c){
        App.davis.get("/home",function(req){
            App.setActiveModule("home");
            document.title = "Googulator";
        });
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/home")
            Davis.location.assign("/home");
    }

    Module.onFreeze = function(){

    }

    Module.onAuthenticated = function(){
    }

    return Module;
})