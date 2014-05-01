<?php
    include "configuration.php";
    include "include.php";
    $tabs = array("home","library","play","settings","help","goPro","about","admin");
    $tabNames = array("Home","Library","Play","Settings","Help","Go Pro","About","Admin");
    $tabDefaultShow = array(true,false,false,false,true,false,true,false);
    $defaultTab = 0;
    $requestURI = $_SERVER['REQUEST_URI'];
    $https = "";
    if (isset($_SERVER['HTTPS'] )  && strcmp($_SERVER['HTTPS'],"off") != 0)
        $https = "s";
    $hostName = $_SERVER["HTTP_HOST"];


    if (strcmp($hostName,$PREFERRED_HOSTNAME) != 0){
        header("HTTP/1.1 301 Moved Permanently");
        header("Location: http$https://$PREFERRED_HOSTNAME$requestURI");
        die;
    }

    $title = "Googulator";
?>
<!DOCTYPE html>
<html manifest="/appcache.php">
    <head>
        <link rel="chrome-webstore-item" href="https://chrome.google.com/webstore/detail/lchmgljjkaeadokijkhefbhpfbihhhda">
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <?php
            if (strpos($requestURI,"/library/game/") === 0){
                $gameid = substr($requestURI,strlen("/library/game/"));
                echo "<link rel='image_src' href='http";
                echo $https;
                echo "://";
                echo $hostName;
                echo "/img/ROMPictures/";
                echo $gameid;
                echo ".jpg'>";
                $title .= " - Library - ";
                $con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);
                mysql_select_db($MYSQL_DATABASE, $con);
                $title .= getGameTitle(urldecode($gameid),$con);
                mysql_close($con);
                $defaultTab = array_search("library",$tabs);
            }
            else if (strpos($requestURI,"/library") === 0){
                $title .= " - Library";
                $defaultTab = array_search("library",$tabs);
            }
            else if (strpos($requestURI,"/settings") === 0){
                $title .= " - Settings";
                $defaultTab = array_search("settings",$tabs);
            }
            else if (strpos($requestURI,"/gameboy/play/") === 0){
                $gameid = substr($requestURI,strlen("/gameboy/play/"));
                echo "<link rel='image_src' href='http";
                echo $https;
                echo "://";
                echo $hostName;
                echo "/img/ROMPictures/";
                echo $gameid;
                echo ".jpg'>";
                $title .= " - ";
                $con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);
                mysql_select_db($MYSQL_DATABASE, $con);
                $title .= getGameTitle(urldecode($gameid),$con);
                mysql_close($con);
                $defaultTab = array_search("play",$tabs);
            }
            else if (strpos($requestURI,"/nes/play/") === 0){
                $gameid = substr($requestURI,strlen("/nes/play/"));
                echo "<link rel='image_src' href='http";
                echo $https;
                echo "://";
                echo $hostName;
                echo "/img/ROMPictures/";
                echo $gameid;
                echo ".jpg'>";
                $title .= " - ";
                $con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);
                mysql_select_db($MYSQL_DATABASE, $con);
                $title .= getGameTitle(urldecode($gameid),$con);
                mysql_close($con);
                $defaultTab = array_search("play",$tabs);
            }
            else if (strpos($requestURI,"/play/") === 0){
                $gameid = substr($requestURI,strlen("/play/"));
                echo "<link rel='image_src' href='http";
                echo $https;
                echo "://";
                echo $hostName;
                echo "/img/ROMPictures/";
                echo $gameid;
                echo ".jpg'>";
                $title .= " - ";
                $con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);
                mysql_select_db($MYSQL_DATABASE, $con);
                $title .= getGameTitle(urldecode($gameid),$con);
                mysql_close($con);
                $defaultTab = array_search("play",$tabs);
            }
            else if (strpos($requestURI,"/gameboy") === 0 || strpos($requestURI,"/nes") === 0 || strpos($requestURI,"/play") === 0){
                $title .= " - Play";
                $defaultTab = array_search("play",$tabs);
            }
            else if (strpos($requestURI,"/goPro") === 0){
                $title .= " - Go Pro";
                $defaultTab = array_search("goPro",$tabs);
            }
            else if (strpos($requestURI,"/admin") === 0){
                $title .= " - Administrative Center";
                $defaultTab = array_search("admin",$tabs);
            }
            else if (strpos($requestURI,"/help") === 0){
                $title .= " - Help";
                $defaultTab = array_search("help",$tabs);
            }

        ?>
        <?php
            if ($_GET["noui"] == true){
        ?>
        <link rel="stylesheet" type="text/css" href="/css/noui.css" />
        <?php
            } else{
        ?>
        <link rel="stylesheet" type="text/css" href="/lib/bootstrap.2.3.0/css/bootstrap.min.css" />
        <link rel="stylesheet" type="text/css" href="/lib/font-awesome.min.css" />
        <link rel="stylesheet" type="text/css" href="/css/newui.css" />
        <link rel="stylesheet" type="text/css" href="/lib/jquery-ui-1.10.3.custom.1/css/smoothness/jquery-ui-1.10.3.custom.min.css">
        <?php
            }
            echo "<script type='text/javascript'>";
            echo "window.getParams = JSON.parse(" . json_encode(json_encode($_GET)) . ");";
            echo "window.supportEmailAddress = '$SUPPORT_EMAIL_ADDRESS';";

            echo "</script>"
        ?>
        <script>
            <?php
            echo "window.configuration = {google:{clientId:'";
            echo $GOOGLE_CLIENT_OAUTH_CLIENT_ID;
            echo "',apiKey:'";
            echo $GOOGLE_CLIENT_DEVELOPER_KEY;
            echo "'},";
            echo "twitch:{";
            echo "clientId:'";
            echo $TWITCH_CLIENT_ID;
            echo "'}};";
            ?>
        </script>
        <script src="http://www.google.com/jsapi?key=AIzaSyBObarUyhNSekoMdLbUlIooxsxVEEJLHQM"></script>
        <script type="text/javascript" src="https://apis.google.com/js/plusone.js"></script>
        <script src="/lib/ircPluginWrapper.js"></script>
        <script src="/lib/jszip/jszip.js"></script>
        <script src="/lib/jszip/jszip-load.js"></script>
        <script src="/lib/jszip/jszip-inflate.js"></script>
        <script src="/lib/jszip/jszip-deflate.js"></script>
        <script src="/lib/jQuery.js"></script>
        <script src="/lib/jquery-ui-1.10.3.custom.1/js/jquery-ui-1.10.3.custom.min.js"></script>
        <script src="/lib/jquery.fullscreen.1.1.4.js"></script>
        <script src="https://ttv-api.s3.amazonaws.com/twitch.min.js"></script>
        <script src="/lib/doTimeout.1.0.js"></script>
        <script src="/lib/hogan.2.0.0.js"></script>
        <script src="/lib/bootstrap.2.3.0/js/bootstrap.min.js"></script>
        <script src="/lib/Gamepad.js"></script>
        <script src="/lib/Webcam.js"></script>
        <script src="/lib/waapisim.js"></script>
        <script src="/lib/davis.min.js"></script>
        <script src="/lib/davis.google_analytics.js"></script>
        <script src="/lib/require.js" data-main="/js/main"></script>
        <?php
            echo $ANALYTICS_TRACKING_CODE;
        ?>
        <title><?php echo $title; ?></title>
    </head>
    <body class="<?php echo $tabs[$defaultTab];?>Contained">
        <div class="container-fluid mainContainer">
            <div class="mainNavBar">
                <div class="mainNavBar-inner">
                    <ul class="nav">
                        <?php
                            for ($i = 0; $i < count($tabs); $i++){
                                echo '<li class="moduleTab';
                                echo $tabs[$i];
                                if ($i == $defaultTab){
                                    echo ' active primary';
                                }
                                if (!$tabDefaultShow[$i]){
                                    echo ' hidden';
                                }
                                echo '"><a';
                                echo ' class="link';
                                echo $tabs[$i];
                                echo '"';
                                echo ' href="javascript:void(0);" modulename="';
                                echo $tabs[$i];
                                echo '">';
                                if ($tabs[$i] == "home"){
                                    echo "<img class='mainNavBarLogo' src='/img/newgraphics/logo.png' /> Googulator";
                                    echo '<li><a href="https://plus.google.com/communities/108343287295374695153" target="_blank">Google+ Community</a></li>';
                                }
                                else{
                                    echo $tabNames[$i];
                                }
                                echo '</a></li>';
                            }
                        ?>
                    </ul>

                    <div id="googleUserInfo" style="padding-right:1rem; position:absolute; right: 0px; top: 0px;bottom: 0px;">
                        <div id="loadText" style='margin-top:3px; margin-bottom:3px;'>Loading Google Credentials...</div>
                        <button id="loadButton" class="gPlusLoginButton hidden" style="margin-right: -1rem;">
                            <span class="gPlusIcon"></span>
                            <span class="verticalDivider"></span>
                            <span class="text"> Sign In</span></button>
                    </div>
                </div>
            </div>
            <div class="adUnit" style="position: absolute; top:42px; left: 0px; height: 20px; display: inline; right: 0px; text-align: center;">
                <div style="position: absolute; left: 50%; z-index:100;">
                    <div style="position: relative; left: -50%">
                        <?php
                        echo $GOOGLE_AD_CODE;
                        ?>
                    </div>
                </div>
            </div>
            <div class="coreModuleContainer" id="coreModuleContainer">
                <?php
                $regex = '/<template id="mainDisplay">/i';
                for ($i = 0; $i < count($tabs); $i++){
                    echo '<div class="moduleContainer';
                    if ($i != $defaultTab)
                        echo " unactive";
                    echo '" id="moduleContainer';
                    echo $tabs[$i];
                    echo '">';

                    $templateFile = file_get_contents("js/modules/" . $tabs[$i] . "/template.html");
                    preg_match($regex,$templateFile,$matches,PREG_OFFSET_CAPTURE);
                    $start = $matches[0][1] + strlen($matches[0][0]);
                    $end = strpos($templateFile,"</template>",$start) - $start;
                    $templateFile = substr($templateFile,$start,$end);
                    echo $templateFile;
                    echo "</div>";
                }
                ?>
            </div>
        </div>
    </body>
</html>