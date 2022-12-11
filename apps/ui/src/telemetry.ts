import {
  BatchSpanProcessor, ReadableSpan,
  SimpleSpanProcessor, SpanExporter
} from '@opentelemetry/sdk-trace-base';
import {
  InstrumentationBase,
  registerInstrumentations
} from '@opentelemetry/instrumentation';
import opentelemetry, {Span, SpanKind} from '@opentelemetry/api';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { FetchError } from '@opentelemetry/instrumentation-fetch/build/src/types';

const metaEl = document.querySelector('meta[name=ZIPKIN_URL]');
const ZIPKIN_URL = metaEl ? metaEl.getAttribute('content') : undefined;

export class InMemorySpanExporter implements SpanExporter {
  private _finishedSpans: ReadableSpan[] = [];
  /**
   * Indicates if the exporter has been "shutdown."
   * When false, exported spans will not be stored in-memory.
   */
  protected _stopped = false;

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    if (this._stopped)
      return resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error('Exporter has been stopped'),
      });
    this._finishedSpans.push(...spans);
    for (const span of spans) {
      if (span.ended && !span.parentSpanId) {
        // console.log(span.name, span.duration[0], span.spanContext().traceId, span.parentSpanId);
      }
    }

    setTimeout(() => resultCallback({ code: ExportResultCode.SUCCESS }), 0);
  }

  shutdown(): Promise<void> {
    this._stopped = true;
    this._finishedSpans = [];
    return Promise.resolve();
  }

  reset(): void {
    this._finishedSpans = [];
  }

  getFinishedSpans(): ReadableSpan[] {
    return this._finishedSpans;
  }
}

let provider;

export class VueComponentInstrumentation extends InstrumentationBase<unknown> {

  constructor(private component) {
    super('instrumentation-vue', '1.0', { enabled: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected init() {}

  override enable() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instrumentation = this;

    if (this.component.name && this.component.methods) {
      for (const methodName in this.component.methods) {
        if ('function' !== typeof this.component.methods[methodName]) {
          continue;
        }

        const origMethod = this.component.methods[methodName];
        if (origMethod.telemetryDisable) {
          continue;
        }

        this.component.methods[methodName] = async function (...args) {
          const stackTrace = new Error().stack.split('\n').splice(2);
          const tracer = opentelemetry.trace.getTracer(
            provider.resource.attributes[SemanticResourceAttributes.SERVICE_NAME].toString(),
            '1.0'
          );

          let spanName = `${instrumentation.component.name}.${methodName}`;
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
        this.component.methods[methodName].origMethod = origMethod;
      }
    }

  }
}

export function addTelemetry(app) {
  if (ZIPKIN_URL) {
    const serviceName = import.meta.env.VITE_APP_ZIPKIN_SERVICE || 'wikigdrive';

    console.log('Initializing telemetry', serviceName, ZIPKIN_URL);

    provider = new WebTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0'
      }),
    });

    const exporter = new ZipkinExporter({
      serviceName,
      url: ZIPKIN_URL + '/api/v2/spans',
    });
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    provider.addSpanProcessor(new SimpleSpanProcessor(new InMemorySpanExporter()));

    provider.register({
      // Changing default contextManager to use ZoneContextManager - supports asynchronous operations - optional
      contextManager: new ZoneContextManager(),
    });

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          ignoreUrls: [],
          applyCustomAttributesOnSpan(span: Span, request: Request | RequestInit, result: Response | FetchError) {
            if (result['url'] && result['url'].indexOf('/api/') > -1) {
              const method = request.method || 'get';
              const url = new URL(result['url']);
              span.updateName('http_client ' + method + ' ' + url.toString());
            } else {
              console.log(result['url']);
            }
          },
        })
      ],
    });

    const router = app.config.globalProperties.$router;
    router.afterEach((to) => {
      for (const match of to.matched) {
        registerInstrumentations({
          instrumentations: Object.values(match.components).map(component => new VueComponentInstrumentation(component))
        });
      }
    });
  }
}
