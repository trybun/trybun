import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

/**
 * The logging context of the current request or job (§17.2). The request ID is bound to every log
 * line of a request by the HTTP logger; jobs run in a context with their job ID and the request ID
 * of the change that caused them, so the logs of an API call and of its jobs share the ID.
 */
@Injectable()
export class LogContext {
  constructor(private readonly logger: PinoLogger) {}

  /** The request ID of the current request, or of the request that caused the current job. */
  requestId(): string | undefined {
    const { requestId } = this.logger.logger.bindings() as { requestId?: unknown };
    return typeof requestId === 'string' ? requestId : undefined;
  }

  /**
   * Runs a job handler in the logging context of the job: its ID and the request ID it carries in
   * `requestId` of its data, if any.
   */
  runJob<T>(job: Job, handler: () => Promise<T>): Promise<T> {
    const { requestId } = (job.data ?? {}) as { requestId?: unknown };
    return this.logger.runInContext(handler, {
      bindings: {
        jobId: job.id,
        ...(typeof requestId === 'string' ? { requestId } : {}),
      },
    });
  }
}
