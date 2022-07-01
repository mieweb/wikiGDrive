#!/bin/sh

cd /site

git submodule add $THEME_URL themes/$THEME_ID

cp config.toml.example config.toml

echo "theme=\"$THEME_ID\"" >> config.toml
echo "baseURL=\"$BASE_URL\"" >> config.toml

hugo
