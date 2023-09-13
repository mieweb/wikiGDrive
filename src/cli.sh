#!/usr/bin/env bash

FULL_PATH="$(readlink -f ${BASH_SOURCE[0]})"
MAIN_DIR=$(dirname "$FULL_PATH")/..
NODE_MODULES=$MAIN_DIR/node_modules

#export NODE_PATH=$NODE_MODULES
cd $MAIN_DIR

if test "$1" = "--inspect"; then
  /usr/bin/env node --inspect --no-warnings --experimental-specifier-resolution=node --loader $NODE_MODULES/ts-node/esm $MAIN_DIR/src/main.ts "$@"
else
  /usr/bin/env node --no-warnings --experimental-specifier-resolution=node --loader $NODE_MODULES/ts-node/esm $MAIN_DIR/src/main.ts "$@"
fi
