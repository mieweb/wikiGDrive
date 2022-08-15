#!/bin/sh

cd /site

if [[ ! -z $THEME_ID ]]
then
  echo "Using theme $THEME_URL $THEME_SUBPATH"

  git clone $THEME_URL themes/$THEME_ID

  if [[ ! -z "$THEME_SUBPATH" ]]
  then
      mv themes/$THEME_ID/$THEME_SUBPATH/* themes/$THEME_ID
  fi
fi

cat /site/tmp_dir/config.toml

hugo --config=/site/tmp_dir/config.toml --verbose
