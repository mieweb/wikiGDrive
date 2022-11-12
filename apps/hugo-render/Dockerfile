FROM node
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

ADD site/ /site

ENV BASE_URL=http://example.com/
ENV THEME_ID=""
ENV THEME_URL=""

VOLUME ["/site/content"]
VOLUME ["/site/public"]

RUN apk add --no-cache git nodejs npm
RUN npm i -g postcss postcss-cli hugo-extended

RUN git clone https://github.com/budparr/gohugo-theme-ananke.git /themes/ananke
RUN git clone https://github.com/mieweb/docs.git /themes/wc-eh-docs

RUN git init /site

COPY generate.sh /generate.sh

CMD /generate.sh
