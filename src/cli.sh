#!/usr/bin/env bash
/usr/bin/env node --no-warnings --experimental-specifier-resolution=node --loader ts-node/esm src/main.ts "$@"
