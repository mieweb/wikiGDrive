# Usage

## wikigdrive usage

$ wikigdrive <command> [args] [<options>]

Main commands:

    wikigdrive config
        --client_id
        --client_secret
        --service_account=./private_key.json

    wikigdrive service 

    wikigdrive add [folder_id_or_url]
        --drive [shared drive url]
        --workdir (current working folder)
        --link_mode [mdURLs|dirURLs|uglyURLs]

    wikigdrive pull [URL to specific file]

    wikigdrive watch (keep scanning for changes, ie: daemon)

Other commands:

    wikigdrive status [ID of document]   - Show status of the document or stats of the entire path.
    wikigdrive drives
    wikigdrive sync
    wikigdrive download
    wikigdrive transform

Options:
--workdir (current working folder)

Examples:
$ wikigdrive init
$ wikigdrive add https://google.drive...

## wikigdrive drives usage

$ wikigdrive drives [<options>]

Options:

    --client_id GOOGLE_DRIVE_API CLIENT_ID
    --client_secret GOOGLE_DRIVE_API CLIENT_SECRET
    --service_account GOOGLE_DRIVE_API SERVICE_ACCOUNT_JSON file location

Examples:
    
    wikigdrive drives --client_id=AAA --client_secret=BBB
    wikigdrive drives --service_account=./private_key.json

## All commands

Other commands:

    wikigdrive status
    wikigdrive drives
    wikigdrive sync
    wikigdrive download
    wikigdrive transform
