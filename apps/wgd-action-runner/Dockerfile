FROM node:22-bookworm-slim
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

ADD site/ /site

ENV BASE_URL=http://example.com/
ENV THEME_ID=""
ENV THEME_URL=""
ENV NO_COLOR="true"

RUN apt-get update
RUN apt-get install -y git nodejs curl python3 python3-pip s3cmd yq
RUN npm i -g postcss postcss-cli hugo-extended

RUN mkdir -p /gh_actions

RUN git clone https://github.com/budparr/gohugo-theme-ananke.git /themes/ananke

RUN git init /site
RUN git config --global --add safe.directory /site

ADD steps/ /steps
RUN chmod a+x /steps/step_*

WORKDIR /site
ENTRYPOINT /bin/bash
