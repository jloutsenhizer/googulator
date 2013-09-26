<?php
require_once "../configuration.php";
require_once "../include.php";

$con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);

if (!$con)
    die("-2");

if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    die("-3");
}

$query = mysql_query("select googleid from gameLibrary where 1;",$con);
$used = array();

while ($row = mysql_fetch_assoc($query)){
    if (isset($used[$row["googleid"]])){
        continue;
    }
    $used[$row['googleid']] = true;
    addRole($row['googleid'],"ROLE_USER",$con);
}

addRole('116661379917790523031',"ROLE_ADMIN",$con);
mysql_close($con);
die("1");