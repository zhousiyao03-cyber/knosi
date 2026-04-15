import { logger } from "./server/logger";

type RegisterDeps = {
  env?: NodeJS.ProcessEnv;
  installNodeTracing?: () => Promise<void> | void;
};

let tracingInstalled = false;

export function hasTracingConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

async function installNodeTracingFromEnv(env: NodeJS.ProcessEnv) {
  const [
    { LangfuseSpanProcessor },
    { NodeSDK },
    { resourceFromAttributes },
    { ATTR_SERVICE_NAME },
  ] = await Promise.all([
    import("@langfuse/otel"),
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
  ]);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "second-brain",
    }),
    spanProcessor: new LangfuseSpanProcessor({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL,
      environment: env.LANGFUSE_TRACING_ENVIRONMENT,
      release: env.LANGFUSE_RELEASE,
    }),
  });

  await sdk.start();
}

export async function register(deps: RegisterDeps = {}) {
  const env = deps.env ?? process.env;
  if (env.NEXT_RUNTIME === "edge") return;
  if (!hasTracingConfig(env)) return;
  if (tracingInstalled) return;

  const installNodeTracing =
    deps.installNodeTracing ?? (() => installNodeTracingFromEnv(env));

  try {
    await installNodeTracing();
    tracingInstalled = true;
  } catch (err) {
    logger.error(
      { event: "tracing.install_error", err },
      "failed to install node tracing"
    );
  }
}

const instrumentation = {
  hasTracingConfig,
  register,
};

export default instrumentation;
