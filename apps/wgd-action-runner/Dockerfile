FROM node:lts-buster
MAINTAINER Grzegorz Godlewski <gg@gitgis.com>

ADD site/ /site

ENV BASE_URL=http://example.com/
ENV THEME_ID=""
ENV THEME_URL=""

VOLUME ["/site/content"]
VOLUME ["/site/public"]

RUN apt-get update
RUN apt-get install -y git nodejs python3 python3-pip
RUN pip3 install s3cmd
RUN npm i -g postcss postcss-cli hugo-extended

RUN git clone https://github.com/budparr/gohugo-theme-ananke.git /themes/ananke

RUN git init /site

ADD steps/ /steps
RUN chmod a+x /steps/step_*
