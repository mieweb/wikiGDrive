#!/bin/sh

set -u

MAIN_DIR=$1
PREVIEW_DIR=$2
PARENT_PID=$$

start_watching() {
    DRIVE_ID=$(basename $1 | sed "s/_transform$//")
    TRANSFORM_PID=$(ps -f -a | grep watch-transform | grep "$DRIVE_ID$" | sed -e 's/^[ \t]*//' | cut -d" " -f1)

    if [[ -z "$TRANSFORM_PID" ]]
    then
        echo "Start watching $1 -> $PREVIEW_DIR/$DRIVE_ID"
        /watch-transform-dir.sh "$DRIVE_ID" &
    fi
}

stop_watching() {
    DRIVE_ID=$(basename $1 | sed "s/_transform$//")
    TRANSFORM_PID=$(ps -f -a | grep watch-transform | grep "$DRIVE_ID_ID$" | sed -e 's/^[ \t]*//' | cut -d" " -f1)

    if [[ ! -z "$TRANSFORM_PID" ]]
    then
        echo "Stop watching $DRIVE_ID"
        kill -9 $TRANSFORM_PID
    fi
}


ls -d $MAIN_DIR/* | grep _transform$ | while read FULL_PATH
do
    start_watching $FULL_PATH
done

inotifywait -qme create,delete $MAIN_DIR | while read LINE
do
    PARAMS=$(echo $LINE | cut -d" " -f2)
    SUB_DIR=$(echo $LINE | cut -d" " -f3)
    FULL_PATH=$(echo $MAIN_DIR/$SUB_DIR)

    if [[ ! -z "$(echo $PARAMS | grep ^CREATE,ISDIR )" ]] && [[ ! -z "$(echo $FULL_PATH | grep transform$ )" ]]
    then
        start_watching $FULL_PATH
    fi
    if [[ ! -z "$(echo $PARAMS | grep ^DELETE,ISDIR )" ]]
    then
        stop_watching $FULL_PATH
    fi
done
