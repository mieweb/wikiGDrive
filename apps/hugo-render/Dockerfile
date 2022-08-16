FROM alpine
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

ADD site/ /site

ENV BASE_URL=http://example.com/
ENV THEME_ID=""
ENV THEME_URL=""

VOLUME ["/site/content"]
VOLUME ["/site/public"]

RUN apk add --no-cache hugo git nodejs npm
RUN npm i -g postcss postcss-cli

RUN git init /site

COPY generate.sh /generate.sh

CMD /generate.sh
