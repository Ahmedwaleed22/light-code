# Resource optimization check — 2026-09-23

Measured in the same development container against the previous binary and the optimized binary. These are sample workload results, not upper bounds or VPS guarantees. Disk flush latency and host load vary between runs.

## WebSocket workload

Command: `node infra/scripts/measure-resources.mjs [path/to/binary]`.

20 simultaneous clients, 1,000 small source files, one 1 MiB text file, 2,000 saves of approximately 20 KiB, 100 large-file reads, 100 searches, and 20 initial reads. Each client waits for its own response. Fixtures live in a temporary workspace; the benchmark does not modify the user's workspace. The baseline already includes the earlier per-file save-lock fix.

| Metric | Before | After |
| --- | ---: | ---: |
| Workload duration | 10.60 s | 5.20 s |
| Server CPU time | 25.05 s | 9.81 s |
| Save median | 30.04 ms | 23.87 ms |
| Save p95 | 90.13 ms | 71.34 ms |
| Idle server RSS | 9.85 MiB | 10.17 MiB |
| Sampled peak server RSS | 37.77 MiB | 35.92 MiB |
| RSS after three seconds of idle | 15.53 MiB | 20.94 MiB |
| Read syscalls | 242,720 | 21,048 |

The cache trades some retained memory for fewer reads and less CPU work. Its accounted contents are capped at 4 MiB / 4,096 files. Warm search still checks filesystem metadata. Large files and an over-capacity working set require fresh reads.

## Warm search microbenchmark

`go test ./internal/services/files -run '^$' -bench 'Benchmark(SearchWorkspace|Save)' -benchmem`

A no-match literal search over 1,000 files of 1 KiB each, after one warm-up search:

| Metric | Before | After |
| --- | ---: | ---: |
| Time per search | 70.76 ms | 10.23 ms |
| Allocated bytes per search | 67,830,705 | 517,987 |
| Allocations per search | 43,039 | 6,020 |

Allocated bytes are cumulative allocation work per operation, not retained RAM or RSS.

## Browser and running instance

Headless Chromium against the built app restored eight tabs with at most four requests in flight, without overload errors. Checks passed for clearing a query while its response was delayed, canceling that search, discovering an external file edit, reconnecting, and saving text typed while disconnected. No JavaScript errors were reported.

After closing the three small tabs and keeping five 1 MiB files open, two runs measured JavaScript heap at 48.25–52.37 MiB before collection and 13.56–13.57 MiB after an explicitly requested garbage collection. These figures exclude browser process overhead, rendering memory, and the reverse proxy; they are not total browser RAM.

The local test instance now uses the built Go server alone on port 5173 (`light-code-dev-5173.service`), serving `/` and `/api/health`. The Vite and separate API services are stopped. The former Vite service accounted for roughly 116 MiB immediately before shutdown. Runtime checks confirmed an active service, a listener on all interfaces, the Light Code page, the health response, and the browser scenarios above. The public ingress URL could not be checked because the project slug is not supplied in this session.

The frontend production build and all Go tests, including the race detector, pass. Regression tests cover cache limits, external changes, Unicode, binary files, long lines, cancellation under load, slow-client queue limits, and unchanged saves avoiding disk writes.
