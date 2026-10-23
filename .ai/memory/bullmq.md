# BullMQ – job IDs, deduplication and retention

Non-obvious behaviour of BullMQ 6 found when the job conventions were fixed (October 2026). Rules: [§17.2](../../docs/spec/17-conventions.md); patterns: [§18.3](../../docs/spec/18-code-patterns.md).

- A custom `jobId` must not contain `:` (BullMQ's key separator) and must not consist of digits only (`Custom Id cannot be integers`). Use `-` as the separator.
- Adding a job whose ID already exists is **silently ignored**, not replaced – also when the existing job is completed or failed but still kept. A fixed ID therefore blocks every later job with that ID until the old job is removed. Rescheduling never works by re-adding the same `jobId`.
- Timers use deduplication in debounce mode: `add(name, data, { delay, deduplication: { id, ttl, extend: true, replace: true } })` keeps only the newest job. The deduplication key is separate from the job ID, so kept jobs do not block it. Verified in S0-04 (`platform/queues/timers.integration.spec.ts`): with `ttl` equal to the delay, `replace` restarts the delay and the job runs once with the newest data.
- Other modes: `{ id }` deduplicates until the job completes or fails; `{ id, ttl }` throttles; `keepLastIfActive` runs once more with the newest data after an active job. `queue.getDeduplicationJobId(id)` and `queue.removeDeduplicationKey(id)` inspect and clear a key; deleting the job manually also disables its deduplication. Duplicates emit `deduplicated` on `QueueEvents`.
- `job.changeDelay(ms)` works only for jobs in the delayed state.
- `removeOnComplete` / `removeOnFail` accept `true`, a count or `{ age, count }` (age in seconds); removal is lazy – it runs when another job completes or fails. Without them, finished jobs are kept.
- A failed job is retried with `job.retry()`; a new job with its ID would be ignored.
- BullMQ 6 removed repeatable jobs (`repeat`) and the old `debounce` option – use `upsertJobScheduler(id, { pattern | every, tz }, template)`. `ioredis` is an optional peer and must be installed explicitly.
- The official compatibility list names Redis ≥ 6.2 and Dragonfly, not Valkey; the BullMQ team benchmarks Valkey 7.2–9.0. Valkey 9.0 was about 11% slower than 8.1 on AMD at high throughput – irrelevant at the project's scale. Integration tests run on the project's Valkey image.
