<?php
require_once "google_php/Google_Client.php";
require_once "configuration.php";

function getGoogleId($access_token){
    try{
        $access_token = json_decode($access_token);
        $access_token->created = $access_token->issued_at;
        $access_token->expires = $access_token->expires_at;
        $access_token = json_encode($access_token);
        $client = new Google_Client();
        $client->setScopes('https://www.googleapis.com/auth/userinfo.profile');
        $client->setAccessToken($access_token);
        $request = new Google_HttpRequest("https://www.googleapis.com/oauth2/v2/userinfo?alt=json");
        $userinfo = $client->getIo()->authenticatedRequest($request);

        $response = json_decode($userinfo->getResponseBody());
        return $response->id;
    }
    catch (Exception $e){
        return null;
    }
}

function getRoles($googleId,$con){
    $query = mysql_query("select roles from users where googleid='$googleId' limit 1;",$con);
    if ($row = mysql_fetch_assoc($query)){
        return explode("|",$row["roles"]);
    }
    return array();

}

function hasRole($googleId,$roleSearch,$con){
    $query = mysql_query("select roles from users where googleid='$googleId' limit 1;",$con);
    if ($row = mysql_fetch_assoc($query)){
        $roles = explode("|",$row["roles"]);
        foreach ($roles as $role){
            if ($role === $roleSearch)
                return true;
        }
    }
    return false;

}

function addRole($googleId,$newRole,$con){
    $query = mysql_query("select roles from users where googleid='$googleId' limit 1;",$con);
    if ($row = mysql_fetch_assoc($query)){
        $roles = explode("|",$row["roles"]);
        foreach ($roles as $role){
            if ($role === $newRole)
                return;
        }
        $roles[count($roles)] = $newRole;
        $roles = implode("|",$roles);
        mysql_query("update users set roles='$roles' where googleid='$googleId' limit 1");
    }
    else{
        mysql_query("insert into users (googleid, roles) values ('$googleId','$newRole');",$con);
    }
}

function getUserData($googleId,$con){
    $query = mysql_query("select * from users where googleid='$googleId' limit 1;",$con);
    if ($row = mysql_fetch_assoc($query)){
        $row["roles"] = explode("|",$row["roles"]);
        $query = mysql_query("select count(*) from gameLibrary where googleid='$googleId';",$con);
        if ($row2 = mysql_fetch_row($query)){
            $row["needsLibraryExport"] = $row2[0] > 0;
        }
        return $row;
    }
    else{
        return json_decode("{}");
    }
}

function getGameTitle($gameid,$con){
    $origid = $gameid;
    $gameid = mysql_real_escape_string($gameid,$con);
    $q = mysql_query("select * from gameNames where gameid='$gameid' limit 1;",$con);
    if ($r = mysql_fetch_assoc($q)){
        return $r["name"];
    }
    else{
        return $origid;
    }
}

function encodeUrlEntity($string){
    $parts = explode("/",$string);
    for ($i = 0; $i < count($parts); $i++){
        $parts[$i] = rawurlencode($parts[$i]);
    }
    return implode("/",$parts);
}

function outputDirectoryListing($directory,$recursive = true){
    if (!is_dir($directory))
        return;
    $dir = opendir($directory);
    if (substr($directory,strlen($directory) - 1,1) !== "/"){
        $directory .= "/";
    }
    while (($file = readdir($dir)) !== false){
        if (filetype($directory . $file) === "dir"){
            if ($recursive){
                if ($file !== "." && $file !== ".."){
                    outputDirectoryListing($directory . $file,true);
                }
            }
        }
        else{
            echo encodeUrlEntity($directory . $file);
            echo " #modification time: ";
            echo filemtime($directory . $file);
            echo "\n";
        }
    }
}

function sendEmail($to,$message){
    global $PREFERRED_HOSTNAME, $UPDATE_EMAIL_ADDRESS;
    $headers = 'From: ' . $UPDATE_EMAIL_ADDRESS   . "\r\n" .
        'Reply-To: ' . $UPDATE_EMAIL_ADDRESS  . "\r\n" .
        'X-Mailer: PHP/' . phpversion();;
    $message = $message . "\r\n\r\n" . "Tired of these messages? Use the following url to unsubscribe:\r\n"
        . "http://$PREFERRED_HOSTNAME/?unsubscribe=" . encodeURIComponent($to);
    return mail($to,"New Updates to Googulator",$message,$headers);
}

function encodeURIComponent($str) {
    $revert = array('%21'=>'!', '%2A'=>'*', '%27'=>"'", '%28'=>'(', '%29'=>')');
    return strtr(rawurlencode($str), $revert);
}
?>