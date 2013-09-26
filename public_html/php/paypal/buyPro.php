<?php
require_once "include.php";
require_once "../../configuration.php";
require_once "../../include.php";

if ($AUTO_ESCAPE){
    $google_token = stripslashes($_POST["googleToken"]);
}
else{
    $google_token = $_POST["googleToken"];
}
$google_id = getGoogleId($google_token);

if ($google_id == null || $_POST["payAmount"] < 5){
    header("HTTP/1.1 307 Temporary Redirect");
    header("Location: http://$PREFERRED_HOSTNAME/goPro");
    die;
}
session_start();
$paymentObject = createPaypalPayment(getpayPalAccessToken(), getPaymentDataObject("http://$PREFERRED_HOSTNAME/goPro?finishPurchase=true&googleid=$google_id","http://$PREFERRED_HOSTNAME/goPro",$_POST["payAmount"],"USD","PWYW Lifetime Googulator Pro","Lifetime Googulator Pro"));

foreach($paymentObject->links as $link){
    if ($link->rel == "approval_url"){
        $redirectUrl = $link->href;
        break;
    }
}

$id = $paymentObject->id;
$_SESSION["paypalPaymentId"] = $id;

header("HTTP/1.1 307 Temporary Redirect");
header("Location: $redirectUrl");