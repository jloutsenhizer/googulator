<?
header('Content-type: application/json');
require_once "../configuration.php";
require_once "../include.php";
$con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);
mysql_select_db($MYSQL_DATABASE, $con);
$q = mysql_query("select * from gameNames where 1;",$con);

$gameList = [];

while ($row = mysql_fetch_assoc($q)){
    $gameList[$row["gameid"]] = $row["name"];
}

mysql_close($con);

echo json_encode(["generated" => time(), "db" => $gameList]);

?>