FROM node:16

WORKDIR /usr/src/app

COPY . .

RUN npm install
RUN npm link --local

EXPOSE 3000
VOLUME ["/data"]

CMD [ "sh", "-c", "wikigdrive-ts watch --server 3000 --disable-progress --dest /data" ]
