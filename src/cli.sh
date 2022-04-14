#!/usr/bin/env bash

FULL_PATH="$(readlink -f ${BASH_SOURCE[0]})"
MAIN_DIR=$(dirname "$FULL_PATH")/..
NODE_MODULES=$MAIN_DIR/node_modules

#export NODE_PATH=$NODE_MODULES
cd $MAIN_DIR

/usr/bin/env node --no-warnings --experimental-specifier-resolution=node --loader $NODE_MODULES/ts-node/esm $MAIN_DIR/src/main.ts "$@"
