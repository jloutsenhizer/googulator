define(["FreeGameLibrary"],function(FreeGameLibrary){
    var FreeROMPicker = {};

    FreeROMPicker.show = function(callback){
        FreeGameLibrary.getLibrary(function(library){
            loadPicker(library,callback);
        });
    }

    function loadPicker(data,callback){
        App.loadMustacheTemplate("dialogTemplates.html","FreeRomPicker",function(template){
            var dialog = App.makeModal(template.render({
                games: data
            }));
            var gamePicked = false;
            $(".loadfreegamelink").click(function(event){
                gamePicked = true;
                dialog.modal("hide");
                var id = event.delegateTarget.getAttribute("gameid");
                var game = null;
                for (var i = 0; i < data.length; i++){
                    if (data[i].id == id){
                        game = data[i];
                        break;
                    }
                }
                callback(game);
                return false;
            });
            dialog.on("hidden",function(){
                if (!gamePicked)
                    callback(null);
            })
        });
    }

    return FreeROMPicker;
});