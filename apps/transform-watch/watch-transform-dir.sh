#!/bin/sh

set -u

if [[ ! -d "/preview/$1" ]]
then
    mkdir "/preview/$1"
fi

render() {
    echo docker run -v "$VOLUME_DATA/$1_transform:/site/content" -v "$VOLUME_PREVIEW/$1:/site/public" hugo-render
    docker run \
        --env BASE_URL=$DOMAIN/preview/$1/ \
        --mount type=bind,source="$VOLUME_DATA/$1_transform",target=/site/content \
        --mount type=bind,source="$VOLUME_PREVIEW/$1",target=/site/public \
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
    fi
done
