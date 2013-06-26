<?
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
    $patch_id = $_GET["patchid"];
}
else{
    $game_id = mysql_real_escape_string($_GET["gameid"],$con);
    $file_id = mysql_real_escape_string($_GET["fileid"],$con);
    $patch_id = mysql_real_escape_string($_GET["patchid"],$con);
}




if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    die("-3");
}

$query = mysql_query("select * from gameLibrary where googleid='$google_id' and gameid='$game_id' and fileid='$file_id' and patchid='$patch_id' limit 1;",$con);

if (mysql_num_rows($query) != 0){
    mysql_close($con);
    die("-4");
}

if (mysql_query("insert into gameLibrary (googleid, gameid, fileid, patchid) values ('$google_id', '$game_id', '$file_id','$patch_id');")){
    mysql_close($con);
    die("1");
}
else{
    mysql_close($con);
    die("-5");
}
?>