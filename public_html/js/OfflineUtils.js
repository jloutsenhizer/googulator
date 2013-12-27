define(function(){
    var OfflineUtils = {};

    //persists user info from googulator server into the offline cache
    OfflineUtils.storeUserInfo = function(){
        localStorage.userInfo = JSON.stringify(App.userInfo);
    }

    //attempts to enable googulator offline mode
    OfflineUtils.enableGoogulatorOffline = function(){
        try{
            if (localStorage.userInfo != null){
                var info = JSON.parse(localStorage.userInfo);
                if (info.metadataFileId != null && info.googleid != null){
                    App.userInfo = info;
                    App.googulatorOffline = true;
                    return true;
                }

            }
        }
        catch (e){}
        return false;
    }

    return OfflineUtils;

});