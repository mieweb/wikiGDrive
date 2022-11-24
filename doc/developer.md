# Developer 

[Example Google Drive Shared Folder](https://drive.google.com/drive/folders/0AIkOKXbzWCtSUk9PVA)

## Install locally

Copy and adjust .env.example .env

```
sudo apt install libkrb5-dev libssh2-1-dev

npm install

wikigdrive --workdir ~/wikigdrive --service_account ~/workspaces/mieweb/wikigdrive-with-service-account.json server 3000
```

## Domain

* wikigdrive.com (hosted by??)
* DNS SERVER?

## Authentication

### Client ID for the Web Application Add-On / Authentication
Link to production's OAUTH configuration:
https://console.cloud.google.com/apis/credentials/oauthclient/762352378313-3u5pagjnk24g9640a5j1bmlsvobtlq2k.apps.googleusercontent.com?project=wikigdrive

Stored in /home/githubactions/wikigdrive/env.prod

### This is for the Service Account
https://console.cloud.google.com/iam-admin/serviceaccounts/details/103184696095283927333?project=wikigdrive
* [Link to the keys](https://console.cloud.google.com/iam-admin/serviceaccounts/details/103184696095283927333/keys?project=wikigdrive)
* last key used is dcb0a0d690d0a5ac24b42a3f1962bf9802c36882 and is in [here](https://github.com/mieweb/wikiGDrive/blob/a0f1427018e71576d696c1b0d42a926de13854d7/.github/workflows/ProdServerDeploy.yml#L43)

## Add On Service - Google MarketPlace

This is for configuring Google Apps and their Console to permit the Google Marketplace to the store.

See [app_script](../app_script)


## Runner

The [Actions Runner](https://github.com/mieweb/wikiGDrive/settings/actions/runners/2) runs on vps1.ovh.wikigdrive.com


## wikiGDrive Server

The service runs

```
ssh -p 22121 vps1.ovh.wikigdrive.com
```

## Developer Test

* Simple Test: https://dev.wikigdrive.com/drive/0APmwe3yIhGabUk9PVA
* Complex Test: https://dev.wikigdrive.com/drive/0AF_nrE0_QH_2Uk9PVA



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
|-- .user_config.yaml
|-- .private
|   |-- id_rsa
|   `-- id_rsa.pub

/data/0APmwe3yIhGabUk9PVA_transform# tree -a
|-- .git.json
|-- .gitignore
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

Cool trick to watch changes as they happen in a document:

```
cd /var/lib/docker/volumes/wikiGDriveDevelop/_data/0APmwe3yIhGabUk9PVA
watch -d odt2txt 1WfXOsKmPgOtdsZxXdl6RpqMrlkQP2O1GrprnaFxK0oE.odt
```

Another cool trick to see diffs in images:
* https://github.com/ewanmellor/git-diff-image

