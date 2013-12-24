drop table if exists emailUpdates;
CREATE TABLE `emailUpdates` (  `email` varchar(45) COLLATE utf8_unicode_ci NOT NULL,  PRIMARY KEY (`email`),  UNIQUE KEY `email_UNIQUE` (`email`));
drop table if exists freeGames;
CREATE  TABLE `freeGames` (`gameid` VARCHAR(100) NOT NULL , `fileName` VARCHAR(100) NULL , PRIMARY KEY (`gameid`) );
drop table if exists gameNames;
CREATE TABLE `gameNames` (  `gameid` varchar(30) NOT NULL DEFAULT '',  `name` varchar(100) DEFAULT NULL,  PRIMARY KEY (`gameid`));
drop table if exists users;
CREATE TABLE `users` (  `googleid` varchar(100) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,  `roles` varchar(500) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,  `metadataFileId` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,  PRIMARY KEY (`googleid`));



