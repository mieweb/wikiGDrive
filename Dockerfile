FROM bitmeal/nodegit:0.27-18-alpine

RUN apk add --no-cache bash openssh-keygen
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install
RUN ln -sf /usr/local/lib/node_modules/nodegit/ /usr/src/app/node_modules/nodegit
RUN npm install --location=global ts-node

COPY . ./
RUN npm link --location=user

EXPOSE 3000
VOLUME /data

WORKDIR "/usr/src/app"

CMD [ "sh", "-c", "wikigdrive-ts --workdir /data server 3000" ]
