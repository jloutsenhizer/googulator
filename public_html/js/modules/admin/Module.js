define(["GoogleAPIs"],function(GoogleAPIs){
    "use strict";

    var Module = {};

    var container;

    var authenticated = false;
    var active = false;

    Module.init = function(c){
        App.davis.get("/admin",function(req){
            App.setActiveModule("admin");
            document.title = "Googulator - Administrative Center";
        });
        container = c;
    }

    Module.onActivate = function(params){
        if (Davis.location.current() != "/admin")
            Davis.location.assign("/admin");


        active = true;
        if (!App.userHasRole("ROLE_ADMIN"))
            App.setActiveModule("home");
    }

    Module.onFreeze = function(){
        active = false;

    }

    Module.onAuthenticated = function(){
        authenticated = true;
        if (active && !App.userHasRole("ROLE_ADMIN"))
            App.setActiveModule("home");
        //if an admin is logged in we should show the real admin control center
        if (App.userHasRole("ROLE_ADMIN")){
            App.loadMustacheTemplate("modules/admin/template.html","adminDisplay",function(template){
                container.find(".contentArea").empty();
                container.find(".contentArea").append(template.render());
                bindAdminControls();
            })
        }
    }

    function bindAdminControls(){
        container.find(".resetDB").click(function(){
            App.showModalConfirmation("WARNING","This action is destructive and is irreversible. If there are pro purchases in the database please perform a backup before proceeding!\n\nWould you like to continue?",function(agreed){
                if (agreed){
                    var overlay = App.createMessageOverlay(container,"Resetting Server Database....");
                    $.ajax("/php/admin/setupMysqlDatabase.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()),{
                        success:function(result){
                            overlay.remove();
                            if (result.status == "failed"){
                                var errorMessage = "An unknown error occurred!" + result.error;
                                switch (result.error){
                                    case "PERMISSION_DENIED":
                                        errorMessage = "You don't seem to have permission to do this...";
                                        break;
                                    case "MYSQL_CONFIG_ERROR":
                                        errorMessage = "There seems to be a problem connecting to the MySQL server. Please check the configuration files to ensure the connection information is correct.";
                                        break;
                                    case "MYSQL_SCHEMA_CREATE_FAIL":
                                        errorMessage = "There seems to be a problem creating the MySQL database. You may not have permissions to create MySQL databases on your host via PHP. Go manually setup the database and try again.";
                                        break;
                                }
                                App.showModalMessage("Error",errorMessage);
                            }
                            else{
                                App.showModalMessage("Success!","The database should be setup now! The page will now automatically refresh.",function(){
                                    App.refreshPage();
                                });
                            }

                        },
                        error:function(){
                            overlay.remove();
                            App.showModalMessage("Error","An unknown error occurred!");
                        }
                    })
                }
            });
        });

        container.find(".sendUpdateEmail").click(function(){
            App.loadMustacheTemplate("modules/admin/template.html","updateEmailCompose",function(template){
                var dialog = App.makeModal(template.render());
                dialog.find('.cancelBtn').click(function(){
                    dialog.modal("hide");
                });
                dialog.find('.sendBtn').click(function(){
                    var mainMessageText = dialog.find(".emailMessage").val();
                    var text = mainMessageText;
                    var discussLink = dialog.find("#gPlusDiscussLink").val();
                    text += "\n\nDiscuss these updates:\n" + discussLink;
                    text += "\n\nCheck out these updates now:\nhttp://www.googulator.com/";
                    text += "\n\nFollow us on Twitter:\nhttp://www.twitter.com/googulator";
                    text += "\n\nSubscribe to our Pushbullet Channel:\n" + "https://www.pushbullet.com/channel?tag=" + window.configuration.pushbullet.channelId;
                    dialog.modal("hide");
                    App.showModalConfirmation("Confirm Email Text","Please confirm you are certain you want to send the following email out:\n" + text,function(agreed){
                        if (agreed){
                            //send out the pushbullet push
                            PushBullet.pushToChannel(window.configuration.pushbullet.channelId,new PushBullet.Link("New Updates to Googulator",mainMessageText,discussLink));
                            //send out the email to the mailing list, this code really needs to be improved :x
                            var overlay = App.createMessageOverlay(container,$("<div class='message'>Sending out update email, do not close the tab...</div><div class='pbar'></div>"));
                            $.ajax("/php/admin/getEmailListSize.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()),{
                                success:function(result){
                                    if (result.status == "success"){
                                        var numEmails = result.numEmails;
                                        overlay.find(".message").text("Sending out email, do not close the tab (Progress: 0/" + numEmails + ")...");
                                        overlay.find(".pbar").progressbar({value:0});
                                        var totalSent = 0;
                                        var startId = 0;
                                        (function sendMore(){
                                            $.ajax("/php/admin/dispatchUpdateEmail.php?googletoken=" + encodeURIComponent(GoogleAPIs.getAuthToken()) + "&message=" + encodeURIComponent(text) + "&startId=" + startId,{
                                                success:function(result){
                                                    if (result.status == "success"){
                                                        if (result.done){
                                                            overlay.remove();
                                                            App.showModalMessage("Success","All emails have successfully been sent!");
                                                        }
                                                        else{
                                                            totalSent += result.numSent;
                                                            startId = result.lastId;
                                                            overlay.find(".message").text("Sending out email, do not close the tab (Progress: " + totalSent +"/" + numEmails + ")...");
                                                            overlay.find(".pbar").progressbar({value:totalSent / numEmails * 100});
                                                            sendMore();
                                                        }

                                                    }
                                                    else{
                                                        sendMore();
                                                    }
                                                },
                                                error:function(){
                                                    sendMore();
                                                }
                                            });
                                        })();
                                    }
                                    else{
                                        overlay.remove();
                                        App.showModalMessage("Error","Some error occurred and none of the emails could be sent!");

                                    }


                                },
                                error:function(){
                                    overlay.remove();
                                    App.showModalMessage("Error","Some error occurred and none of the emails could be sent!");

                                }
                            });
                        }

                    });
                })
            })

        });

        container.find(".loginToPushbullet").attr("disabled","disabled");
        function afterPushBulletAuth(loggedIn) {
            if (!loggedIn){
                container.find(".loginToPushbullet").removeAttr("disabled");
            }
            else{
                container.find(".loginToPushbullet")[0].innerText = "Logged In To PushBullet";
            }

        }

        container.find(".loginToPushbullet").click(function(){
            container.find(".loginToPushbullet").attr("disabled","disabled");
            PushBullet.doAuth(afterPushBulletAuth);
        });
        PushBullet.checkAuth(afterPushBulletAuth);

    }

    return Module;
})