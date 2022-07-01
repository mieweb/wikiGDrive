FROM nginx:alpine
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

ADD site/ /site

ENV BASE_URL=http://example.com/
ENV THEME_ID=ananke
ENV THEME_URL=https://github.com/budparr/gohugo-theme-ananke.git

VOLUME ["/site/content"]
VOLUME ["/site/public"]

RUN apk add --no-cache hugo git

RUN git init /site

COPY generate.sh /generate.sh

CMD /generate.sh
