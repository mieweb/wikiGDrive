---
title: wikigdrive usage
---
# Usage

## wikigdrive usage

```
$ wikigdrive <command> [args] [<options>]
```

Main commands:

```
wikigdrive config
    --client_id
    --client_secret
    --service_account=./private_key.json
    --transform_subdir=/content

wikigdrive server
    --link_mode [mdURLs|dirURLs|uglyURLs]

wikigdrive register [drive_id_or_url]
    --drive [shared drive url]
    --workdir (current working folder)

wikigdrive pull [URL to specific file]

wikigdrive watch (keep scanning for changes, ie: daemon)
```

Other commands:

```
wikigdrive status [ID of document]   - Show status of the document or stats of the entire path.
wikigdrive drives
wikigdrive sync
wikigdrive download
wikigdrive transform
```

Examples:

```
$ wikigdrive init
$ wikigdrive add https://google.drive...
```

## wikigdrive config usage

```
$ wikigdrive config [<options>]
```

Stores authentication config inside `<workdir>/auth_config.json` to avoid specifying authentication options each time 

Options:

```
--client_id GOOGLE_DRIVE_API CLIENT_ID
--client_secret GOOGLE_DRIVE_API CLIENT_SECRET
--service_account GOOGLE_DRIVE_API SERVICE_ACCOUNT_JSON file location
--transform_subdir markdown destination subdirectory
```

## wikigdrive drives usage

```
$ wikigdrive drives [<options>]
```

Displays drives available to user or service account

Examples:

```
wikigdrive drives --client_id=AAA --client_secret=BBB
wikigdrive drives --service_account=./private_key.json
```

## wikigdrive server usage

```
$ wikigdrive server [<options>]
```

Starts wikigdrive in multiuser server mode

Options:

```
--share_email Email to share drives with
--server_port Server port (default 3000)
```

Examples:

```
$ wikigdrive server --share_email=example@example.com --server_port=3000
```

## All commands

Other commands:

```
wikigdrive status
wikigdrive drives
wikigdrive sync
wikigdrive download
wikigdrive transform
```

## Common options

Options available for each command:

### Data location

```
--workdir (current working folder)
```

### Authentication

```
--client_id GOOGLE_DRIVE_API CLIENT_ID
--client_secret GOOGLE_DRIVE_API CLIENT_SECRET
--service_account GOOGLE_DRIVE_API SERVICE_ACCOUNT_JSON file location
```
