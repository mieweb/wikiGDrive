# Developer 

[Example Google Drive Shared Folder](https://drive.google.com/drive/folders/0AIkOKXbzWCtSUk9PVA)

## Domain

* wikigdrive.com (hosted by??)
* DNS SERVER?


## Add On Service

Add On: https://google-drive-iframe.wikigdrive.com/
See [app_script](../app_script)


## Runner

The [Actions Runner](https://github.com/mieweb/wikiGDrive/settings/actions/runners/2) runs on vps1.ovh.wikigdrive.com


## wikiGDrive Server

The service runs

```
ssh -p 22121 vps1.ovh.wikigdrive.com
```

## Production Docker

```
root@wgd-dev:~# docker exec -it wikigdrive-prod bash
wikigdrive --service_account /service_account.json  drives
```

![Code Diagram](https://docs.google.com/drawings/d/e/2PACX-1vREcniLAig0DiPqSxu5QRqgiGHWL5INKfjMlqSvXK9vTbas3JqorzbuONLeTrNOD0MBPC7QB3Gd_NY7/pub?w=960&amp;h=720) [src](https://docs.google.com/drawings/d/1LSveM3s_Fmi9411FW9Z-NA50fbNHHW2y_PQo3NSUPAI/edit)


## File Structure on Server

/data (in container, but configurable on the command line)

* folders.json - a listing of each google shared folder
* One folder for each drive
  * Second folder with the same name with `_transform` on the end to hold markdown version 
* quota.json - google throttle for limited rate

```
/data# more folders.json
{
  "0APmwe3yIhGabUk9PVA": {
    "id": "0APmwe3yIhGabUk9PVA",
    "name": "A Test WikiGDrive"
  },
}

/data/0APmwe3yIhGabUk9PVA# tree -a
.
|-- .drive.json                  # delete this
|-- .folder-files.json           # Each file - coming from google API
|-- .folder.json                 # https://github.com/mieweb/wikiGDrive/blob/8609077ee14501c80acbd97a61c9fbdfbb0fc6fc/src/containers/google_folder/TaskFetchFolder.ts#L68
|-- .tree.json                   # a listin of all the files
|-- 1KZ45LytrvLZ3Np_EC_x5Uv6fy8xHLhvJyDNfC6i4xtc.odt
`-- 1wlRv3bZ5Z84TD9Oba4-lEorfV_R9aKhJyRS2iCInA7w.odt


/data/0APmwe3yIhGabUk9PVA_transform# tree -a
|-- .git.json
|-- .gitignore
|-- .private
|   |-- id_rsa
|   `-- id_rsa.pub
|-- .tree.json
|-- .wgd-directory.yaml
|-- .wgd-local-links.csv
|-- .wgd-local-log.csv
|-- example-folder
|   |-- .wgd-directory.yaml
|   `-- 1
|       |-- .wgd-directory.yaml
|       `-- 2
|           |-- .wgd-directory.yaml
|           `-- 3
|               |-- .wgd-directory.yaml
|               `-- 4
|                   |-- .wgd-directory.yaml
|                   |-- sub-folder-example-file.assets
|                   |-- sub-folder-example-file.debug.xml
|                   `-- sub-folder-example-file.md
|-- index.assets
|-- index.debug.xml
|-- index.md
|-- readme.assets
|-- readme.debug.xml
`-- readme.md

```
