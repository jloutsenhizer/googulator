<?php
require_once "../configuration.php";
require_once "../include.php";

if ($AUTO_ESCAPE){
    $google_token = stripslashes($_GET["googletoken"]);
}
else{
    $google_token = $_GET["googletoken"];
}
$google_id = getGoogleId($google_token);

$con = mysql_connect($MYSQL_HOSTNAME, $MYSQL_USERNAME, $MYSQL_PASSWORD);
mysql_select_db($MYSQL_DATABASE, $con);

if (true || hasRole($google_id,"ROLE_ADMIN",$con)){
    $query = mysql_query("select * from emailUpdates where 1;",$con);
    while ($row = mysql_fetch_assoc($query)){
        sendEmail($row["email"],$_GET["message"]);
    }
    echo json_encode(["result" => "success"]);
}
else{
    echo json_encode(["result" => "unauthorized"]);
}