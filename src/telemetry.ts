import opentelemetry, {Span, SpanKind} from '@opentelemetry/api';
import {ZipkinExporter} from '@opentelemetry/exporter-zipkin';
import {InstrumentationBase, registerInstrumentations} from '@opentelemetry/instrumentation';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {Resource} from '@opentelemetry/resources';
import {NodeTracerProvider} from '@opentelemetry/sdk-trace-node';
import {AlwaysOnSampler, SimpleSpanProcessor} from '@opentelemetry/sdk-trace-base';
import {SemanticResourceAttributes} from '@opentelemetry/semantic-conventions';
import {ClientRequest, IncomingMessage} from 'http';
import * as path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainDirLength = 0;
let provider: NodeTracerProvider;

export function TelemetryClass() {
  return function (classObj) {
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
    classPrototype[methodFunc].telemetryParamCount = config.paramsCount;
  };
}

export function TelemetryMethodDisable() {
  return function (classPrototype, methodFunc: string) {
    classPrototype[methodFunc].telemetryDisable = true;
  };
}

export class ClassInstrumentation extends InstrumentationBase {
  private className: string;

  constructor(private classPrototype: any, private path: string) {
    super('opentelemetry-instrumentation-class', '1.0', { enabled: false });
    this.className = classPrototype.constructor.name;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected init() {
  }

  enable() {
    super.enable();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
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

        return tracer.startActiveSpan(spanName, { kind: SpanKind.INTERNAL }, async (span) => {
          const branch = 'develop';
          const url = `https://github.com/mieweb/wikiGDrive/blob/${branch}/src${instrumentation.path}`;
          span.setAttribute('src', url);

          try {
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
      }),
      new ExpressInstrumentation()
    ],
  });

  const {GitScanner} = await import('./git/GitScanner');
  const {GoogleDriveService} = await import('./google/GoogleDriveService');

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
