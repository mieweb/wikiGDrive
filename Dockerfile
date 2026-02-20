FROM node:22-bookworm-slim

ARG BUILD_UI
ARG GIT_SHA
EXPOSE 3000
VOLUME /data
WORKDIR /usr/src/app

RUN apt-get update
RUN apt-get install -yq bash git-lfs openssh-client curl unzip podman
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s v2.6.1 -y

COPY . ./

WORKDIR "/usr/src/app"

RUN deno install
RUN deno task -f wikigdrive-ui build
RUN ln -sf /usr/src/app/src/wikigdrive.sh /usr/local/bin/wikigdrive
RUN ln -sf /usr/src/app/src/wikigdrivectl.sh /usr/local/bin/wikigdrivectl

# Add the GIT_SSH_COMMAND to /etc/profile so that we can debug git issues from the command line
RUN echo 'export GIT_SSH_COMMAND="ssh -i \$(pwd | sed s/_transform.*//)/.private/id_rsa"' >> /etc/profile

# Git 2.47:
#RUN apt upgrade git --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main
RUN git config --global --add safe.directory /srv/wikigdrive/*

HEALTHCHECK --interval=5m --timeout=3s CMD curl -f http://localhost:3000 || exit 1

CMD [ "sh", "-c", "wikigdrive --workdir /data server 3000" ]
