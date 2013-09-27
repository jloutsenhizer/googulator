<?php
header('Content-type: application/json');
require_once "include.php";
require_once "../../configuration.php";
require_once "../../include.php";
session_start();


$con = mysql_connect('localhost', $MYSQL_USERNAME, $MYSQL_PASSWORD);

if (!$con)
    die("-2");

if (!mysql_select_db($MYSQL_DATABASE, $con)){
    mysql_close($con);
    die("-3");
}

if (!hasRole($_GET["googleid"],"ROLE_USER",$con)){
    mysql_close($con);
    die("-4");
}





$paymentObject = executePayment(getPaypalAccessToken(),$_SESSION["paypalPaymentId"],$_GET["PayerID"]);
if ($paymentObject->state === "approved"){
    addRole($_GET["googleid"],"ROLE_PRO",$con);//grant user pro
    echo json_encode($paymentObject);
}
else{
    echo "-1";
}
unset($_SESSION["paypalPaymentId"]);
mysql_close($con);