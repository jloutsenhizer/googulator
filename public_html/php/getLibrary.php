<?
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

$con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);

if (!$con)
    die("-2");




if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    die("-3");
}

$query = mysql_query("select * from gameLibrary where googleid='$google_id';",$con);

$games = array();

while ($row = mysql_fetch_assoc($query)){
    $element = array();
    $element["fileId"] = $row["fileid"];
    $element["saveFileId"] = $row["savefileid"];
    $element["saveStateFileId"] = $row["savestatefileid"];
    $element["patchFileId"] = $row["patchid"];
    $element["image"] = "img/ROMPictures/" . $row["gameid"] . ".jpg";
    $element["id"] = stripslashes($row["gameid"]);
    if ($row["usergivenname"] != NULL){
        $element["title"] = $row["usergivenname"];
    }
    else{
        $element["title"] = getGameTitle($row["gameid"],$con);
    }
    $element["uid"] = $row["uid"];
    array_push($games,$element);
}

mysql_close($con);

echo str_replace('\/','/',json_encode($games));
?>