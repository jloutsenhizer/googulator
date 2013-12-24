<?php
header('Content-type: application/json');
require_once "../../configuration.php";
require_once "../../include.php";

if ($AUTO_ESCAPE){
    $google_token = stripslashes($_GET["googletoken"]);
}
else{
    $google_token = $_GET["googletoken"];
}
$google_id = getGoogleId($google_token);

$con = mysql_connect($MYSQL_HOSTNAME, $MYSQL_USERNAME, $MYSQL_PASSWORD);
mysql_select_db($MYSQL_DATABASE, $con);

if (hasRole($google_id,"ROLE_ADMIN",$con)){
    $query = mysql_query("select count(*) from emailUpdates;",$con);
    if ($row = mysql_fetch_row($query)){
        echo json_encode(["status"=>"success","numEmails" => $row[0]]);
    }
    else{
        echo json_encode(["status"=>"failed","error"=>"SERVER_ERROR"]);
    }

}
else{
    echo json_encode(["status"=>"failed","error"=>"PERMISSION_DENIED"]);
}
mysql_close($con);