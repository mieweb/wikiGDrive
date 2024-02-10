---
title: wikigdrivectl
---
# Usage

Command wikigdrivectl is used to control locally running wikigdrive server.

## wikigdrivectl usage

    $ wikigdrivectl <command> [args] [<options>]

Main commands:

    ps
    inspect [drive_id_or_url]

## wikigdrivectl ps

    $ wikigdrive ps

Displays all drives with a job count 

## wikigdrivectl inspect

    $ wikigdrive inspect [drive_id_or_url]

Displays jobs queue for specific drive

Examples:
    
    wikigdrive inspect http://drive.google.com/open?id=FOLDER_ID
