FROM nginx:alpine
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

ADD site/ /site

VOLUME ["/site/content"]
VOLUME ["/site/public"]

RUN apk add --no-cache hugo git

RUN git init /site

COPY generate.sh /generate.sh

CMD /generate.sh
