(function(){
    var extensionID = "ppiglcdmigpbibdfbldkjpgbggfnmppc";

    var extensionConnectionPort = chrome.runtime.connect(extensionID,{name:"twitchPlaysPluginConnection"});

    var portReady = false;

    var curId = 1;

    var callbackMap = {};
    var ircInstanceMap = {};
    var ircIDMap = {};

    extensionConnectionPort.onMessage.addListener(function(msg) {
        if (!msg.event){
            if (msg.id == 0){
                portReady = true;
                //expose the api
                window.irc = irc;
                if (window.onIRCReady != null){
                    window.onIRCReady();
                }
            }
            else{
                try{
                    ircInstanceMap[msg.id].ircID = msg.ircID;
                    ircIDMap[msg.ircID] = ircInstanceMap[msg.id];
                    callbackMap[msg.id].apply(ircInstanceMap[msg.id],objectToArray(msg.callbackParams));
                }
                catch (e){console.error(e)}
                delete callbackMap[msg.id];
                delete ircInstanceMap[msg.id];
            }
        }
        else{//if it's not a response then it's an event
            try{
                ircIDMap[msg.ircID].onIRCMessage(msg.message);
            } catch (e){console.error(e);}
        }
    });
    extensionConnectionPort.onDisconnect.addListener(function(msg){
        console.error("argh disconnected");
    })

    var irc = function(server,port,nickname,password,callback){
        if (callback == null) callback = function(){};
        callbackMap[curId] = callback;
        ircInstanceMap[curId] = this;
        this.onIRCMessage = function(){};
        extensionConnectionPort.postMessage({
            id: curId++,
            function: "createIRC",
            server: server,
            port: port,
            nickname: nickname,
            password: password
        })
    };

    irc.prototype.joinChannel = function(channelName,callback){
        if (callback == null) callback = function(){};
        callbackMap[curId] = callback;
        ircInstanceMap[curId] = this;
        extensionConnectionPort.postMessage({
            id: curId++,
            ircID: this.ircID,
            function: "joinChannel",
            channelName: channelName
        });
    }

    irc.prototype.leaveChannel = function(channelName,callback){
        if (callback == null) callback = function(){};
        callbackMap[curId] = callback;
        ircInstanceMap[curId] = this;
        extensionConnectionPort.postMessage({
            id: curId++,
            ircID: this.ircID,
            function: "leaveChannel",
            channelName: channelName
        });
    }

    function objectToArray(obj){
        var arr = [];
        for (member in obj){
            arr[parseInt(member)] = obj[member];
        }
        return arr;
    }

})();