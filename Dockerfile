FROM node:16.15

WORKDIR /usr/src/app

RUN apt-get install -y libkrb5-dev

COPY package.json ./
RUN npm install
RUN npm install -g ts-node

COPY . ./
RUN npm link --local

EXPOSE 3000
VOLUME /data

WORKDIR "/usr/src/app"

CMD [ "sh", "-c", "wikigdrive-ts --workdir /data server 3000" ]
