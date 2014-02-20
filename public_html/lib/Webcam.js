"use strict";

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

var video = document.createElement("video");
video.autoplay = true;

var videoStream = null;


function initVideo(onSuccess,onFailure){
    if (onSuccess == null)
        onSuccess = function(){};
    if (onFailure == null)
        onFailure = function(){};
    if (videoStream != null){
        onSuccess(videoStream);
        return;
    }
    if (navigator.getUserMedia){
        navigator.getUserMedia({video: true}, function(stream) {
            videoStream = stream;
            video.src = window.URL.createObjectURL(stream);
            onSuccess(stream);
        }, onFailure);
    }
    else{
        onFailure();
    }
}

function stopVideo(){
    if (videoStream != null){
        videoStream.stop();
        video.src = "";
    }
}

function getFrame(width,height){
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(video,0,0,width,height);
    return ctx.getImageData(0,0,width,height);
}

window.Webcam = {initVideo: initVideo,
          getFrame: getFrame,
    stopVideo: stopVideo};