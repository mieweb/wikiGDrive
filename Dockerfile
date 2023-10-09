FROM node:18-alpine

RUN apk add --no-cache bash openssh-keygen git-lfs openssh-client
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install
RUN npm install --location=global ts-node

COPY . ./
RUN npm link --location=user

EXPOSE 3000
VOLUME /data

RUN cd /usr/src/app/apps/ui && npm install && npm run build

WORKDIR "/usr/src/app"

CMD [ "sh", "-c", "wikigdrive --workdir /data server 3000" ]
