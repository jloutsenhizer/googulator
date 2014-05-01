#!/bin/bash

node r.js -o app.build.js
rm public_html_optimized/build.txt #clean up build log

#symlink directories that don't get any modifications
rm -rf public_html_optimized/php
ln -s ../public_html/php public_html_optimized/php

rm -rf public_html_optimized/ROM
ln -s ../public_html/ROM public_html_optimized/ROM

rm -rf public_html_optimized/img
ln -s ../public_html/img public_html_optimized/img

rm -rf public_html_optimized/fonts
ln -s ../public_html/fonts public_html_optimized/fonts

#symlink all files of filetypes that don't get any modifications
find public_html_optimized | while read FILE; do
if [ "${FILE##*.}" = "php" ] || [ "${FILE##*.}" = "ico" ] || [ "${FILE##*.}" = "htaccess" ] || [ "${FILE##*.}" = "html" ] || [ "${FILE##*.}" = "png" ] || [ "${FILE##*.}" = "swf" ] || [ "${FILE##*.}" = "gif" ]
then
number_of_occurrences=$(grep -o "/" <<< "${FILE##*public_html_optimized/}" | wc -l)
LINKLOCATION="../public_html/${FILE##*public_html_optimized/}"
for ((c = 0; c < number_of_occurrences; c++))
do
    LINKLOCATION="../$LINKLOCATION"
done
rm "$FILE"
ln -s "$LINKLOCATION" "$FILE";
fi
done;

#java -classpath js.jar:compiler.jar org.mozilla.javascript.tools.shell.Main r.js -o app.build.js