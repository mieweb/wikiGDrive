#!/bin/sh

#unzip -j $1 content.xml -d $1.xml
unzip -p $1 content.xml | xmllint --format - > $1.xml



