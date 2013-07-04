define([],function(){
    var utils = {};


    utils.makeUntypedArrayCopy = function(array){
        var newArray = new Array(array.length);
        for (var i = 0, li = array.length; i < li; i++){
            if (typeof array[i] === "object" && array[i] != null)
                newArray[i] = this.makeUntypedArrayCopy(array[i]);
            else
                newArray[i] = array[i];
        }
        return newArray;
    }

    utils.copy = function(from,to){
        for (var i = 0, li = from.length; i < li; i++){
            if (typeof from[i] === "object" && from[i] != null){
                if (to[i] == null)
                    to[i] = [];
                this.copy(from[i],to[i]);
            }
            else
                to[i] = from[i];
        }
    }

    return utils;
});