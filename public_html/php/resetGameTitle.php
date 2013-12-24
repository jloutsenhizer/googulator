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

$con = mysql_connect($MYSQL_HOSTNAME, $MYSQL_USERNAME, $MYSQL_PASSWORD);

if (!$con)
    die("-2");

if ($AUTO_ESCAPE){
    $uid = $_GET["uid"];
}
else{
    $uid = mysql_real_escape_string($_GET["uid"],$con);
}



if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    die("-3");
}

mysql_query("update gameLibrary set usergivenname=NULL where googleid='$google_id' and uid=$uid limit 1;",$con);

if (mysql_affected_rows($con) != 1){
    mysql_close($con);
    die("-4");
}
$row = mysql_fetch_assoc(mysql_query("select * from gameLibrary where googleid='$google_id' and uid=$uid limit 1;",$con));
echo "{\"title\":\"";
echo getGameTitle($row["gameid"],$con);
echo "\"}";
mysql_close($con);