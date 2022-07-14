## Build

```
docker build -t transform-watch .
```

## Test

```
docker build -t transform-watch . && docker run -it -v /var/run/docker.sock:/var/run/docker.sock -v ~/wikigdrive:/data -v ~/wikigdrive-preview:/preview -e VOLUME_DATA=~/wikigdrive -e VOLUME_PREVIEW=~/wikigdrive-preview transform-watch
```
