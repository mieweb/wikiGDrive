FROM node:20-alpine

RUN apk add --no-cache bash openssh-keygen git-lfs openssh-client
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install
RUN npm install --location=global ts-node

COPY . ./
RUN npm link --location=user

EXPOSE 3000
VOLUME /data

RUN cp /usr/src/app/hugo/themes/wgd-bootstrap/layouts/_default/baseof.html /usr/src/app/apps/ui/index.html
RUN if [[ -d /usr/src/app/dist/hugo/ui ]]; then cp /usr/src/app/dist/hugo/ui/index.html /usr/src/app/apps/ui/index.html ; fi
RUN cd /usr/src/app/apps/ui && npm install && npm run build

WORKDIR "/usr/src/app"

CMD [ "sh", "-c", "wikigdrive --workdir /data server 3000" ]
