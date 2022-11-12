FROM node:lts-buster
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

ADD site/ /site

ENV BASE_URL=http://example.com/
ENV THEME_ID=""
ENV THEME_URL=""

VOLUME ["/site/content"]
VOLUME ["/site/public"]

RUN apt update && apt install -y git nodejs npm
RUN npm i -g postcss postcss-cli hugo-extended

RUN git clone https://github.com/budparr/gohugo-theme-ananke.git /themes/ananke

RUN git init /site

COPY generate.sh /generate.sh

CMD /generate.sh
