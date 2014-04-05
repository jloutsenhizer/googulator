<?php
header('Content-type: application/json');
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




if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    $roles = ["ROLE_USER"];
    if (strcmp($PRIMARY_ADMIN_USER,$google_id) == 0){
        array_push($roles,"ROLE_ADMIN");

    }
    die(json_encode(["roles" => $roles,"websiteState" => "broken"]));
}

//this insures that the user is created in the database and has ROLE_USER at a minimum
addRole($google_id,"ROLE_USER",$con);

$userData = getUserData($google_id,$con);
mysql_close($con);
if ($userData == null){
    $roles = ["ROLE_USER"];
    if (strcmp($PRIMARY_ADMIN_USER,$google_id) == 0){
        array_push($roles,"ROLE_ADMIN");

    }
    die(json_encode(["roles" => $roles,"websiteState" => "broken"]));
}
echo json_encode($userData);

