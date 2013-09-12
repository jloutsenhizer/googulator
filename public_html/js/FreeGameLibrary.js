define(function(){
    var FreeGameLibrary = {};

    var library = null;

    FreeGameLibrary.getLibrary = function(callback){
        if (library != null){
            callback(library);
        }
        else{
            this.refreshLibrary(callback);
        }
    }

    FreeGameLibrary.refreshLibrary = function(callback){
        var that = this;
        $.ajax("/php/listFree.php",{
            success: function(data){
                library = data;
                that.getLibrary(callback);
            },
            error: function(){
                callback(library);
            }
        });
    }

    return FreeGameLibrary;
});