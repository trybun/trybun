// ClamAV with the clamd configuration of the deployment package (docker/clamav/clamd.conf), as
// the `clamav` service of compose.yaml (ADR 0008), for the integration tests of the scanner.
import { join } from 'node:path';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

// Pinned to the digest of compose.yaml (§2.10). The image contains a signature database.
const CLAMAV_IMAGE =
  'clamav/clamav:1.5.4@sha256:e19130cdebaeacc71fa46eab3ed6f69941f2f22aa5e08d55e9197f8edf43ce5e';
const CLAMD_CONF = join(import.meta.dirname, '../../../../docker/clamav/clamd.conf');

export interface TestClamav {
  /** `TRYBUN_CLAMAV_URL` on the host, e.g. `tcp://localhost:32768`. */
  url: string;
  container: StartedTestContainer;
}

export async function startClamav(): Promise<TestClamav> {
  const container = await new GenericContainer(CLAMAV_IMAGE)
    // The signatures of the image, without downloads: tests stay deterministic and never meet
    // the rate limit of the signature mirror.
    .withEnvironment({ CLAMAV_NO_FRESHCLAMD: 'true' })
    .withCopyFilesToContainer([{ source: CLAMD_CONF, target: '/etc/clamav/clamd.conf' }])
    .withExposedPorts(3310)
    // Loading the signatures takes up to a minute (the health check of compose.yaml allows 150 s).
    .withWaitStrategy(
      Wait.forLogMessage('socket found, clamd started.').withStartupTimeout(300_000),
    )
    .start();
  return { url: `tcp://${container.getHost()}:${container.getMappedPort(3310)}`, container };
}
