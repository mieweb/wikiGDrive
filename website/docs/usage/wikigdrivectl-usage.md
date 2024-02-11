---
title: wikigdrivectl usage
---
# Usage

Command wikigdrivectl is used to control locally running wikigdrive server.

## wikigdrivectl usage

```
$ wikigdrivectl <command> [args] [<options>]
```

Main commands:

```
wikigdrivectl ps
wikigdrivectl inspect [drive_id_or_url]
```

## wikigdrivectl ps

```
$ wikigdrivectl ps
```

Displays all drives with a job count 

## wikigdrivectl inspect

```
$ wikigdrivectl inspect [drive_id_or_url]
```

Displays jobs queue for specific drive

Examples:

```
wikigdrivectl inspect http://drive.google.com/open?id=FOLDER_ID
```
