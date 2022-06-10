import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK, resources, tracing } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { InstrumentationOption } from '@opentelemetry/instrumentation';
import { Server } from '@subsquid/graphql-server/lib/server';

async function startOpenTracing({ tracingAgentUrl, serviceName }: { tracingAgentUrl?: string, serviceName?: string }) {
  if(!tracingAgentUrl) return;

  const [host, port] = tracingAgentUrl.split(':');
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

  const sdk = new NodeSDK({
    resource: new resources.Resource({
      'service.name': `${serviceName ? serviceName : 'squid'}-query-node`,
    }),
    autoDetectResources: false,
    spanProcessor: new tracing.BatchSpanProcessor(
      new JaegerExporter({
        host,
        port: parseInt(port, 10),
      }),
    ),
    instrumentations: [
      new HttpInstrumentation({
        applyCustomAttributesOnSpan: (span, req, res) => {
          const body = (req as any).body

          if (body.queryName) {
            span.updateName(body.queryName)
          }
          if (body?.query) {
            span.setAttribute('http.body.query', body.query)
          }
        }
      }),
      new ExpressInstrumentation({

      }) as any,
      new PgInstrumentation({
        enhancedDatabaseReporting: true
      }) as InstrumentationOption,
    ],
  });

  return sdk.start()
}

async function main() {
  await startOpenTracing({ tracingAgentUrl: process.env.TRACING_AGENT_URL, serviceName:  process.env.TRACING_SERVICE }).then(() =>{
    console.log('Tracing enabled')
  }, (e) => {
    console.error(e)
  })

  const { Server } = require('@subsquid/graphql-server/lib/server');
  const server = new Server()
  server.run()
}

main()
