FROM node:22-bookworm-slim
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

RUN mkdir /site
#ADD site/ /site

ENV BASE_URL=http://example.com/
ENV THEME_ID=""
ENV THEME_URL=""
ENV NO_COLOR="true"

RUN apt-get update
RUN apt-get install -y git nodejs curl
RUN npm i -g postcss postcss-cli hugo-extended

RUN git clone https://github.com/budparr/gohugo-theme-ananke.git /themes/ananke

RUN git init /site
RUN git config --global --add safe.directory /site

ADD gh_actions/ /gh_actions

# Some useful actions
RUN git clone --depth 1 --branch v3 https://github.com/cloudflare/wrangler-action /gh_actions/cloudflare/wrangler-action@v3

RUN apt-get clean autoclean
RUN apt-get autoremove --yes
RUN rm -rf /var/lib/{apt,dpkg,cache,log}/

WORKDIR /site
ENTRYPOINT /bin/bash
