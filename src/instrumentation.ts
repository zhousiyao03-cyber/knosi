import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

let spanProcessor: LangfuseSpanProcessor | undefined;

export function getLangfuseSpanProcessor() {
  return spanProcessor;
}

export async function register() {
  if (process.env.LANGFUSE_PUBLIC_KEY) {
    spanProcessor = new LangfuseSpanProcessor();
    const provider = new NodeTracerProvider({
      spanProcessors: [spanProcessor],
    });
    provider.register();
  }
}
