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

$mysql_connection = new mysqli($MYSQL_HOSTNAME, $MYSQL_USERNAME, $MYSQL_PASSWORD, $MYSQL_DATABASE);

if ($mysql_connection->connect_error)
  die("-2");

if ($AUTO_ESCAPE){
  $id = $_GET["id"];
}
else{
  $id = mysql_real_escape_string($_GET["id"],$con);
}

if (!$mysql_connection->query("update users set metadataFileId='$id' where googleid='$google_id' limit 1;")) {
  $mysql_connection->close();
  die("-4");
}

$mysql_connection->close();
die(json_encode(["success" => "true"]));