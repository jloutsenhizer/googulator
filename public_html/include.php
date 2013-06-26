<?
require_once "google_php/Google_Client.php";

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
?>