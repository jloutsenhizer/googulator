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

$query = mysql_query("delete from gameLibrary where googleid='$google_id';",$con);

mysql_close($con);

echo "1";
?>