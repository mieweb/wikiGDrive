FROM bitmeal/nodegit:0.27-16-alpine

RUN apk add --no-cache bash openssh-keygen
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install
RUN npm link nodegit
RUN npm install --location=global ts-node

COPY . ./
RUN npm link --location=user

EXPOSE 3000
VOLUME /data

WORKDIR "/usr/src/app"

CMD [ "sh", "-c", "wikigdrive-ts --workdir /data server 3000" ]
