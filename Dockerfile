FROM node:22-bookworm-slim

ARG BUILD_UI
ARG GIT_SHA
EXPOSE 3000
VOLUME /data
WORKDIR /usr/src/app

RUN apt-get update
RUN apt-get install -yq bash git-lfs openssh-client curl unzip socat podman-remote
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

COPY package.json package-lock.json ./
COPY deno.json deno.lock ./
#RUN npm install
#RUN npm install --location=global ts-node

COPY . ./

RUN deno install
#RUN if [ -z "$BUILD_UI" ] ; then cd /usr/src/app/apps/ui && npm run build ; fi
#RUN npm link --location=user
RUN ln -sf /usr/src/app/src/wikigdrive.sh /usr/local/bin/wikigdrive
RUN ln -sf /usr/src/app/src/wikigdrivectl.sh /usr/local/bin/wikigdrivectl

RUN npm install && npm run build --workspaces

WORKDIR "/usr/src/app"

# Add the GIT_SSH_COMMAND to /etc/profile so that we can debug git issues from the command line
RUN echo 'export GIT_SSH_COMMAND="ssh -i \$(pwd | sed s/_transform.*//)/.private/id_rsa"' >> /etc/profile

# Git 2.47:
RUN apk upgrade git --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main
RUN git config --global --add safe.directory /srv/wikigdrive/*

CMD [ "sh", "-c", "wikigdrive --workdir /data server 3000" ]
