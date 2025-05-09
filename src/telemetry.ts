import type {ClientRequest, IncomingMessage} from 'node:http';
import * as path from 'node:path';
import process from 'node:process';

import opentelemetry, {SpanKind} from '@opentelemetry/api';
import type {Span} from '@opentelemetry/api';
import {ZipkinExporter} from '@opentelemetry/exporter-zipkin';
import {InstrumentationBase, registerInstrumentations} from '@opentelemetry/instrumentation';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {Resource} from '@opentelemetry/resources';
import {NodeTracerProvider} from '@opentelemetry/sdk-trace-node';
import {AlwaysOnSampler, SimpleSpanProcessor} from '@opentelemetry/sdk-trace-base';
import {SemanticResourceAttributes} from '@opentelemetry/semantic-conventions';

const __dirname = import.meta.dirname;

let mainDirLength = 0;
let provider: NodeTracerProvider;

export function TelemetryClass() {
  return function (classObj) {
    if (!process.env.ZIPKIN_URL) {
      return;
    }

    const stackTrace = new Error().stack.split('\n');
    if (stackTrace.length < 3) {
      return;
    }

    const classFileName = stackTrace[2]
      .replace(/^.*file:\/\//, '')
      .replace(/:.*$/, '');
    if (!classFileName) {
      return;
    }

    registerInstrumentations({
      tracerProvider: provider,
      instrumentations: [
        new ClassInstrumentation(classObj.prototype, classFileName.substring(mainDirLength)),
      ]
    });
  };
}

export function TelemetryMethod(config: { paramsCount: number }) {
  return function (classPrototype, methodFunc: string) {
    const method = classPrototype[methodFunc] || methodFunc;
    method.telemetryParamCount = config.paramsCount;
  };
}

export function TelemetryMethodDisable() {
  return function (classPrototype, methodFunc: string) {
    const method = classPrototype[methodFunc] || methodFunc;
    method.telemetryDisable = true;
  };
}

export async function instrumentAndWrap(spanName, req, res, func) {
  const tracer = opentelemetry.trace.getTracer(
    provider.resource.attributes[SemanticResourceAttributes.SERVICE_NAME].toString(),
    '1.0'
  );

  const traceparent = req.header('traceparent');

  const input = { traceparent };
  const activeContext = opentelemetry.propagation.extract(opentelemetry.context.active(), input);

  return tracer.startActiveSpan(
    spanName,
    { kind: SpanKind.SERVER },
    activeContext,
    async (span) => {
    try {
      const traceId = span.spanContext().traceId;
      res.header('trace-id', traceId);
      return await func();
    } catch (err) {
      // err.stack = [err.message].concat(stackTrace).join('\n');
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

export class ClassInstrumentation extends InstrumentationBase {
  private className: string;

  constructor(private classPrototype: unknown, private path: string) {
    super('opentelemetry-instrumentation-class', '1.0', { enabled: false });
    this.className = classPrototype.constructor.name;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected init() {
  }

  enable() {
    super.enable();
    // deno-lint-ignore no-this-alias
    const instrumentation = this;

    for (const methodName of Object.getOwnPropertyNames(this.classPrototype)) {
      if ('function' !== typeof this.classPrototype[methodName]) {
        continue;
      }

      const origMethod = this.classPrototype[methodName];
      if (origMethod.telemetryDisable) {
        continue;
      }

      this.classPrototype[methodName] = async function (...args) {
        const stackTrace = new Error().stack.split('\n').splice(2);
        const tracer = opentelemetry.trace.getTracer(
          provider.resource.attributes[SemanticResourceAttributes.SERVICE_NAME].toString(),
          '1.0'
        );

        let spanName = `${instrumentation.className}.${methodName}`;
        if (origMethod.telemetryParamCount) {
          spanName += '(';
          for (let i = 0; i < origMethod.telemetryParamCount; i++) {
            if (i > 0) {
              spanName += ', ';
            }
            spanName += args[0];
          }
          spanName += ')';
        }

        return tracer.startActiveSpan(
          spanName,
          { kind: SpanKind.INTERNAL },
          async (span) => {
            try {
              const branch = 'develop';
              const url = `https://github.com/mieweb/wikiGDrive/blob/${branch}/src${instrumentation.path}`;
              span.setAttribute('src', url);

              return await origMethod.apply(this, args);
            } catch (err) {
              err.stack = [err.message].concat(stackTrace).join('\n');
              span.recordException(err);
              throw err;
            } finally {
              span.end();
            }
          });
      };
      this.classPrototype[methodName].origMethod = origMethod;
    }
  }
}

export function instrumentFunction<K>(func, telemetryParamCount = 0, telemetryParamOffset = 0) {
  return async function (...args) {
    if (!process.env.ZIPKIN_URL) {
      return await func(...args);
    }

    const stackTrace = new Error().stack.split('\n').splice(2);
    const tracer = opentelemetry.trace.getTracer(
      provider.resource.attributes[SemanticResourceAttributes.SERVICE_NAME].toString(),
      '1.0'
    );

    let spanName = func.name;
    if (telemetryParamCount) {
      spanName += '(';
      for (let i = telemetryParamOffset; i < telemetryParamCount + telemetryParamOffset; i++) {
        if (i > 0) {
          spanName += ', ';
        }
        spanName += args[0];
      }
      spanName += ')';
    }

    return tracer.startActiveSpan(
      spanName,
      { kind: SpanKind.INTERNAL },
      async (span) => {
        try {
          return await func(...args);
        } catch (err) {
          err.stack = [err.message].concat(stackTrace).join('\n');
          span.recordException(err);
          throw err;
        } finally {
          span.end();
        }
      });
  };
}

export async function addTelemetry(serviceName: string, mainDir: string) {
  if (!process.env.ZIPKIN_URL) {
    return;
  }

  mainDirLength = mainDir.length;

  provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0'
    }),
    sampler: new AlwaysOnSampler(),
  });

  console.log('Initializing telemetry', serviceName, process.env.ZIPKIN_URL);

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation({
        requireParentforOutgoingSpans: true,
        ignoreIncomingPaths: [ /^\/assets/ ],
        ignoreOutgoingUrls: [ (url) => url.startsWith(process.env.ZIPKIN_URL) ],
        applyCustomAttributesOnSpan(span: Span, request: ClientRequest | IncomingMessage) {
          if (request['path']) {
            span.updateName('http_client ' + request.method + ' ' + request['host'] + request['path'].replace(/\?.*/, ''));
          }
          if (request['originalUrl']) {
            span.updateName('http_server ' + request.method + ' ' + request['originalUrl'].replace(/\?.*/, ''));
          }
        },
      })
    ],
  });

  const {GitScanner} = await import('./git/GitScanner.ts');
  const {GoogleDriveService} = await import('./google/GoogleDriveService.ts');

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new ClassInstrumentation(GitScanner.prototype, path.resolve(__dirname, './git/GitScanner.ts').substring(mainDir.length)),
      new ClassInstrumentation(GoogleDriveService.prototype, path.resolve(__dirname, './google/GoogleDriveService').substring(mainDir.length)),
    ]
  });

  provider.addSpanProcessor(
    new SimpleSpanProcessor(
      new ZipkinExporter({
        serviceName,
        url: process.env.ZIPKIN_URL + '/api/v2/spans'
      })
    )
  );

  provider.register();

  return opentelemetry.trace.getTracer(serviceName);
}
