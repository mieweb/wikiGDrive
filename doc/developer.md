# Developer 


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

![Code Diagram](https://user-images.githubusercontent.com/6094599/158036344-677c49b7-7cbb-4888-9b32-c5ad1408d683.svg) [src](https://docs.google.com/drawings/d/1LSveM3s_Fmi9411FW9Z-NA50fbNHHW2y_PQo3NSUPAI/edit)
