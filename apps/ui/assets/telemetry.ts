import {
  BatchSpanProcessor, ReadableSpan,
  SimpleSpanProcessor, SpanExporter
} from '@opentelemetry/sdk-trace-base';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import * as api from '@opentelemetry/api';
import {FetchError} from '@opentelemetry/instrumentation-fetch/build/src/types';

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

export function addTelemetry(app) {
  if (ZIPKIN_URL) {
    const serviceName = import.meta.env.VITE_APP_ZIPKIN_SERVICE || 'wikigdrive';

    console.log('Initializing telemetry', serviceName, ZIPKIN_URL);

    const provider = new WebTracerProvider({
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
          applyCustomAttributesOnSpan(span: api.Span, request: Request | RequestInit, result: Response | FetchError) {
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

  }
}
