"use strict";

window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || function(callback){setTimeout(callback,1000/60)};

var listeners = [];

function update(){
    var gamepads = navigator.webkitGamepads;
    if (gamepads == null)
        gamepads = navigator.webkitGetGamepads();
    for (var i = 0; i < gamepads.length; i++){
        var oldpad = $.extend({},Gamepad.gamepads[i]);
        Gamepad.gamepads[i] =  $.extend({},gamepads[i]);
        fireEvents(oldpad,Gamepad.gamepads[i]);
    }
    scheduleNextUpdate();
}

function scheduleNextUpdate(){
    window.requestAnimationFrame(update);
}

function fireEvents(oldpad,newpad){
    if (newpad == null)
        return;
    for (var i = 0; newpad.buttons != null && i < newpad.buttons.length; i++){
        if (oldpad.buttons != null && isButtonPressed(oldpad.buttons[i]) != isButtonPressed(newpad.buttons[i])){
            var event = {};
            event.type = "button_press";
            event.buttonid = i;
            event.id = "button_" + event.buttonid;
            event.value = newpad.buttons[i];
            event.gamepadid = newpad.index;
            event.pressed = isButtonPressed(event.value);
            for (var j = 0; j < listeners.length; j++){
                listeners[j](event);
            }
        }
    }
    for (var i = 0; newpad.axes != null && i < newpad.axes.length; i++){
        if (oldpad.axes != null && (isButtonPressed(oldpad.axes[i],0.25) != isButtonPressed(newpad.axes[i],0.25) || isButtonPressed(-oldpad.axes[i],0.25) != isButtonPressed(-newpad.axes[i],0.25))){
            var event = {};
            event.type = "button_press";
            event.axisid = i;
            event.id = "axes_" + event.axisid + "_";
            event.value = newpad.axes[i];
            event.gamepadid = newpad.index;
            event.pressed = isButtonPressed(newpad.axes[i],0.25) || isButtonPressed(-newpad.axes[i],0.25);
            if (!event.pressed){
                event.axispositive = oldpad.axes[i] < 0;
            }
            else{
                event.axispositive = newpad.axes[i] < 0;

            }
            event.id += event.axispositive ? "negative" : "positive";
            for (var j = 0; j < listeners.length; j++){
                listeners[j](event);
            }
        }
    }
}

var defaultButtonNames = ["Face Button 1", "Face Button 2", "Face Button 3",
    "Face Button 4", "Left Shoulder Button", "Right Shoulder Button",
    "Left Shoulder Bottom Button", "Right Shoulder Bottom Button", "Select",
    "Start","Left Stick Click", "Right Stick Click", "D-Pad Up",
    "D-Pad Down", "D-Pad Left", "D-Pad Right"];

function getButtonName(id){
    if (id < defaultButtonNames.length)
        return defaultButtonNames[id];
    else{
        return "Button " + id;
    }
}

var defaultAxisNames = ["Left Stick X", "Left Stick Y",
    "Right Stick X", "Right Stick Y"];

function getAxisName(id){
    if (id < defaultAxisNames.length)
        return defaultAxisNames[id];
    else{
        return "Stick " + Math.floor(id / 2) + " " + (id % 2 ? "X" : "Y");
    }

}

function isButtonPressed(value,deadZone){
    if (deadZone == null) deadZone = 0.9
    return value >= deadZone;
}

function addListener(listener){
    listeners.push(listener);
}

window.Gamepad = {gamepads:[],
    addListener:addListener,
    getButtonName: getButtonName,
    getAxisName: getAxisName};

window.Gamepad.supported = !!navigator.webkitGetGamepads || !!navigator.webkitGamepads;

if (window.Gamepad.supported){
    update();
}

