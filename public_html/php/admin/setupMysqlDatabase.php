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

if ($google_id == null){
    die("-1");
}

//we know this is a valid token, now we need to confirm it's the primary administrator
if (strcmp($PRIMARY_ADMIN_USER,$google_id) != 0){
    //we can also try checking the database to see if this user is set as an administrator
    //during this process we have to check for errors all along the way in case the database isn't there or is broken
    $sql = mysql_connect($MYSQL_HOSTNAME, $MYSQL_USERNAME, $MYSQL_PASSWORD);
    if (mysqli_connect_errno()) {
        die(json_encode(["status"=>"failed","error"=>"PERMISSION_DENIED"]));
    }
    if (!mysql_select_db($MYSQL_DATABASE, $sql)){
        mysql_close($sql);
        die(json_encode(["status"=>"failed","error"=>"PERMISSION_DENIED"]));
    }

    if (!hasRole($google_id,"ROLE_ADMIN",$sql)){
        mysql_close($sql);
        die(json_encode(["status"=>"failed","error"=>"PERMISSION_DENIED"]));
    }
    mysql_close($sql);
}

$sql = new mysqli($MYSQL_HOSTNAME,$MYSQL_USERNAME,$MYSQL_PASSWORD);

if (mysqli_connect_errno()) {
    die(json_encode(["status"=>"failed","error"=>"MYSQL_CONFIG_ERROR"]));
}

if (!$sql->select_db($MYSQL_DATABASE)){
    $sql->query("create schema $MYSQL_DATABASE default character set utf8mb4 collate utf8mb4_unicode_ci;");
    if (!$sql->select_db($MYSQL_DATABASE)){
        $sql->close();
        die(json_encode(["status"=>"failed","error"=>"MYSQL_SCHEMA_CREATE_FAIL"]));
    }
}



//schema exists and now we need to create the necessary tables
$queries = explode(";",file_get_contents("db/resetServer.sql"));
foreach ($queries as $query){
    $sql->query($query . ";");
}

$queries = explode(";",file_get_contents("db/gameNames.sql"));
foreach ($queries as $query){
    $sql->query($query . ";");
}

$queries = explode(";",file_get_contents("db/freeGames.sql"));
foreach ($queries as $query){
    $sql->query($query . ";");
}

$queries = explode(";",file_get_contents("db/dbUpdate01.sql"));
foreach ($queries as $query){
    $sql->query($query . ";");
}

$queries = explode(";",file_get_contents("db/dbUpdate02.sql"));
foreach ($queries as $query){
    $sql->query($query . ";");
}



$sql->close();

touch("../../appcache.php");//force cache referesh



echo json_encode(["status"=>"success"]);

