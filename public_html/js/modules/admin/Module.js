define(["GoogleAPIs"],function(GoogleAPIs){
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
        })

    }

    return Module;
})