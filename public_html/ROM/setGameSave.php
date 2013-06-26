<?php
header('Content-type: application/json');
//die("1");
require_once "../configuration.php";
require_once "../include.php";

if ($AUTO_ESCAPE){
    $google_token = stripslashes($_GET["googletoken"]);
}
else{
    $google_token = $_GET["googletoken"];
}
$google_id = getGoogleId($google_token);

if ($google_id == null){
    die("-1");
}

$con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);

if (!$con)
    die("-2");

if ($AUTO_ESCAPE){
    $game_id = $_GET["gameid"];
    $file_id = $_GET["fileid"];
    $save_id = $_GET["saveid"];
    $patch_id = $_GET["patchid"];
}
else{
    $game_id = mysql_real_escape_string($_GET["gameid"],$con);
    $file_id = mysql_real_escape_string($_GET["fileid"],$con);
    $save_id = mysql_real_escape_string($_GET["saveid"],$con);
    $patch_id = mysql_real_escape_string($_GET["patchid"],$con);
}



if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    die("-3");
}

mysql_query("update gameLibrary set savefileid='$save_id' where googleid='$google_id' and gameid='$game_id' and fileid='$file_id' and patchid='$patch_id' limit 1;",$con);

if (mysql_affected_rows($con) != 1){
    mysql_close($con);
    die("-4");
}
mysql_close($con);
die("1");