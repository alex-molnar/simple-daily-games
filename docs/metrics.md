# Metrics

The API exposes Prometheus metrics on port **9100** (`METRICS_PORT`), served by a
second listener that the `api` Service names `metrics` and the ingress never
routes to. They are reachable only inside the cluster. `kube/base/api-servicemonitor.yaml`
tells the Prometheus Operator to scrape them every 30 seconds.

If your Prometheus only selects ServiceMonitors with a specific label (for
example `release: <name>`), add it to that file.

## Metrics

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `http_requests_total` | counter | `method`, `route`, `status` | Requests handled. `route` is the route template, so `/games/{game_id}/today/stats`, not the URL. Unknown paths share `unmatched` and unknown methods share `other`. Probe routes (`/health`, `/readiness`) are not counted. |
| `http_request_duration_seconds` | histogram | `method`, `route` | Request latency. |
| `app_db_up` | gauge | | `1` if the last database check succeeded, `0` if it failed. Updated by `/readiness` (every 10 seconds) and by any database error. |
| `game_started_total` | counter | `game` | Games started. |
| `game_won_total` | counter | `game`, `attempts` | Games won. `attempts` is `1` to `6`, or `7+`. |
| `game_failed_total` | counter | `game` | Games failed or given up. |
| `page_views_total` | counter | `game`, `browser`, `os`, `device` | Page views. `game` is a game id or `landing`. |
| `process_*`, `python_gc_*` | | | Process CPU, memory and file descriptors, from the default collectors (Linux only). |

Prometheus's own `up{job=...}` tells you whether the API is reachable at all.

Game counters are incremented after the database write succeeds, and reset when
a pod restarts, so use `increase()` and `rate()`. Postgres stays the source of
truth for the daily numbers (`GET /games/{game}/today/stats`).

### Audience labels

Page views come from `POST /games/{game}/today/visit`, sent once per page load
by every game page and the landing page. The server classifies the `User-Agent`
header into fixed lists and discards it. No IP address or cookie is stored or used.

- `browser`: `chrome`, `safari`, `firefox`, `edge`, `opera`, `other`
- `os`: `windows`, `macos`, `ios`, `android`, `chromeos`, `linux`, `other`
- `device`: `mobile`, `tablet`, `desktop`, `bot`

Known limits:

- Page views are counted, not unique visitors, because there is nothing to dedupe on.
- iPadOS 13+ sends a desktop Mac agent, so iPads are counted as macOS desktops.
- There is no location data. It needs a CDN header or a GeoIP database in the API.
- Client-side blockers can drop the beacon, so these are lower bounds.

## Example queries

```promql
# Games started per day, per game
sum by (game) (increase(game_started_total[1d]))

# Win rate over the last 7 days
sum(increase(game_won_total[7d])) / sum(increase(game_started_total[7d]))

# Distribution of attempts for one game
sum by (attempts) (increase(game_won_total{game="capitale"}[7d]))

# Share of page views by browser, bots excluded
sum by (browser) (increase(page_views_total{device!="bot"}[7d]))

# Mobile vs desktop
sum by (device) (increase(page_views_total[7d]))

# API 5xx ratio and p95 latency
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))

# Database down
app_db_up == 0
```

## Base image

`api/Dockerfile` uses `kingbrady/fast-api-base:1.1.1-multi-architecture`, which
must provide `prometheus-client`. CI installs `prometheus-client` for the API tests.

## Example dashboard

`docs/grafana-dashboard.json` is an example Grafana dashboard built on these metrics
(import it via Dashboards > New > Import and pick your Prometheus data source). It has
a game variable and rows for the overview, games, audience and API health. It has not
been tested against a live Grafana, so expect to adjust some panels.
