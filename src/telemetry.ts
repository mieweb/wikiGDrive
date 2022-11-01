import opentelemetry from '@opentelemetry/api';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import {
  InstrumentationBase,
  registerInstrumentations
} from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { Resource } from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import {GitScanner} from './git/GitScanner';

export class ClassInstrumentation extends InstrumentationBase {
  private className: string;

  constructor(private classPrototype) {
    super('opentelemetry-instrumentation-class', '1.0', { enabled: false });
    this.className = classPrototype.constructor.name;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected init() {
  }

  enable() {
    super.enable();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    for (const methodName of Object.getOwnPropertyNames(this.classPrototype)) {
      if ('function' !== typeof this.classPrototype[methodName]) {
        continue;
      }

      const origMethod = this.classPrototype[methodName];
      this.classPrototype[methodName] = async function (...args) {
        const parent = opentelemetry.trace.getActiveSpan();
        const ctx = opentelemetry.trace.setSpan(opentelemetry.context.active(), parent);
        const span = self.tracer.startSpan(`${self.className}.${methodName}`, undefined, ctx);
        const retVal = await origMethod.apply(this, args);
        span.end();
        return retVal;
      };
      this.classPrototype[methodName].origMethod = origMethod;
    }
  }
}

export function addTelemetry(serviceName: string) {
  if (!process.env.ZIPKIN_URL) {
    return;
  }

  console.log('Initializing telemetry', serviceName, process.env.ZIPKIN_URL);

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName
    }),
    sampler: new AlwaysOnSampler(),
  });

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new ClassInstrumentation(GitScanner.prototype),
      new HttpInstrumentation({
      }),
      new ExpressInstrumentation()
    ],
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
