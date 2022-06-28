## Build

```
docker build -t hugo-render .
```

## Test

```
docker build -t hugo-render . && docker run -it -v ~/wikigdrive/0APmwe3yIhGabUk9PVA_transform:/site/content -v ~/wikigdrive-preview/0APmwe3yIhGabUk9PVA:/site/public hugo-render
```
