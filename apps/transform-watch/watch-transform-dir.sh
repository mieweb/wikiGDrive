#!/bin/sh

set -u

THEME_ID=$(cat "/data/$1/.user_config.json" 2>/dev/null | jq --raw-output .hugo_theme.id || "anake")
THEME_URL=$(cat "/data/$1/.user_config.json" 2>/dev/null | jq --raw-output .hugo_theme.url || "https://github.com/budparr/gohugo-theme-ananke.git")

if [[ ! -d "/preview/$1/$THEME_ID" ]]
then
    mkdir -p "/preview/$1/$THEME_ID"
fi

render() {
    echo docker run -v "$VOLUME_DATA/$1_transform:/site/content" -v "$VOLUME_PREVIEW/$1/$THEME_ID:/site/public" hugo-render
    docker run \
        --env BASE_URL=$DOMAIN/preview/$THEME_ID/$1/ \
        --env THEME_ID=$THEME_ID \
        --env THEME_URL=$THEME_URL \
        --mount type=bind,source="$VOLUME_DATA/$1_transform",target=/site/content \
        --mount type=bind,source="$VOLUME_PREVIEW/$1/$THEME_ID",target=/site/public \
        $RENDER_IMAGE
}

render $1

inotifywait -qme create,modify,attrib "/data/$1_transform" | while read LINE
do
    PARAMS=$(echo $LINE | cut -d" " -f2)
    FILE=$(echo $LINE | cut -d" " -f3)

    if [ ".tree.json" = "$FILE" ]
    then
        render $1
        chown www-data:www-data -R "/preview/$1"
        date "+%s" > "/data/$1/.rendered_preview_time"
    fi
done
