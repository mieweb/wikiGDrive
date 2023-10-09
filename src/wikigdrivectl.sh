#!/usr/bin/env bash

FULL_PATH="$(readlink -f ${BASH_SOURCE[0]})"
MAIN_DIR=$(dirname "$FULL_PATH")/..
NODE_MODULES=$MAIN_DIR/node_modules

#export NODE_PATH=$NODE_MODULES
cd $MAIN_DIR

POSITIONAL_ARGS=()
CMD=""
INSPECT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --inspect)
      INSPECT="$1"
      shift # past argument
      ;;
    --link_mode | --workdir | --drive | --debug | --client_id | --client_secret | --service_account | --share_email)
      POSITIONAL_ARGS+=("$1") # save positional arg1
      POSITIONAL_ARGS+=("$2") # save positional arg2
      shift # past argument
      shift # past value
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

if [[ -z "$CMD" ]]; then
    echo "No command"
    exit 1
fi

if [[ ! -f "$MAIN_DIR/src/cli/wikigdrivectl-$CMD.ts" ]]; then
    echo "Invalid command: $CMD"
    exit 2
fi

if test "$INSPECT" = "--inspect"; then
  /usr/bin/env node --inspect --no-warnings --experimental-specifier-resolution=node --loader $NODE_MODULES/ts-node/esm $MAIN_DIR/src/cli/wikigdrivectl-$CMD.ts $ORIG_ARGS
else
  /usr/bin/env node --no-warnings --experimental-specifier-resolution=node --loader $NODE_MODULES/ts-node/esm $MAIN_DIR/src/cli/wikigdrivectl-$CMD.ts $ORIG_ARGS
fi
