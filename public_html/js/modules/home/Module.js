define(function(){
    var Module = {};

    var container;

    Module.init = function(c){
        App.davis.get("/home",function(req){
            App.setActiveModule("home");
            document.title = "Googulator";
        });

        $("#subscribeToUpdates").click(function(){
            if ($("#subscribeToUpdates").is(":disabled"))
                return;
            $("#subscribeToUpdates").attr("disabled","disabled");
            var value = $("#emailSubscribeWith").val();
            $("#emailSubscribeWith").attr('disabled',"disabled");
            $.ajax("/php/subscribeToUpdates.php?address=" + encodeURIComponent(value),{
                success:function(result){
                    if (result.result == "success"){
                        App.showModalMessage("Email Updates Subscribed","You will now get email updates when there are new additions to Googulator! A test email was sent to your address to make sure the emails will show up for you. You may need to check your spam folder.",function(){
                            $("#subscribeToUpdates").removeAttr("disabled");
                            $("#emailSubscribeWith").removeAttr("disabled");
                        });
                    }
                    else if (result.result == "alreadySubscribed"){
                        App.showModalMessage("You are Already Subscribed","The provided email address is already subscribed to updates!",function(){
                            $("#subscribeToUpdates").removeAttr("disabled");
                            $("#emailSubscribeWith").removeAttr("disabled");
                        });
                    }
                    else{
                        App.showModalMessage("An Error Occurred","We were unable to add your email address to the email list!",function(){
                            $("#subscribeToUpdates").removeAttr("disabled");
                            $("#emailSubscribeWith").removeAttr("disabled");
                        });
                    }

                },
                error:function(){
                    App.showModalMessage("An Error Occurred","We were unable to add your email address to the email list!",function(){
                        $("#subscribeToUpdates").removeAttr("disabled");
                        $("#emailSubscribeWith").removeAttr("disabled");
                    });

                }
            })
        });
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/home")
            Davis.location.assign("/home");
    }

    Module.onFreeze = function(){

    }

    Module.onAuthenticated = function(){
    }

    return Module;
})