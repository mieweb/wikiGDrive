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
    --server_port)
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

#/usr/bin/env node $OPTS --no-warnings --experimental-specifier-resolution=node --loader ts-node/esm/transpile-only $MAIN_DIR/src/cli/wikigdrivectl-$CMD.ts $ORIG_ARGS
/usr/bin/env deno run --allow-sys --allow-env --allow-read --allow-write --allow-ffi --allow-net --allow-run $MAIN_DIR/src/cli/wikigdrive-$CMD.ts $ORIG_ARGS
