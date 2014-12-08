(function(){

    var PushBullet = {};

    PushBullet.init = function(clientId, redirectUri){
        this.clientId = clientId;
        this.redirectUri = redirectUri;
        this.accessToken = localStorage.pushBulletAccessToken;
    };

    //tests if we are authorized
    PushBullet.checkAuth = function(callback){
        request("https://api.pushbullet.com/v2/users/me",true,function(results){
            callback(results != null);
        });
    };

    //attempts to obtain a working accessToken, once Obtained it callsback with true
    PushBullet.doAuth = function(callback){
        var popup = window.open("https://www.pushbullet.com/authorize?client_id=" + encodeURIComponent(PushBullet.clientId) + "&redirect_uri=" + encodeURIComponent(this.redirectUri) + "&response_type=token",
                                "_blank","height=600,width=500,left=" + Math.round($(document).width() / 2 - 250) + ",top=" + Math.round($(document).height() / 2 - 300));

        function onClosed(){
            PushBullet.accessToken = localStorage.pushBulletAccessToken;
            PushBullet.checkAuth(callback);
        }

        var popupInterval = setInterval(function(){
            if (popup == null || popup.closed){
                clearInterval(popupInterval);
                onClosed();
            }
        },50);
    };

    PushBullet.Note = function(title, body){
        this.type = "note";
        this.title = title;
        this.body = body;
    };

    PushBullet.Link = function(title,body,url){
        this.type = "link";
        this.title = title;
        this.body = body;
        this.url = url;
    };

    PushBullet.CheckList = function(title,items){
        this.type = "list";
        this.title = title;
        this.items = items;
    }


    PushBullet.pushToChannel = function (channelName,pushBulletMessage){
        var params = {
            channel_tag: channelName
        };
        for (var param in pushBulletMessage){
            params[param] = pushBulletMessage[param];
        }
        post("https://api.pushbullet.com/v2/pushes",true,params,function(results){
            console.log(results);
        });
    }

    function request(url, useAuth,callback){
        var options = {};
        if (useAuth && PushBullet.accessToken != null){
            options.headers = {
                'Authorization': 'Bearer ' + PushBullet.accessToken
            };
        }

        options.success = function(response){
            callback(response);
        };
        options.error = function(){
            callback(null);
        }

        $.ajax(url,options);
    }

    function post(url,useAuth,params,callback){
        var options = {};
        if (useAuth && PushBullet.accessToken != null){
            options.headers = {
                'Authorization': 'Bearer ' + PushBullet.accessToken
            };
        }
        options.type = "POST";
        options.data = params;


        options.success = function(response){
            callback(response);
        };
        options.error = function(){
            callback(null);
        }

        $.ajax(url,options);

    }

    window.PushBullet = PushBullet;

})();