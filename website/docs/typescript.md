---
title: Typescript
---

# Typescript implementation status

@See: https://github.com/privatenumber/ts-runtime-comparison

## ts-node

Slow, high CPU load on startup.

## NodeJS typescript support

@See: https://nodejs.org/api/typescript.html

Since v22.6.0 flag `--experimental-strip-types` enables Node.js to run TypeScript files.

Since Decorators are currently a TC39 Stage 3 proposal and will soon be supported by the JavaScript engine,
they are not transformed and will result in a parser error.

```
file:///usr/src/app/src/containers/changes/WatchChangesContainer.ts:14
@TelemetryClass()
^

SyntaxError: Invalid or unexpected token
```

## Deno

Experimental support in testing.

## tsx 4.19.2

Broken workers:

```
Worker exit 1
Worker exit 1
Worker exit 1
Worker exit 1
Worker exit 1
...
```

## jiti 2.4.1

Telemetry not working

```
/usr/src/app/src/telemetry.ts:89
class ClassInstrumentation extends _instrumentation.InstrumentationBase {
                                                    ^

TypeError: Class extends value undefined is not a constructor or null
    at /usr/src/app/src/telemetry.ts:89:53
    at async import (/usr/src/app/node_modules/jiti/dist/jiti.cjs:1:199725)
    at async _module (file:///usr/src/app/src/cli/wikigdrive-server.ts:7:18)
    at async file:///usr/src/app/src/cli/wikigdrive-server.ts:200:1
```
