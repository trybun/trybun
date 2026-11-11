// SeaweedFS with the S3 API, as the `seaweedfs` service of compose.yaml (§15.3), for the
// integration tests of the object storage.
import { CreateBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

// Pinned to the digest of compose.yaml (§2.10).
const SEAWEEDFS_IMAGE =
  'chrislusf/seaweedfs:4.52@sha256:57877e32bb90073b37dc109b438ba66e84fd5ed9ced5f5c04f56444ef243ce59';

/** The credentials of `TEST_ENV` (test/env.ts). */
const ACCESS_KEY_ID = 'trybun-test';
const SECRET_ACCESS_KEY = 'object-storage-secret';

export interface TestSeaweedfs {
  /** The S3 endpoint on the host, e.g. `http://localhost:32768`. */
  endpoint: string;
  container: StartedTestContainer;
}

/**
 * Writes one object. The master of a new SeaweedFS defers the allocation of the first volume for
 * about 15 seconds after its start, so the first write waits that long; later writes, also into
 * new buckets, take milliseconds.
 */
async function warmUp(endpoint: string): Promise<void> {
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });
  try {
    await client.send(new CreateBucketCommand({ Bucket: 'warm-up' }));
    await client.send(new PutObjectCommand({ Bucket: 'warm-up', Key: 'warm-up', Body: 'warm-up' }));
  } finally {
    client.destroy();
  }
}

export async function startSeaweedfs(): Promise<TestSeaweedfs> {
  const container = await new GenericContainer(SEAWEEDFS_IMAGE)
    // Every bucket is a collection with volumes of its own; with the default size limit of 1 GB
    // the disk of the container holds the volumes of only four buckets that are written to.
    .withCommand([
      'server',
      '-dir=/data',
      '-s3',
      '-master.telemetry=false',
      '-master.volumeSizeLimitMB=64',
    ])
    .withEnvironment({ AWS_ACCESS_KEY_ID: ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: SECRET_ACCESS_KEY })
    .withExposedPorts(8333)
    .withWaitStrategy(Wait.forHttp('/healthz', 8333).withStartupTimeout(120_000))
    .start();
  const endpoint = `http://${container.getHost()}:${container.getMappedPort(8333)}`;
  await warmUp(endpoint);
  return { endpoint, container };
}
