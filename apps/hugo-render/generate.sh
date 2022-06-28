#!/bin/sh

cd /site

git submodule add https://github.com/theNewDynamic/gohugo-theme-ananke.git themes/ananke

cp config.toml.example config.toml

hugo
