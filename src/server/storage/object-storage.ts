type UploadPublicObjectInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
};

type PublicUrlInput = {
  key: string;
  publicBaseUrl?: string;
  endpoint?: string;
  bucket?: string;
  forcePathStyle?: boolean;
};

export type S3ObjectStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  forcePathStyle?: boolean;
};

export type ObjectStorage = {
  uploadPublicObject(input: UploadPublicObjectInput): Promise<{ url: string }>;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, "");
}

function assertS3Config(config: S3ObjectStorageConfig) {
  const requiredFields: Array<keyof S3ObjectStorageConfig> = [
    "endpoint",
    "region",
    "bucket",
    "accessKeyId",
    "secretAccessKey",
  ];

  for (const field of requiredFields) {
    const value = config[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`S3 configuration is missing ${field}`);
    }
  }
}

export function buildPublicObjectUrl({
  key,
  publicBaseUrl,
  endpoint,
  bucket,
  forcePathStyle,
}: PublicUrlInput) {
  const normalizedKey = trimLeadingSlash(key);

  if (publicBaseUrl) {
    return `${trimTrailingSlash(publicBaseUrl)}/${normalizedKey}`;
  }

  if (!endpoint || !bucket) {
    throw new Error("S3 public URL requires either S3_PUBLIC_BASE_URL or endpoint + bucket");
  }

  const normalizedEndpoint = trimTrailingSlash(endpoint);
  if (forcePathStyle) {
    return `${normalizedEndpoint}/${bucket}/${normalizedKey}`;
  }

  const endpointUrl = new URL(normalizedEndpoint);
  endpointUrl.hostname = `${bucket}.${endpointUrl.hostname}`;
  endpointUrl.pathname = `/${normalizedKey}`;
  return endpointUrl.toString();
}

export function createS3ObjectStorage(config: S3ObjectStorageConfig): ObjectStorage {
  assertS3Config(config);
  let client: import("@aws-sdk/client-s3").S3Client | null = null;

  return {
    async uploadPublicObject({ key, body, contentType }) {
      const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
      client ??= new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle ?? false,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );

      return {
        url: buildPublicObjectUrl({
          key,
          publicBaseUrl: config.publicBaseUrl,
          endpoint: config.endpoint,
          bucket: config.bucket,
          forcePathStyle: config.forcePathStyle,
        }),
      };
    },
  };
}

export function getObjectStorageFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return createS3ObjectStorage({
    endpoint: env.S3_ENDPOINT ?? "",
    region: env.S3_REGION ?? "",
    bucket: env.S3_BUCKET ?? "",
    accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    publicBaseUrl: env.S3_PUBLIC_BASE_URL?.trim() || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  });
}

const objectStorage = {
  buildPublicObjectUrl,
  createS3ObjectStorage,
  getObjectStorageFromEnv,
};

export default objectStorage;
