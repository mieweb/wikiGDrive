FROM node:22-bookworm-slim

ARG BUILD_UI
ARG GIT_SHA

RUN apt-get update
RUN apt-get install -yq bash git-lfs openssh-client curl unzip socat
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install
RUN npm install --location=global ts-node

RUN if [ -z "$BUILD_UI" ] ; then cd /usr/src/app/apps/ui && npm run build ; fi

COPY . ./
RUN npm link --location=user

EXPOSE 3000
VOLUME /data

RUN cd /usr/src/app/apps/ui && npm install && npm run build

WORKDIR "/usr/src/app"

# Add the GIT_SSH_COMMAND to /etc/profile so that we can debug git issues from the command line
RUN echo 'export GIT_SSH_COMMAND="ssh -i \$(pwd | sed s/_transform.*//)/.private/id_rsa"' >> /etc/profile

CMD [ "sh", "-c", "wikigdrive --workdir /data server 3000" ]
