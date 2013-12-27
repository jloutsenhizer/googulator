define(function(){
    var OfflineUtils = {};

    //TODO: Offline utils needs a way to get an offline filesystem for caching drive files

    //persists user info from googulator server into the offline cache
    //TODO: determine scheme to be able to sync local user info changes (really only needed if metadata file changed)
    OfflineUtils.storeUserInfo = function(){
        localStorage.userInfo = JSON.stringify(App.userInfo);
    }

    //persist google user info
    OfflineUtils.storeGoogleUserInfo = function(){
        localStorage.googleUserInfo = JSON.stringify(App.googleUserInfo);
    }

    //attempts to enable googulator offline mode
    OfflineUtils.enableGoogulatorOffline = function(){
        if (App.googulatorOffline)
            return true;
        try{
            if (App.userInfo == null){
                if (localStorage.userInfo != null){
                    var info = JSON.parse(localStorage.userInfo);
                    if (info.metadataFileId != null && info.googleid != null){
                        App.userInfo = info;
                        App.googulatorOffline = true;
                        return true;
                    }

                }
            }
            else{
                App.googulatorOffline = true;
                return true;
            }

        }
        catch (e){}
        return false;
    }

    //attempts to enable google offline mode
    OfflineUtils.enableGoogleOffline = function(){
        if (App.googleOffline)
            return true;
        try{
            if (OfflineUtils.enableGoogulatorOffline()){
                App.googleOffline = true;//if we don't have google user info (that's really unlikely!) we can still operate
                if (App.googleUserInfo == null){
                    try{
                        if (localStorage.googleUserInfo != null){
                            var info =  JSON.parse(localStorage.googleUserInfo);
                            App.googleUserInfo = info;
                        }
                    }
                    catch (e){}
                }
                if (App.googleUserInfo == null)
                    App.googleUserInfo = {};
                return true;
            }
        }
        catch (e){}
        return false;
    }

    return OfflineUtils;

});