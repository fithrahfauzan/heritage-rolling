# Heritage Land Distribution

A fullstack web app for fairly distributing land documents among members via a
"spin the wheel" draw. Each spin decides the recipient live (respecting fair
per-class quotas); pinned documents are awarded automatically up front.

---

## Quick start

```bash
# requires Node ≥ 20.19 or ≥ 22.12 (Vite 7 constraint)
make install
make dev          # → http://localhost:3000
```

Default password: **`heritage`** — change it before any public deployment
(see [Configuration](#configuration)).

---

## How it works

Documents are classified as **top**, **middle**, or **bottom** and distributed
in that order. The app supports two switchable **allocation modes** (set via
`config/settings.json` — see [Configuration](#configuration)):

### `strict` mode (default)

Hard even split per class — top and middle counts **must** divide evenly by the
member count, or the run is blocked.

| Class  | Rule                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- |
| top    | Even split. Supports `preassignedTo` — pin a document to a specific member (counts toward their quota). |
| middle | Even split. Count must be divisible by member count.                                                    |
| bottom | Floor per member, leftover documents assigned randomly to distinct members.                             |

### `compensation` mode

No divisibility requirement. Each class is distributed in even cycles; a member
who falls short of the would-be even share is **compensated** with documents of
the next lower class, cascading top → middle → bottom:

- Miss **1 top** → get **+3 middle**
- Miss **1 middle** → get **+3 bottom**

The compensation pool for a class is reserved first, then the remaining
documents are distributed evenly across **all** members (compensated members
included). Because the 3× rate equals the value ratio (1 top = 3 middle = 9
bottom), every member ends with **equal total value**. The run is only blocked
if a lower class has too few documents to pay the compensation it owes.

> Example (15 members; 14 top, 19 middle, 57 bottom): 1 member misses top → +3
> middle; 14 members fall short on middle's second cycle → +3 bottom each. Every
> member ends at 16 value points.

A run goes through the states `empty → draft → in_progress → committed`.
Committed runs can be rerun — the previous result is archived.

---

## Configuration

All config lives in `config/` and is read at runtime (no rebuild needed):

```
config/
  members.json          ← member list  [{ "id", "name" }]
  branding.json         ← brand strings (logo, name, title, tagline)
  settings.json         ← { "allocationMode": "strict" | "compensation" }
  assets/
    top.json            ← top documents (add "preassignedTo": "<memberId>" to pin)
    middle.json         ← middle documents
    bottom.json         ← bottom documents
```

Switch the allocation rule at runtime by editing `config/settings.json` (no
rebuild needed):

```json
{
    "allocationMode": "compensation"
}
```

`strict` is the default if the file is missing. The `ALLOCATION_MODE` environment
variable overrides the file when set.

Customise the brand without touching code by editing `config/branding.json`:

```json
{
    "logoText": "HL",
    "brandName": "Heritage Land",
    "title": "Land Distribution",
    "tagline": "Distribution System"
}
```

Each asset file is an array of objects without the `classification` field (it is
implied by the filename):

```json
[
    {
        "certificateNumber": "SHM-0001",
        "name": "Soekarno",
        "location": "Jl. Merdeka No. 8, Jakarta",
        "area": 537,
        "preassignedTo": "m1"
    }
]
```

**Environment variables** (set in `.env` or `docker-compose.yml`):

| Variable          | Default                                           | Notes                                                        |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `APP_PASSWORD`    | `heritage`                                        | Change in production                                         |
| `SESSION_SECRET`  | `dev-only-insecure-session-secret-change-me-0001` | Must be ≥ 32 chars in prod                                   |
| `PORT`            | `3000`                                            |                                                              |
| `ALLOCATION_MODE` | _(unset)_                                         | `strict` \| `compensation`; overrides `config/settings.json` |

---

## Development

```bash
make dev            # dev server with HMR
make test           # run tests once
make test-watch     # watch mode
make typecheck      # tsc --noEmit
make format         # Prettier write
make format-check   # Prettier check (used in CI)
```

---

## Production build

```bash
make build          # outputs dist/client + dist/server/server.js
make start          # build + serve with srvx
```

---

## Docker deployment

```bash
make docker-rebuild   # build image + start container on :3000
make docker-logs      # tail logs
make docker-down      # stop
```

The compose file:

- Bind-mounts `config/` read-only — edit documents without rebuilding the image.
- Persists `data/` (distribution state) as a named volume across restarts.
- Includes a health check on `/login`.

Override credentials at deploy time:

```bash
APP_PASSWORD=secret SESSION_SECRET=your-32-char-secret docker compose up -d --build
```

---

## Routes

| Route         | Description                                                                              |
| ------------- | ---------------------------------------------------------------------------------------- |
| `/login`      | Password gate                                                                            |
| `/`           | Dashboard — status, member/document counts                                               |
| `/distribute` | Spin wheel (recipient decided per spin), member-per-row board, pinned auto-placed, rerun |
| `/assets`     | Land documents grouped by classification (Top / Middle / Bottom), collapsible tables     |
| `/report`     | Full report per member with bulk PDF export                                              |
| `/debug`      | Allocation debug view (not linked from nav; accessible by URL)                           |

---

## Project structure

```
config/                 runtime config (members + documents by class)
data/                   persisted state — gitignored; use Docker volume in prod
src/
  lib/                  pure domain logic (types, validation, allocation, pdf)
  server/               server functions + auth + persistence
  components/           SpinWheel + ui primitives
  routes/               pages
  test/                 vitest tests
docs/PRD.md             architecture reference
Makefile                workflow shortcuts
Dockerfile              multi-stage image (Node 22)
docker-compose.yml      deployment compose
```

Full architecture details are in [`docs/PRD.md`](docs/PRD.md).
