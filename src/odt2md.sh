#!/usr/bin/env bash

FULL_PATH="$(readlink -f ${BASH_SOURCE[0]})"
MAIN_DIR=$(dirname "$FULL_PATH")/..
NODE_MODULES=$MAIN_DIR/node_modules

POSITIONAL_ARGS=()
INSPECT=""

ORIG_ARGS=$@

while [[ $# -gt 0 ]]; do
  case $1 in
    --inspect)
      INSPECT="$1"
      shift # past argument
      ;;
    *)
      if [[ -z "$CMD" ]]; then
        CMD=$1
      fi
      POSITIONAL_ARGS+=("$1") # save positional arg
      shift # past argument
      ;;
  esac
done

if test "$INSPECT" = "--inspect"; then
  /usr/bin/env node --inspect --no-warnings --enable-source-maps --experimental-specifier-resolution=node --loader ts-node/esm $MAIN_DIR/src/cli/odt2md.ts $ORIG_ARGS
else
  /usr/bin/env node --no-warnings --enable-source-maps --experimental-specifier-resolution=node --loader ts-node/esm $MAIN_DIR/src/cli/odt2md.ts $ORIG_ARGS
fi
