FROM nginx:alpine
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

VOLUME ["/data"]
VOLUME ["/preview"]

ENV VOLUME_DATA=/data
ENV VOLUME_PREVIEW=/preview
ENV RENDER_IMAGE=hugo-render

RUN apk add --no-cache inotify-tools docker-cli

COPY watch-main-dir.sh /watch-main-dir.sh
COPY watch-transform-dir.sh /watch-transform-dir.sh
RUN chmod +x /watch*dir.sh
CMD /watch-main-dir.sh /data /preview
