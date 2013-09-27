<?php
require_once "../../configuration.php";


if ($PAYPAL_SANDBOX)
    $PAYPAL_HOST = "api.sandbox.paypal.com";
else
    $PAYPAL_HOST = "api.paypal.com";


function getPaymentDataObject($return_url, $cancel_url, $amount, $currency, $description, $item_name, $item_sku){
    return '{"intent":"sale","redirect_urls":{"return_url":"' . $return_url . '","cancel_url":"' . $cancel_url .'"},'
            . '"payer":{"payment_method":"paypal"}, "transactions":[{"amount":{"total":"' . $amount . '", "currency":"' . $currency . '"},"description":"' . $description . '",'
            . '"item_list":{"items":[{"quantity":"1","sku":"' . $item_sku . '","name":"' . $item_name . '","price":"' . $amount . '","currency":"' . $currency . '"}]}}]}';
}


function getPaypalAccessToken(){
    global $PAYPAL_HOST, $PAYPAL_CLIENTID, $PAYPAL_SECRET;
    $request = curl_init("https://$PAYPAL_HOST/v1/oauth2/token");

    curl_setopt($request, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($request, CURLOPT_USERPWD, "$PAYPAL_CLIENTID:$PAYPAL_SECRET");
    curl_setopt($request, CURLOPT_POSTFIELDS, "grant_type=client_credentials");
    $result = json_decode(curl_exec($request));
    curl_close($request);
    return $result->access_token;
}

function createPaypalPayment($accessToken, $paymentData){
    global $PAYPAL_HOST;
    $request = curl_init("https://$PAYPAL_HOST/v1/payments/payment");
    curl_setopt($request, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($request, CURLOPT_HTTPHEADER, Array("Content-Type: application/json","Authorization: Bearer $accessToken"));
    curl_setopt($request, CURLOPT_POSTFIELDS,$paymentData);
    $result = json_decode(curl_exec($request));
    curl_close($request);
    return $result;
}

function executePayment($accessToken, $paymentId, $payerId){
    global $PAYPAL_HOST;
    $request = curl_init("https://$PAYPAL_HOST/v1/payments/payment/$paymentId/execute/");
    curl_setopt($request,CURLOPT_POST,true);
    curl_setopt($request, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($request, CURLOPT_HTTPHEADER, Array("Content-Type: application/json","Authorization: Bearer $accessToken"));
    curl_setopt($request, CURLOPT_POSTFIELDS,"{\"payer_id\":\"$payerId\"}");
    $result = json_decode(curl_exec($request));
    curl_close($request);
    return $result;

}