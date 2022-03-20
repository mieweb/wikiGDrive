FROM node:16.14

WORKDIR /usr/src/app

COPY . .

RUN apt-get install -y libkrb5-dev
RUN npm install
RUN npm install -g ts-node
RUN npm link --local

EXPOSE 3000
VOLUME /data

WORKDIR "/usr/src/app"

CMD [ "sh", "-c", "wikigdrive-ts --workdir /data server 3000" ]
