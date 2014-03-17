<?php
include "configuration.php";
include "include.php";
header('Content-Type: text/cache-manifest');
?>CACHE MANIFEST

##

#appcache modficationtime: <?php echo filemtime(__FILE__); ?>
#index modificationtime: <?php echo filemtime("index.php"); ?>
#configuration modificationtime: <?php echo filemtime("configuration.php");?>

CACHE:
<?php
outputDirectoryListing("css");
outputDirectoryListing("js");
outputDirectoryListing("lib");
outputDirectoryListing("img/icons");
outputDirectoryListing("img/html5apps");
outputDirectoryListing("img",false);
outputDirectoryListing("fonts");
?>
fonts/fontawesome-webfont.ttf?v=4.0.3 #<?php echo filemtime("fonts/fontawesome-webfont.ttf") ?>

php/titlesDB.php # <?php echo filemtime("php/titlesDB.php");//TODO: specify this in a way that doesn't depend on the php scripts modification time ?>

NETWORK:
*