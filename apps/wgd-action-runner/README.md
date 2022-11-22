## Build

```
docker build -t wgd-action-runner .
```

## Test

```
docker build -t wgd-action-runner . && docker run -it -v ~/wikigdrive/0APmwe3yIhGabUk9PVA_transform:/site/content -v ~/wikigdrive-preview/0APmwe3yIhGabUk9PVA:/site/public wgd-action-runner
```
