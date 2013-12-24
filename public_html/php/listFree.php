<?php
header('Content-type: application/json');
require_once "../configuration.php";
require_once "../include.php";
$con = mysql_connect($MYSQL_HOSTNAME, $MYSQL_USERNAME, $MYSQL_PASSWORD);

if (!$con)
    die("-1");

if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    die("-2");
}

$query = mysql_query("select * from freeGames where 1;",$con);

$games = array();

while ($row = mysql_fetch_assoc($query)){
    $element = array();
    if ($row["fileName"] === "" || $row["fileName"] == NULL){
        $element["fileName"] = NULL;
        $element["path"] = NULL;
    }
    else{
        $element["fileName"] = $row["fileName"];
        $element["path"] = "ROM/" . $row["fileName"];
    }
    $element["image"] = "img/ROMPictures/" . $row["gameid"] . ".png";
    $element["id"] = $row["gameid"];
    $element["title"] = getGameTitle($row["gameid"],$con);
    array_push($games,$element);
}

mysql_close($con);

echo str_replace('\/','/',json_encode($games));

?>