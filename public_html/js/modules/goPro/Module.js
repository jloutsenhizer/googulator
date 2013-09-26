define(["GoogleAPIs"],function(GoogleAPIs){
    var Module = {};

    var container;

    var authenticated = false;

    Module.init = function(c){
        App.davis.get("/goPro",function(req){
            App.setActiveModule("goPro");
            document.title = "Googulator - Go Pro";
        });
        container = c;
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/goPro")
            Davis.location.assign("/goPro");

        $("#paywithPaypalButton").click(function(){
            if (!authenticated){
                alert("You must login before you can ugprade to Googulator Pro");
                return false;
            }
            $("#paypalGoogleToken").attr("value",GoogleAPIs.getAuthToken());
            $("#inputMoney").blur();
            if (parseFloat($("#inputMoney").val()) < 5){
                alert("You must pay at least $5 to get Gogulator Pro");
                return false;
            }
            App.createMessageOverlay(container,"Redirecting You To Paypal...");
            return true;
        });
        $("#inputMoney").blur(function(){
            $("#inputMoney").val(parseFloat($("#inputMoney").val()).toFixed(2));
            if ($("#inputMoney").val() == "NaN")
                $("#inputMoney").val("0.00");
        });
        if (getParams.finishPurchase){
            var overlay = App.createMessageOverlay(container,"Finalizing Your purchase...");
            function onError(){
                overlay.remove();
                alert("An error occurred processing your order!");
                location.assign("/goPro");

            }
            $.ajax("/php/paypal/approvePurchase.php?googleid=" + encodeURIComponent(getParams.googleid) + "&token=" + encodeURIComponent(getParams.token) + "&PayerID=" + encodeURIComponent(getParams.PayerID),{
                success:function(result){
                    if (result == 1){
                        overlay.remove();
                        alert("Congradulations! You now have Googulator Pro!");
                        location.assign("/home");

                    }
                    else{
                        onError();
                    }

                },
                error: onError
            })
        }
    }

    Module.onFreeze = function(){

    }

    Module.onAuthenticated = function(){
        authenticated = true;
    }

    return Module;
})