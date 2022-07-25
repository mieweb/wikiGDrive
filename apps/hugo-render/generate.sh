#!/bin/sh

cd /site

echo "Using theme $THEME_URL $THEME_SUBPATH"

git clone $THEME_URL themes/$THEME_ID

if [[ ! -z "$THEME_SUBPATH" ]]
then
    mv themes/$THEME_ID/$THEME_SUBPATH/* themes/$THEME_ID
fi

hugo --config=/site/tmp_dir/config.toml --verbose
