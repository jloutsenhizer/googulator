define(["OfflineUtils","GoogleAPIs"],function(OfflineUtils,GoogleAPIs){
    "use strict";

    var Module = {};

    App.constants.TYPE_KEYBOARD = 0;
    App.constants.TYPE_ICADE = 1;
    App.constants.TYPE_GAMEPAD = 2;
    App.constants.TYPE_TWITCH = 3;
    App.constants.BUTTON_INVALID = -1;
    App.constants.BUTTON_A = 0;
    App.constants.BUTTON_B = 1;
    App.constants.BUTTON_START = 2;
    App.constants.BUTTON_SELECT = 3;
    App.constants.BUTTON_UP = 4;
    App.constants.BUTTON_DOWN = 5;
    App.constants.BUTTON_LEFT = 6;
    App.constants.BUTTON_RIGHT = 7;
    App.constants.QUICK_SAVE_STATE = 8;
    App.constants.QUICK_LOAD_STATE = 9;
    App.constants.BUTTON_SCREENSHOT = 10;

    var container;
    var active = false;

    var rebindingButton = null;
    var buttonMappers = {};
    var gamepadSelectorDivs = [];
    var gamepadSelectors = [];
    var inputTypeSelector = [];

    Module.init = function(c){
        App.davis.get("/settings",function(req){
            App.setActiveModule("settings");
            document.title = "Googulator - Settings";
        });

        container = c;
        App.loadMustacheTemplate("modules/settings/template.html","inputConfiguration",function(template){
            for (var i = 0; i < App.settings.controller.numPlayers; i++){
                var controls = template.render({player:i,playerPlusOne:i+1});
                $("#Controls .content").append(controls);
            }
            $(".enabledCheckbox").change(function(event){
                App.settings.controller[$(event.delegateTarget).attr("player")].enabled = event.delegateTarget.checked;
                localStorage["controllerSettings"] = JSON.stringify(App.settings.controller);
            }).each(function(index,checkbox){
                    checkbox.checked = App.settings.controller[$(checkbox).attr("player")].enabled;
            });
            $(".gamepadSelectorDiv").each(function(index,selector){
                var player = $(selector).attr("player");
                gamepadSelectorDivs[player] = $(selector);
            });
            $(".gamepadSelector").change(function(event){
                var playerNum = $(event.delegateTarget).attr("player");
                App.settings.controller[playerNum].gamepadNum = event.delegateTarget.selectedIndex;
                localStorage["controllerSettings"] = JSON.stringify(App.settings.controller);
            }).each(function(index,selector){
                    var player = $(selector).attr("player");
                    gamepadSelectors[player] = $(selector);
                });
            $(".rebindBtn").click(function(event){
                var target = $(event.delegateTarget);
                var oldTarget = rebindingButton;
                finishRebind();
                if (oldTarget == null || oldTarget[0] != target[0]){
                    rebindingButton = target;
                    rebindingButton.text("Waiting for input...");
                }
            }).each(function(index,button){
                    if (buttonMappers[$(button).attr("player")] == null)
                        buttonMappers[$(button).attr("player")] = {};
                    buttonMappers[$(button).attr("player")][$(button).attr("button")] = $(button);
                });
            $(".inputTypeSelector").change(function(event){
                var playerNum = $(event.delegateTarget).attr("player");
                if (App.settings.controller[playerNum].type != event.delegateTarget.selectedIndex){
                    App.settings.controller[playerNum].type = event.delegateTarget.selectedIndex;
                    setControllerToDefault(playerNum);
                }
            }).each(function(index,selector){
                    inputTypeSelector[$(selector).attr("player")] = $(selector);
                });
            updateAllButtons();

            OfflineUtils.checkLocalStorageEnabled(function(enabled){
                if (enabled){
                    container.find("#Offline .enableLocalStorage")[0].checked = true;
                }
                container.find("#Offline .enableLocalStorage").removeAttr("disabled");
            });

            container.find("#Offline .enableLocalStorage").click(function(event){
                OfflineUtils.enableLocalStorage(event.target.checked,function(enabled){
                    event.target.checked = enabled;

                    //this little hack will make sure the metadata file gets cached
                    if (App.userInfo != null && App.userInfo.metadataFileId != null && GoogleAPIs.hasFileInMemoryCache(App.userInfo.metadataFileId)){
                        GoogleAPIs.getFile(App.userInfo.metadataFileId,function(){});
                    }
                });
            });

            function enableTwitchInputOptions(){
                container.find("#inputConfiguration-0 .inputTypeSelector .twitchOption").removeClass("hidden").removeAttr("disabled");
            }

            if (window.irc != null){
                enableTwitchInputOptions();
            }
            else{
                window.onIRCReady = enableTwitchInputOptions;
            }

            if (localStorage["controllerSettings"] != null){
                App.settings.controller = JSON.parse(localStorage["controllerSettings"]);
                App.settings.controller.transformKeyInput = transformKeyInput;
                App.settings.controller.transformGamepadInput = transformGamepadInput;
                App.settings.controller.transformTextInput = transformTextInput;
                updateAllButtons();
            }
            else{
                for (var i = 0; i < App.settings.controller.numPlayers; i++){
                    setControllerToDefault(i);
                }
            }

            (function waitForTwitchReady(){
                if (!App.twitchReady){
                    setTimeout(waitForTwitchReady,100);
                    return;
                }
                if (App.twitchAccessToken){
                    container.find(".twitchOptions .twitchLogin").replaceWith("<div>Logged into Twitch as <b class='twitchName'></b></div>");
                    Twitch.api({method:"user"},function(error,success){
                        App.twitchUsername = success.name;
                        container.find(".twitchName").text(success.name);
                        initializeTwitchIRCClient();
                    });

                }
                else{
                    container.find(".twitchOptions .twitchLogin").removeClass("hidden").click(function(){
                        App.twitchLogin();
                    });
                }
            })();
        });


    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/settings")
            Davis.location.assign("/settings");
        active = true;

    }

    Module.onFreeze = function(){
        active = false;
        finishRebind();
    }

    Module.onAuthenticated = function(){
        if (App.websiteBrokenMode){
            App.createMessageOverlay(container,"The website isn't functioning currently. Unfortunately you aren't able to access the Settings tab in this state!");
        }

    }

    function transformKeyInput(event){
        var events = [];
        for (var i = 0; i < App.settings.controller.numPlayers; i++){
            var controller = App.settings.controller[i];
            if (!controller.enabled)
                continue;
            if (controller.type == App.constants.TYPE_KEYBOARD){
                var button = App.constants.BUTTON_INVALID;
                switch(event.keyCode){
                    case controller.a:
                        button = App.constants.BUTTON_A;
                        break;
                    case controller.b:
                        button = App.constants.BUTTON_B;
                        break;
                    case controller.start:
                        button = App.constants.BUTTON_START;
                        break;
                    case controller.select:
                        button = App.constants.BUTTON_SELECT;
                        break;
                    case controller.left:
                        button = App.constants.BUTTON_LEFT;
                        break;
                    case controller.right:
                        button = App.constants.BUTTON_RIGHT;
                        break;
                    case controller.up:
                        button = App.constants.BUTTON_UP;
                        break;
                    case controller.down:
                        button = App.constants.BUTTON_DOWN;
                        break;
                    case controller.quickSaveState:
                        if (event.up)
                            button = App.constants.QUICK_SAVE_STATE;
                        break;
                    case controller.quickLoadState:
                        if (event.up)
                            button = App.constants.QUICK_LOAD_STATE;
                        break;
                    case controller.screenshot:
                        if (event.up)
                            button = App.constants.BUTTON_SCREENSHOT;
                        break;
                }
                if (button != App.constants.BUTTON_INVALID){
                    events.push(generateEvent(i,button,!event.up));
                }
            }
            else if (controller.type == App.constants.TYPE_ICADE){
                event = getICadeEvent(event);
                if (event != null){
                    switch(event.keyCode){
                        case controller.a:
                            button = App.constants.BUTTON_A;
                            break;
                        case controller.b:
                            button = App.constants.BUTTON_B;
                            break;
                        case controller.start:
                            button = App.constants.BUTTON_START;
                            break;
                        case controller.select:
                            button = App.constants.BUTTON_SELECT;
                            break;
                        case controller.left:
                            button = App.constants.BUTTON_LEFT;
                            break;
                        case controller.right:
                            button = App.constants.BUTTON_RIGHT;
                            break;
                        case controller.up:
                            button = App.constants.BUTTON_UP;
                            break;
                        case controller.quickSaveState:
                            if (event.up)
                                button = App.constants.QUICK_SAVE_STATE;
                            break;
                        case controller.quickLoadState:
                            if (event.up)
                                button = App.constants.QUICK_LOAD_STATE;
                            break;
                        case controller.screenshot:
                            if (!event.up)
                                button = App.constants.BUTTON_SCREENSHOT;
                            break;
                    }
                }
                if (button != App.constants.BUTTON_INVALID){
                    events.push(generateEvent(i,button,!event.up));
                }
            }
        }
        return events;
    }

    function transformGamepadInput(event){
        var events = [];
        if (event.type == "button_press"){
            for (var i = 0; i < App.settings.controller.numPlayers; i++){
                var controller = App.settings.controller[i];
                if (!controller.enabled)
                    continue;
                if (controller.type == App.constants.TYPE_GAMEPAD && controller.gamepadNum == event.gamepadid){
                    var button =  App.constants.BUTTON_INVALID;
                    switch(getGamepadKeycode(event)){
                        case controller.a:
                            button = App.constants.BUTTON_A;
                            break;
                        case controller.b:
                            button = App.constants.BUTTON_B;
                            break;
                        case controller.start:
                            button = App.constants.BUTTON_START;
                            break;
                        case controller.select:
                            button = App.constants.BUTTON_SELECT;
                            break;
                        case controller.left:
                            button = App.constants.BUTTON_LEFT;
                            break;
                        case controller.right:
                            button = App.constants.BUTTON_RIGHT;
                            break;
                        case controller.up:
                            button = App.constants.BUTTON_UP;
                            break;
                        case controller.down:
                            button = App.constants.BUTTON_DOWN;
                            break;
                        case controller.quickSaveState:
                            if (!event.pressed)
                                button = App.constants.QUICK_SAVE_STATE;
                            break;
                        case controller.quickLoadState:
                            if (!event.pressed)
                                button = App.constants.QUICK_LOAD_STATE;
                            break;
                        case controller.screenshot:
                            if (event.pressed)
                                button = App.constants.BUTTON_SCREENSHOT;
                            break;
                    }
                    if (button != App.constants.BUTTON_INVALID){
                        events.push(generateEvent(i,button,event.pressed));
                    }
                }
            }
        }
        return events;
    }

    function transformTextInput(text){
        var events = [];
        var button = App.constants.BUTTON_INVALID;
        switch (text.toLowerCase()){
            case "up":
                button = App.constants.BUTTON_UP;
                break;
            case "down":
                button = App.constants.BUTTON_DOWN;
                break;
            case "left":
                button = App.constants.BUTTON_LEFT;
                break;
            case "right":
                button = App.constants.BUTTON_RIGHT;
                break;
            case "a":
                button = App.constants.BUTTON_A;
                break;
            case "b":
                button = App.constants.BUTTON_B;
                break;
            case "start":
                button = App.constants.BUTTON_START;
                break;
            case "select":
                button = App.constants.BUTTON_SELECT;
                break;
        }
        if (button != App.constants.BUTTON_INVALID){
            events.push(generateEvent(0,button,true));
            events.push(generateEvent(0,button,false));
        }
        return events;

    }

    function getGamepadKeycode(event){
        var keycode = event.buttonid;
        if (keycode == null)
            keycode = -(event.axisid * 2 + (event.axispositive ? 2 : 1));
        return keycode;
    }

    function getICadeEvent(event){
        var newEvent = {};
        newEvent.ignore = event.up;
        newEvent.up = true;
        switch(event.keyCode){
            case 75:
                newEvent.up = false;
            case 80:
                newEvent.keyCode = 0;
                break;
            case 87:
                newEvent.up = false;
            case 69:
                newEvent.keyCode = 1;
                break;
            case 88:
                newEvent.up = false;
            case 90:
                newEvent.keyCode = 2;
                break;
            case 65:
                newEvent.up = false;
            case 81:
                newEvent.keyCode = 3;
                break;
            case 68:
                newEvent.up = false;
            case 67:
                newEvent.keyCode = 4;
                break;
            case 89:
                newEvent.up = false;
            case 84:
                newEvent.keyCode = 5;
                break;
            case 72:
                newEvent.up = false;
            case 82:
                newEvent.keyCode = 6;
                break;
            case 85:
                newEvent.up = false;
            case 70:
                newEvent.keyCode = 7;
                break;
            case 74:
                newEvent.up = false;
            case 78:
                newEvent.keyCode = 8;
                break;
            case 73:
                newEvent.up = false;
            case 77:
                newEvent.keyCode = 9;
                break;
            case 79:
                newEvent.up = false;
            case 71:
                newEvent.keyCode = 10;
                break;
            case 76:
                newEvent.up = false;
            case 86:
                newEvent.keyCode = 11;
                break;
            default:
                newEvent.ignore = true;
        }
        if (!newEvent.ignore)
            return newEvent;
        else
            return null;
    }

    function generateEvent(player,button,pressed){
        var event = {};
        event.player = player;
        event.button = button;
        event.pressed = pressed;
        return event;
    }

    App.settings = {
        "controller": {
            "numPlayers": 4,
            "0":{
                "enabled":true,
                "type":App.constants.TYPE_KEYBOARD,
                "gamepadNum":0
            },
            "1":{
                "enabled":false,
                "type":App.constants.TYPE_KEYBOARD,
                "gamepadNum":1
            },
            "2":{
                "enabled":false,
                "type": App.constants.TYPE_KEYBOARD,
                "gamepadNum":2
            },
            "3":{
                "enabled":false,
                "type":App.constants.TYPE_KEYBOARD,
                "gamepadNum":3
            },
            "type": 0,
            "default": {
                "0":{//keyboard
                    "a": 90,
                    "b": 88,
                    "start": 13,
                    "select": 32,
                    "left": 37,
                    "right": 39,
                    "up": 38,
                    "down": 40,
                    "quickSaveState": 53,
                    "quickLoadState": 54,
                    "screenshot": 48
                },
                "1":{ //iCade
                    "a": 6,
                    "b": 8,
                    "start": 11,
                    "select": 10,
                    "left": 3,
                    "right": 4,
                    "up": 1,
                    "down": 2,
                    "quickSaveState": 7,
                    "quickLoadState": 9,
                    "screenshot": 5
                },
                "2":{//Gamepad
                    "a": 0,
                    "b": 1,
                    "start": 9,
                    "select": 8,
                    "left": 14,
                    "right": 15,
                    "up": 12,
                    "down": 13,
                    "quickSaveState": 4,
                    "quickLoadState": 5,
                    "screenshot": 16
                },
                "3":{//Twitch Chat
                    "a":"a",
                    "b":"b",
                    "start":"start",
                    "select":"select",
                    "left":"left",
                    "right":"right",
                    "up":"up",
                    "down":"down",
                    "quickSaveState": null,
                    "quickLoadState": null,
                    "channel": null,
                    "screenshot": null
                }
            },
            "transformKeyInput": transformKeyInput,
            "transformGamepadInput": transformGamepadInput,
            "transformTextInput": transformTextInput
        }
    };

    function setControllerToDefault(player){
        for (var member in App.settings.controller["default"][App.settings.controller[player].type]){
            App.settings.controller[player][member] = App.settings.controller.default[App.settings.controller[player].type][member];
        }
        localStorage["controllerSettings"] = JSON.stringify(App.settings.controller);
        updateAllButtons();
    }

    function updateAllButtons(){
        for (var i = 0; i < App.settings.controller.numPlayers; i++){
            if (gamepadSelectorDivs[i] == null)
                continue;
            if (App.settings.controller[i].type == App.constants.TYPE_GAMEPAD){
                gamepadSelectorDivs[i].removeClass("hidden");
                gamepadSelectors[i][0].selectedIndex = App.settings.controller[i].gamepadNum;
            }
            else{
                gamepadSelectorDivs[i].addClass("hidden");
            }
            if (App.settings.controller[i].type == App.constants.TYPE_TWITCH){
                $("#inputConfiguration-" + i + " .twitchOptions").removeClass("hidden");
            }
            else{
                $("#inputConfiguration-" + i + " .twitchOptions").addClass("hidden");
            }
            for (var button in buttonMappers[i]){
                buttonMappers[i][button].text(App.getKeyName(App.settings.controller[i][button],App.settings.controller[i].type));
            }
            inputTypeSelector[i][0].selectedIndex = App.settings.controller[i].type;

        }

    }




    var iCadeButtonNames = ["Bottom Right Black", "Joystick Up", "Joystick Down", "Joystick Left", "Joystick Right", "Top Red", "Bottom Red", "Top Left Black", "Bottom Left Black", "Top Right Black",
                        "Top White", "Bottom White"];


    App.getKeyName = function(keyCode,type){
        switch(type){
            case 2:
                if (keyCode >= 0){
                    return Gamepad.getButtonName(keyCode);
                }
                else{
                    keyCode += 1;
                    return Gamepad.getAxisName(Math.floor(-keyCode / 2)) + " " + (-keyCode % 2 == 0 ? "positive" : "negative");
                }
                return keyCode + "";
            case 1://icade
                if (keyCode > iCadeButtonNames.length)
                    break;
                return iCadeButtonNames[keyCode];
            case 0://keyboard
                switch (keyCode){
                    case 0:
                        return "Unknown Key";
                    case 8:
                        return "Backspace";
                    case 9:
                        return "Tab";
                    case 13:
                        return "Enter";
                    case 16:
                        return "Shift";
                    case 17:
                        return "Control";
                    case 18:
                        return "Alt";
                    case 19:
                        return "Pause Break";
                    case 20:
                        return "Caps Lock";
                    case 32:
                        return "Space";
                    case 33:
                        return "Page Up";
                    case 34:
                        return "Page Down";
                    case 35:
                        return "End";
                    case 36:
                        return "Home";
                    case 37:
                        return "Left";
                    case 38:
                        return "Up";
                    case 39:
                        return "Right";
                    case 40:
                        return "Down";
                    case 42:
                        return "Print Screen";
                    case 45:
                        return "Insert";
                    case 46:
                        return "Delete";
                    case 91:
                        return "Meta";
                    case 96:
                        return "Numpad 0";
                    case 97:
                        return "Numpad 1";
                    case 98:
                        return "Numpad 2";
                    case 99:
                        return "Numpad 3";
                    case 100:
                        return "Numpad 4";
                    case 101:
                        return "Numpad 5";
                    case 102:
                        return "Numpad 6";
                    case 103:
                        return "Numpad 7";
                    case 104:
                        return "Numpad 8";
                    case 105:
                        return "Numpad 9";
                    case 106:
                        return "Numpad *";
                    case 107:
                        return "Numpad +";
                    case 109:
                        return "Numpad -";
                    case 110:
                        return "Numpad .";
                    case 111:
                        return "Numpad /";
                    case 112:
                        return "F1";
                    case 113:
                        return "F2";
                    case 114:
                        return "F3";
                    case 115:
                        return "F4";
                    case 116:
                        return "F5";
                    case 117:
                        return "F6";
                    case 118:
                        return "F7";
                    case 119:
                        return "F8";
                    case 120:
                        return "F9";
                    case 121:
                        return "F10";
                    case 122:
                        return "F11";
                    case 123:
                        return "F12";
                    case 144:
                        return "Num Lock";
                    case 145:
                        return "Scroll Lock";
                    case 186:
                        return ";";
                    case 187:
                        return "=";
                    case 188:
                        return ",";
                    case 189:
                        return "-";
                    case 190:
                        return ".";
                    case 191:
                        return "/";
                    case 192:
                        return "~";
                    case 219:
                        return "[";
                    case 220:
                        return "\\";
                    case 221:
                        return "]";
                    case 222:
                        return "'";
                    default:
                        return String.fromCharCode(keyCode);
                }
                break;
        }
        return "Unknown";
    }

    function finishRebind(){
        if (rebindingButton == null)
            return;
        var controller = App.settings.controller[rebindingButton.attr("player")];
        rebindingButton.text(App.getKeyName(controller[rebindingButton.attr("button")],controller.type));
        rebindingButton = null;
        localStorage["controllerSettings"] = JSON.stringify(App.settings.controller);
    }


    $(document).keyup(function(event){
        if (rebindingButton != null){
            var controller = App.settings.controller[rebindingButton.attr("player")];
            if (controller.type == App.constants.TYPE_KEYBOARD){
                controller[rebindingButton.attr("button")] = event.keyCode;
                finishRebind();
            }
            else if (controller.type == App.constants.TYPE_ICADE){
                event.up = true;
                event = getICadeEvent(event);
                if (event != null){
                    controller[rebindingButton.attr("button")] = event.keyCode;
                    finishRebind();
                }
            }
        }
    });

    $(document).keydown(function(event){
        if (rebindingButton != null){
            var controller = App.settings.controller[rebindingButton.attr("player")];
            if (controller.type == App.constants.TYPE_KEYBOARD){
                event.preventDefault();
                controller[rebindingButton.attr("button")] = event.keyCode;
                finishRebind();
            }
            else if (controller.type == App.constants.TYPE_ICADE){
                event.preventDefault();
                event.up = false;
                event = getICadeEvent(event);
                if (event != null){
                    controller[rebindingButton.attr("button")] = event.keyCode;
                    finishRebind();
                }
            }
        }
    });

    Gamepad.addListener(function(event){
        if (rebindingButton != null){
            var controller = App.settings.controller[rebindingButton.attr("player")];
            if (controller.type == App.constants.TYPE_GAMEPAD && controller.gamepadNum == event.gamepadid){
                controller[rebindingButton.attr("button")] = getGamepadKeycode(event);
                finishRebind();
            }
        }
    });

    var twitchIRC;

    function initializeTwitchIRCClient(){
        twitchIRC = new window.irc("irc.twitch.tv",6667,App.twitchUsername,"oauth:" + App.twitchAccessToken,function(){
            if (App.settings.controller[0].twitchChannel == null){
                App.settings.controller[0].twitchChannel = App.twitchUsername;
            }
            twitchIRC.joinChannel("#" + App.settings.controller[0].twitchChannel);
        });
        twitchIRC.onIRCMessage = function(message){
            console.log(message.fullText);
        }
    }


    return Module;
})
