---
title: Developer Guide
navWeight: -15
---
# Developer Guide

See [Node setup on the system](#node-setup-on-the-system) for prereq.

[Example Google Drive Shared Folder](https://drive.google.com/open?id=0AIkOKXbzWCtSUk9PVA)

# Node setup on the system

## using OS

```
curl -sL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install nodejs
```

## If you wish to support multiple versions, add n

```
sudo npm install -g n
sudo n 22.10.0
```

## Version Strategy
* We use labels to set the version number based on https://github.com/marketplace/actions/create-tag-release
* See background info: https://github.com/mieweb/wikiGDrive/issues/297
  

## Install locally

Copy and adjust .env.example .env

```
sudo apt install libkrb5-dev libssh2-1-dev

npm install

wikigdrive --workdir ~/wikigdrive --service_account ~/workspaces/mieweb/wikigdrive-with-service-account.json --share_email mie-docs-wikigdrive@wikigdrive.iam.gserviceaccount.com server 3000
```

## Running locally with docker

```
export VOLUME_DATA=~/wikigdrive
export VOLUME_PREVIEW=~/wikigdrive_html

# Create some dir for wikigdrive data
mkdir -p $VOLUME_DATA
# Create some dir for wikigdrive rendered html files
mkdir -p $VOLUME_PREVIEW

# Running zipkin is an option
docker run --name zipkin -d -p 9411:9411 --restart unless-stopped openzipkin/zipkin

# Build action runner
docker build -t wgd-action-runner apps/wgd-action-runner

# Build hugo docs
docker run \
        -v ~/workspaces/mieweb/wikiGDrive/hugo:/site \
        -v ~/workspaces/mieweb/wikiGDrive/website:/website \
        -v $VOLUME_PREVIEW/docs:/dist/hugo \
        --env CONFIG_TOML="/site/config/_default/config.toml" --env BASE_URL="https://localhost:3000" \
        wgd-action-runner /steps/step_render_hugo

# Build wikigdrive
docker build -t wikigdrive .

# Run wikigdrive
docker run --rm --user=$(id -u):$(getent group docker | cut -d: -f3) -it \
        -v $VOLUME_DATA:/srv/wikigdrive \
        -v $VOLUME_PREVIEW:$VOLUME_PREVIEW \
        -v $VOLUME_PREVIEW/docs:/usr/src/app/dist/hugo \
        -v ~/workspaces/mieweb/wikigdrive-with-service-account.json:/service_account.json \
        -v ~/workspaces/mieweb/wikiGDrive:/usr/src/app \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v /var/run/podman/podman.sock:/var/run/podman/podman.sock \
        -e VOLUME_DATA=$VOLUME_DATA \
        -e VOLUME_PREVIEW=$VOLUME_PREVIEW \
        --link zipkin:zipkin \
        --publish 127.0.0.1:3000:3000 \
        --publish 127.0.0.1:24678:24678 \
        --name wikigdrive-develop \
        wikigdrive \
        ./src/wikigdrive.sh --watch-path /usr/src/app/src --service_account /service_account.json --share_email mie-docs-wikigdrive@wikigdrive.iam.gserviceaccount.com --workdir /srv/wikigdrive server 3000

# Stop wikigdrive
docker rm -f wikigdrive

# 24678 - vite hot reload port
```


## Domain

* wikigdrive.com (hosted by??)
* DNS SERVER?

## Authentication

### Client ID for the Web Application Add-On / Authentication

Link to production's OAUTH configuration: https://console.cloud.google.com/apis/credentials/oauthclient/762352378313-3u5pagjnk24g9640a5j1bmlsvobtlq2k.apps.googleusercontent.com?project=wikigdrive

Stored in /home/wikigdrive/env.prod

### This is for the Service Account
https://console.cloud.google.com/iam-admin/serviceaccounts/details/103184696095283927333?project=wikigdrive
* [Link to the keys](https://console.cloud.google.com/iam-admin/serviceaccounts/details/103184696095283927333/keys?project=wikigdrive)
* last key used is dcb0a0d690d0a5ac24b42a3f1962bf9802c36882 and is in [here](https://github.com/mieweb/wikiGDrive/blob/a0f1427018e71576d696c1b0d42a926de13854d7/.github/workflows/ProdServerDeploy.yml#L43)

## Add On Service - Google MarketPlace

This is for configuring Google Apps and their Console to permit the Google Marketplace to the store.

See folder `/apps/app-script` in the sources


## Runner

The [Actions Runner](https://github.com/mieweb/wikiGDrive/settings/actions/runners/2) runs on vps1.ovh.wikigdrive.com


## wikiGDrive Server

```
ssh 184.175.182.25
```

[Google Doc Setup Documentation](https://docs.google.com/document/d/1bocGgqktgEydxYDdP4ewdC-XOQ7lzawB_WgPqA2BILA/edit)

## Developer Test

* Simple Test: https://dev.wikigdrive.com/drive/0APmwe3yIhGabUk9PVA
* Complex Test: https://dev.wikigdrive.com/drive/0AF_nrE0_QH_2Uk9PVA



## Production Docker

```
root@wgd-dev:~# docker exec -it wikigdrive-prod bash
wikigdrive --service_account /service_account.json  drives
```

![Code Diagram](https://docs.google.com/drawings/d/e/2PACX-1vREcniLAig0DiPqSxu5QRqgiGHWL5INKfjMlqSvXK9vTbas3JqorzbuONLeTrNOD0MBPC7QB3Gd_NY7/pub?w=960&h=720) [src](https://docs.google.com/drawings/d/1LSveM3s_Fmi9411FW9Z-NA50fbNHHW2y_PQo3NSUPAI/edit)

Cool trick to watch changes as they happen in a document:

```
cd /var/lib/docker/volumes/wikiGDriveDevelop/_data/0APmwe3yIhGabUk9PVA
watch -d odt2txt 1WfXOsKmPgOtdsZxXdl6RpqMrlkQP2O1GrprnaFxK0oE.odt
```

Another cool trick to see diffs in images:
* https://github.com/ewanmellor/git-diff-image

## Zipkin telemetry setup

Start zipkin with:

```
docker run --name zipkin -d -p 9411:9411 --restart unless-stopped openzipkin/zipkin
```

Set app env var to:

```
ZIPKIN_URL=http://localhost:9411
```

## Debugging

```
./src/wikigdrive.sh --inspect --workdir ~/wikigdrive --service_account ~/workspaces/mieweb/wikigdrive-with-service-account.json --share_email mie-docs-wikigdrive@wikigdrive.iam.gserviceaccount.com server 3000
```

Chrome

```
Go to `chrome://inspect`
```

Visual Studio Code 1.10+

```
In the Debug panel, click the settings icon to open .vscode/launch.json. Select "Node.js" for initial setup.
```

JetBrains WebStorm and other JetBrains IDEs

```
Create a new Node.js debug configuration and hit Debug. --inspect will be used by default for Node.js 7+. To disable uncheck js.debugger.node.use.inspect in the IDE Registry. To learn more about running and debugging Node.js in WebStorm and other JetBrains IDEs, check out WebStorm online help.
```
