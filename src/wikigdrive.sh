#!/usr/bin/env bash

FULL_PATH="$(readlink -f ${BASH_SOURCE[0]})"
MAIN_DIR=$(dirname "$FULL_PATH")/..
NODE_MODULES=$MAIN_DIR/node_modules

#export NODE_PATH=$NODE_MODULES
cd $MAIN_DIR

POSITIONAL_ARGS=()
CMD=""
OPTS=""

ORIG_ARGS=$@

while [[ $# -gt 0 ]]; do
  case $1 in
    --inspect | --watch | --prof)
      OPTS="$OPTS $1"
      shift # past argument
      ;;
    --watch-path)
      OPTS="$OPTS $1 $2"
      shift # past argument
      shift # past value
      ;;
    --link_mode | --workdir | --drive | --debug | --client_id | --client_secret | --service_account | --share_email | --server_port | --transform_subdir)
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
    CMD="usage"
fi

if [[ ! -f "$MAIN_DIR/src/cli/wikigdrive-$CMD.ts" ]]; then
    CMD="usage"
fi

/usr/bin/env node $OPTS --no-warnings --enable-source-maps --experimental-specifier-resolution=node --loader ts-node/esm $MAIN_DIR/src/cli/wikigdrive-$CMD.ts $ORIG_ARGS
