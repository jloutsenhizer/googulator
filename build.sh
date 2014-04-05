#!/bin/bash

node r.js -o app.build.js
rm public_html_optimized/build.txt #clean up build log
#java -classpath js.jar:compiler.jar org.mozilla.javascript.tools.shell.Main r.js -o app.build.js