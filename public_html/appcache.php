<?
include "configuration.php";
include "include.php";
header('Content-Type: text/cache-manifest');
?>CACHE MANIFEST

#appcache modficationtime: <?echo filemtime(__FILE__); ?>
#index modificationtime: <?echo filemtime("index.php"); ?>
#configuration modificationtime: <?echo filemtime("configuration.php");?>

CACHE:
<?
outputDirectoryListing("css");
outputDirectoryListing("js");
outputDirectoryListing("lib");
outputDirectoryListing("img/icons");
outputDirectoryListing("img/html5apps");
outputDirectoryListing("img",false);
?>

NETWORK:
*