# qimg — Implementation Plan

> **Audience:** an AI software engineer executing this plan end-to-end.
> **Goal:** turn this repository (currently `goKomfy`, a Fyne desktop app) into **qimg** — a local web-based image browser with a Go backend and a React + BlueprintJS frontend, reusing the existing PNG/ComfyUI metadata-extraction engine.
> **Working directory:** `/Users/trithemius/gorgon/ia/qimg`

---

## 1. Background and current state

The repository today is **goKomfy**, a desktop (Fyne) application + CLI that extracts *positive prompts* from ComfyUI-generated PNG files. The extraction engine is excellent and UI-independent; the desktop UI is being discarded.

### 1.1 Existing assets to KEEP (reuse)

| Path | What it is | Fate |
|---|---|---|
| `internal/png/chunks.go` + `chunks_test.go` | Raw PNG chunk reader. Parses `tEXt`, `zTXt`, `iTXt` chunks into `map[string]string`, with 100 MB chunk/decompression limits. | **Keep as-is** (only fix the module import path, §4.1). |
| `internal/extractor/extractor.go` + `extractor_test.go` | ComfyUI prompt extraction. Entry points: `ExtractComfyUI`, `ExtractParameters`, `ExtractJSON`, `ExtractText` on `*PromptExtractor`. Returns `*ExtractionResult` with `FileInfo{Filename,Width,Height,Mode}` and `[]PromptInfo{Text,NodeID,NodeType,Title,Source}`. | **Keep as-is** (only fix the module import path). |
| `theme.css` (repo root) | Editorial light theme + `body.theme-dark-nord` dark theme, both as Blueprint v6 (`bp6-*`) CSS overrides driven by CSS variables (`--bg-primary`, `--accent-primary`, `--font-mono`, …). | **Move** to `frontend/src/theme.css` (§5.4). |
| `App.tsx` (repo root) | Reference UI from a sibling project ("Parq"). Defines the layout idiom to imitate: Blueprint `Navbar` with heading/divider/minimal buttons, `Select` from `@blueprintjs/select`, `OverlayToaster` singleton + `showToaster` helper, `Dialog` for About, `NonIdealState`/`Spinner` for empty/error/loading states, theme toggle persisted to `localStorage`, URL search-param state. | **Use as reference**, then **delete** from repo root (§5.6). |
| `blueprint_docs/` | Offline BlueprintJS v6 docs in Markdown (`core/`, `select/`, `table/`, `datetime/`, `icons/`, `blueprint/`). | **Keep** as agent reference. Consult these docs for component APIs while coding the frontend; do not import anything from this folder. |
| `cmd/komfy/logo.png` | App logo. | **Copy** to `frontend/src/assets/logo.png`, then remove with the rest of `cmd/komfy/`. |
| `LICENSE` | MIT, Copyright (c) 2026 Mattia Moretti. | Keep. |

### 1.2 Existing code to REMOVE (dead after the rewrite)

Remove entirely:

- `internal/ui/` — the whole Fyne desktop UI (`mainwindow.go`, `dropzone.go`, `shortcuts.go`, `theme.go`, `about.go`, `readonly_entry.go`, `version.go`, `bundled.go`).
- `cmd/komfy/` — Fyne app entry point (`main.go`, `bundled.go`, `logo.png`, `logo_macos.png`). Copy `logo.png` out first (see §1.1).
- `cmd/komfy-cli/` — CLI entry point; the web backend supersedes it.
- `bundle_macos.sh` — Fyne/macOS bundle script.
- `assets/linux/` — `.desktop` file for the old Linux install.
- `build/` — old build artifacts.
- All `.DS_Store` files.
- `App.tsx` and `theme.css` at repo root — once the frontend has absorbed them (end of Phase 5).
- `README.md` is already deleted in git; a brand-new one is written in Phase 6.

Go module dependencies to drop via `go mod tidy` (§4.1): `fyne.io/fyne/v2`, `github.com/atotto/clipboard`, and all their transitive deps. `golang.org/x/image` **stays** — the backend uses `golang.org/x/image/draw` for thumbnails.

### 1.3 Facts about the kept code the executor must know

- `extractor.PromptExtractor.ExtractComfyUI(path, opts...)` reads PNG text chunks and tries, in order: `workflow` chunk (UI format, `nodes` array) → `prompt` chunk (API format, `class_type` map). Returns prompts found in `CLIPTextEncode` nodes, heuristically filtered to *positive* prompts.
- `ExtractParameters(path, opts...)` handles A1111-style `parameters` text chunks and "Positive prompt"-style PNG properties.
- The established caller pattern (from the old `cmd/komfy-cli/main.go`) is: try `ExtractComfyUI`; if it yields zero prompts, fall back to `ExtractParameters`. **The backend must follow the same cascade.**
- `png.ReadTextChunksFromReader(io.ReadSeeker)` requires a seeker; `os.File` satisfies it.
- Existing tests generate fixtures in `t.TempDir()`-style temp files — no testdata directory, no external fixtures. They must keep passing unchanged apart from the import-path rename.
- The current Go tests pass: run `go test ./...` to confirm before starting.

---

## 2. Target architecture

```
┌────────────────────────────────────────────────────────────┐
│ qimg binary (single Go executable)                         │
│                                                            │
│  cmd/qimg/main.go        flags, logging, graceful start    │
│  internal/server/        HTTP API + static file serving    │
│  internal/thumbs/        thumbnail generation + disk cache │
│  internal/extractor/     (kept) prompt extraction          │
│  internal/png/           (kept) PNG chunk reader           │
│  frontend/embed.go       //go:embed all:dist               │
│                                                            │
│  serves:  http://localhost:8080/        → embedded SPA     │
│           http://localhost:8080/api/... → JSON API         │
│           http://localhost:8080/img/... → image bytes      │
└────────────────────────────────────────────────────────────┘
```

**Principles**

- The server is read-only with respect to the image collection. It never writes into the scanned directories (thumbnail cache lives outside them, §4.5).
- One binary: the built frontend (`frontend/dist`) is embedded with `go:embed`; no separate static-file deployment.
- No new Go third-party dependencies beyond what `go.mod` already has — the standard library (`net/http`) is enough. Do **not** add a router framework; use Go 1.22+ pattern routing (`http.ServeMux` with method+wildcard patterns). The module already targets `go 1.26.1`.
- Frontend stack mirrors the reference `App.tsx`: **Vite + React 18 + TypeScript + BlueprintJS v6 + @tanstack/react-query**. No react-router (the reference manages state through URL search params).

---

## 3. Repository layout after the rewrite

```
qimg/
├── cmd/
│   └── qimg/
│       └── main.go              # entry point: flags, root dir validation, server start
├── internal/
│   ├── extractor/               # KEPT (import path renamed)
│   │   ├── extractor.go
│   │   └── extractor_test.go
│   ├── png/                     # KEPT
│   │   ├── chunks.go
│   │   └── chunks_test.go
│   ├── server/                  # NEW: HTTP handlers, routing, path safety
│   │   ├── server.go            # Server type, New(), Routes()
│   │   ├── handlers.go          # API handlers
│   │   ├── handlers_test.go     # httptest-based tests
│   │   └── types.go             # API DTOs
│   └── thumbs/                  # NEW: thumbnails
│       ├── thumbs.go
│       └── thumbs_test.go
├── frontend/
│   ├── embed.go                 # //go:embed all:dist (package frontend)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── theme.css            # moved from repo root
│       ├── api/client.ts        # typed fetch wrappers
│       ├── api/types.ts         # mirrors of the Go DTOs
│       ├── hooks/useImages.ts
│       ├── hooks/useImageMetadata.ts
│       ├── hooks/useUrlState.ts
│       ├── assets/logo.png
│       └── components/
│           ├── AppNavbar.tsx
│           ├── Sidebar.tsx
│           ├── ImageGrid.tsx
│           ├── ImageCard.tsx
│           ├── DetailDialog.tsx
│           ├── PromptPanel.tsx
│           └── AboutDialog.tsx
├── blueprint_docs/              # KEPT — offline Blueprint reference for agents
├── go.mod                       # module renamed to github.com/mamorett/qimg
├── go.sum
├── Makefile                     # rewritten for qimg
├── PLAN.md                      # this file
├── README.md                    # NEW
├── LICENSE                      # KEPT
└── .gitignore                   # extended (node_modules, dist, .DS_Store, thumbs cache)
```

---

## 4. Backend specification

### 4.1 Phase 1 — module rename and dependency diet

1. In `go.mod`, rename the module: `module github.com/mamorett/qimg`.
2. Update every import path referencing the old module: `github.com/mamorett/goKomfy/internal/png` → `github.com/mamorett/qimg/internal/png`. This touches `internal/extractor/extractor.go`, the two `*_test.go` files, and any file that imports `internal/extractor`. Use: `grep -rn "mamorett/goKomfy" --include="*.go" .` to find them all.
3. After the deletions in §1.2, run `go mod tidy`. Verify `fyne.io` and `atotto/clipboard` are gone from `go.mod`/`go.sum` and `golang.org/x/image` remains.
4. Verify: `go build ./... && go test ./...` must pass before proceeding.

### 4.2 Configuration and entry point — `cmd/qimg/main.go`

Flags (standard `flag` package):

| Flag | Default | Meaning |
|---|---|---|
| `-root` | current working directory | Root directory to browse for images. Must exist and be a directory; resolve to an absolute path at startup. |
| `-addr` | `:8080` | Listen address for the HTTP server. |
| `-open` | `false` | Open the default browser at the server URL after start (`xdg-open` on Linux, `open` on macOS). |
| `-cache` | `${os.UserCacheDir}/qimg/thumbs` | Thumbnail cache directory. |

Behavior: validate `-root`; create `-cache` if missing; construct `server.New(server.Config{Root, CacheDir})`; mount routes; print a single startup line (`qimg serving <root> on http://localhost:8080`); `log.Fatal` on `ListenAndServe` error. Keep `main.go` thin — all logic lives in `internal/server`.

### 4.3 Image discovery rules (shared by several endpoints)

- Supported extensions (case-insensitive): `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`.
- Recursive walk of `-root` with `filepath.WalkDir`.
- Skip hidden files/dirs (base name starts with `.`).
- Do not follow symlinks pointing outside `-root` (resolve with `filepath.EvalSymlinks` and check containment).
- PNG files are the only ones eligible for metadata/prompt extraction; all supported types are viewable.

### 4.4 Path safety (mandatory)

Every handler that takes a client-supplied path must:

1. Treat the path as relative to `-root`; `filepath.Join(root, clean)` after `path.Clean` on the slash-separated URL path (convert with `filepath.FromSlash`).
2. Reject (`400`) any result escaping `-root`: after `filepath.Abs`, the result must equal root or be prefixed by `root + string(os.PathSeparator)`.
3. Reject (`404`) nonexistent paths and (`400`) paths that resolve to directories where a file is expected.
4. Centralize this in one helper, e.g. `func (s *Server) resolve(rel string) (string, error)` in `internal/server/server.go`, and use it everywhere. Add unit tests with `../` traversal attempts.

### 4.5 Thumbnails — `internal/thumbs/thumbs.go`

- `func Get(cacheDir, absPath string, maxDim int) (thumbPath string, err error)`:
  - Cache key: SHA-256 hex of `absPath + "|" + modTime.String() + "|" + maxDim`. File name `<hex>.jpg` under `cacheDir`.
  - Cache hit → return path immediately.
  - Miss → decode with the standard `image` package (blank imports of `image/jpeg`, `image/png`, `image/gif`; `golang.org/x/image/bmp` and `golang.org/x/image/webp` if `x/image` provides them — it does for both), downscale with `golang.org/x/image/draw.CatmullRom` (or `draw.ApproxBiLinear` for speed) preserving aspect ratio so the longest side ≤ `maxDim`, encode as JPEG quality 82, write atomically (temp file + rename).
  - For animated GIFs the first frame is fine.
- Do **not** cache failures; return the error and let the handler fall back (§4.6).

### 4.6 HTTP API

All JSON responses use `Content-Type: application/json`. Error body: `{"error": "<message>"}` with an appropriate 4xx/5xx status. Routes use `http.ServeMux` patterns.

| Method & pattern | Description |
|---|---|
| `GET /api/images` | List images. Query params: `dir` (subdir relative to root, default `.`, **non-recursive** when set; the root listing is also non-recursive — see `dirs` below), `sort` (`name`\|`mtime`\|`size`, default `name`), `order` (`asc`\|`desc`, default `asc`), `q` (case-insensitive substring on file name), `ext` (comma-separated filter, e.g. `png,jpg`), `page` (1-based, default 1), `size` (page size, default 60, max 500). |
| `GET /api/dirs` | Immediate subdirectories of `dir` (default `.`): `{"dirs":[{"path":"sub/dir","name":"dir","imageCount":12}]}` — drives the sidebar. `imageCount` counts supported files directly inside that dir. |
| `GET /api/metadata?path=<rel>` | Detail for one image: file info, decoded dimensions (via `image.DecodeConfig`), and for PNGs the raw text chunks plus extracted prompts (cascade: `ExtractComfyUI` → `ExtractParameters`, exactly as the old CLI did, §1.3). Non-PNG → `png: null`. |
| `GET /img/thumb/<path…>` | 384px thumbnail JPEG (`internal/thumbs`). On thumbnail failure, 302-redirect to `/img/full/<path…>`. `Cache-Control: public, max-age=86400`. |
| `GET /img/full/<path…>` | Original file bytes with the right `Content-Type` (from extension), `Content-Length`, and `Cache-Control: public, max-age=3600`. Support `If-Modified-Since` → `304` via `http.ServeContent` (it handles this and `Range` for free — prefer `http.ServeContent` over `io.Copy`). |
| `GET /api/version` | `{"name":"qimg","version":"1.0.0"}` |
| `GET /{$}` and all other non-API routes | Embedded SPA. Serve `frontend/dist` via `http.FileServerFS(frontend.Dist)`; for any path not found in the FS and not starting with `/api/` or `/img/`, fall back to `index.html` (SPA history-mode safety). |

**DTOs** (`internal/server/types.go`) — keep field names stable; the frontend mirrors them:

```jsonc
// GET /api/images
{
  "dir": ".",
  "items": [
    {
      "path": "photos/cat.png",   // slash-separated, relative to root
      "name": "cat.png",
      "ext": ".png",
      "size": 2048123,            // bytes
      "modTime": "2026-08-01T12:34:56Z",
      "isPng": true
    }
  ],
  "total": 137,
  "page": 1,
  "size": 60
}

// GET /api/metadata?path=photos/cat.png
{
  "file": {
    "path": "photos/cat.png",
    "name": "cat.png",
    "ext": ".png",
    "size": 2048123,
    "modTime": "2026-08-01T12:34:56Z",
    "width": 1024,
    "height": 1024,
    "aspectRatio": "1:1"          // reduce w/h by gcd, as the old UI did
  },
  "png": {                        // null for non-PNG
    "chunks": { "workflow": "{…}", "prompt": "{…}" },   // raw text chunks, verbatim
    "extractionMethod": "comfyui",
    "prompts": [
      { "text": "…", "nodeId": "5", "nodeType": "CLIPTextEncode", "title": "Positive", "source": "workflow" }
    ]
  }
}
```

Notes:

- The `prompts` array maps 1:1 from `extractor.PromptInfo` (JSON tags lower-cased: `text`, `nodeId`, `nodeType`, `title`, `source`).
- `chunks` can be large (full workflow JSON). That is acceptable — the detail view shows it on demand only. Do not include `chunks` in the list endpoint.
- Extraction errors must not fail the whole request: set `"extractionError": "<msg>"` inside `png` and leave `prompts` empty.

### 4.7 Embedding — `frontend/embed.go`

```go
// Package frontend embeds the built SPA.
package frontend

import "embed"

//go:embed all:dist
var Dist embed.FS
```

`internal/server` serves it via a sub-FS: `fs.Sub(frontend.Dist, "dist")`. The Go build depends on `frontend/dist` existing — the Makefile enforces build order (§7). For `go test ./...` to work on a fresh clone without a frontend build, commit a minimal placeholder `frontend/dist/index.html` (`<!-- placeholder; run make frontend -->`) and let `.gitignore` ignore `frontend/dist/*` **except** `.gitkeep`-style placeholder (`!frontend/dist/index.html`).

### 4.8 Backend tests

- `internal/server/handlers_test.go`: build a temp-dir tree with a real PNG containing a `tEXt` chunk (generate it in-test, the way `internal/png/chunks_test.go` already does — reuse that technique), plus a JPEG and a nested subdir. Test: listing shape and pagination, `ext`/`q` filters, sorting, metadata for PNG (prompts present) and JPEG (`png: null`), traversal rejection (`GET /api/metadata?path=../../etc/passwd` → 400/404), `If-Modified-Since` → 304 on `/img/full/`.
- `internal/thumbs/thumbs_test.go`: thumbnail of a 2000×1000 PNG has longest side ≤ 384, aspect preserved, second call hits the cache (same path, no re-encode — assert modtime unchanged or instrument via a counter).
- All tests must use `t.TempDir()` and `httptest.NewServer` / `httptest.NewRecorder`; no network, no fixtures on disk.

---

## 5. Frontend specification

### 5.1 Scaffold (Phase 3)

- Location: `frontend/`. Tooling: **Vite** (`npm create vite@latest frontend -- --template react-ts`), package manager `npm`.
- Dependencies:
  - `@blueprintjs/core` (v6 line — the docs in `blueprint_docs/` and the `bp6-*` selectors in `theme.css` target v6; verify with `npm view @blueprintjs/core version` and match the major the docs describe),
  - `@blueprintjs/select` (used for the directory picker, as in the reference `App.tsx`),
  - `@blueprintjs/icons`,
  - `@tanstack/react-query`,
  - `react`, `react-dom`, and Vite/TypeScript dev deps.
- CSS import order in `main.tsx` is load-bearing (later wins):
  1. `@blueprintjs/icons/lib/css/blueprint-icons.css`
  2. `@blueprintjs/core/lib/css/blueprint.css`
  3. `./theme.css`
- `vite.config.ts`: dev server proxy so the SPA can call the Go backend during development:

```ts
server: { proxy: { '/api': 'http://localhost:8080', '/img': 'http://localhost:8080' } }
```

- `QueryClientProvider` at the root, as the reference project does.

### 5.2 Reference documents (read before writing components)

- `App.tsx` (repo root, until Phase 5 cleanup) — copy its idioms: navbar composition, `showToaster` singleton pattern, theme toggle effect, About dialog structure, `NonIdealState` for error/empty, `Spinner` for loading.
- `theme.css` — the theme contract. Components must use the CSS variables (`var(--accent-primary)`, `var(--font-mono)`, …) and must not hard-code colors that the themes override.
- `blueprint_docs/` — authoritative component APIs (e.g. `core/navbar.md`, `core/dialog.md`, `core/drawer.md`, `core/card.md`, `core/non-ideal-state.md`, `core/tabs.md`, `core/tag.md`, `select/select-component.md`). Consult these instead of guessing props.

### 5.3 Theming

- Move root `theme.css` → `frontend/src/theme.css`, unchanged except: rename any app-specific naming from "Parq" to "qimg" if present, and keep the Google Fonts `@import` at the top.
- Two themes, exactly as the reference implements them: default **editorial** (light) and **dark-nord**, toggled by adding/removing `theme-dark-nord` on `document.body`. Persist to `localStorage` under key `qimg-theme`; initial value from `localStorage`, default `editorial`.

### 5.4 Application layout (modeled on the reference `App.tsx`)

Single-page app, no router. Overall skeleton:

```
<App>
  <AppNavbar />                    // Blueprint Navbar, see below
  <div className="app-layout">     // theme.css already styles .app-layout / .sidebar / .main-content
    <Sidebar />                    // directories, filters, sort, page size
    <main className="main-content">
      <ImageGrid />                // responsive grid of ImageCard
    </main>
  </div>
  <DetailDialog />                 // full image + metadata + prompts
  <AboutDialog />
  <OverlayToaster position="top-right" />
</App>
```

**AppNavbar** — left group only, mirroring the reference:
- `Navbar.Heading`: **qimg**, bold, `color: var(--accent-primary)`.
- `Navbar.Divider`, then a directory `Select` (`@blueprintjs/select`) listing dirs from `/api/dirs`, minimal+small button with `folder-open` icon — same pattern as the parquet `Select` in the reference.
- Minimal buttons: `Refresh` (`refresh` icon, invalidates the `['images']` query + toast "Image list refreshed"), `About` (`help` icon), and the theme toggle (`moon`/`flash` icon, label `Dark Theme`/`Light Theme` — copy the reference logic verbatim, adapted to `qimg-theme`).

**Sidebar** (`.sidebar` from theme.css):
- `H6` "Search" + Blueprint `InputGroup` (left icon `search`) bound to the `q` filter.
- `FormGroup`-style labeled controls (the theme styles `label.bp6-label`): **Sort by** (`name`/`mtime`/`size`) and **Order** (`asc`/`desc`) as `HTMLSelect` or `SegmentedControl`; **Extension** filter as a row of checkable `Tag`s (`png`, `jpg`, `gif`, `webp`, `bmp`) — a tag with intent-primary border when active, per the theme's `.bp6-tag.bp6-intent-primary`.
- **Page size** selector (30/60/120) — mirrors the reference's page-size control.

**ImageGrid / ImageCard**:
- Responsive CSS grid (`repeat(auto-fill, minmax(180px, 1fr))`, gap ~1rem).
- Each card: Blueprint `Card` (interactive) containing `<img loading="lazy" src="/img/thumb/<path>">`, file name (monospace, truncated with ellipsis), and a small `Tag` row: extension + human-readable size. Cards get the theme's hover border for free.
- Below the grid: pagination controls — prev/next minimal buttons + "Page X of Y" `.pagination-text` (already styled by theme.css).
- States: `Spinner` (size 50, centered) while loading; `NonIdealState` icon `error` + Retry button on failure (copy the reference's error block); `NonIdealState` icon `media` ("No images found", hint to change directory/filters) when `total === 0`.

**DetailDialog** (opened on card click; Blueprint `Dialog`, `icon="media"`, title = file name, width 90%, max ~900px):
- `<img className="detail-dialog-img" src="/img/full/<path>">` (theme.css already constrains it).
- A field block using the theme's `.field-row` / `.field-value` classes: dimensions (`1024 × 1024 · 1:1`), size, modified time, full path (`.path-value`).
- For PNGs, a **PromptPanel**: Blueprint `Tabs` with two tabs — `Prompts` and `Raw Metadata`.
  - `Prompts`: one `Card` per prompt: `H5`/heading = `title` (fall back to `nodeType`), a `Tag` for `source`, the prompt text in a read-only `TextArea` (monospace, `fill`, `readOnly`, `rows` auto-ish ~6), and a `Copy` minimal button (`clipboard` icon) → `navigator.clipboard.writeText` + success toast. When several prompts exist, a `Copy all` button joins them with `\n\n`. When the PNG has no prompts: `NonIdealState` icon `info-sign`, "No prompts found in this PNG".
  - `Raw Metadata`: the `chunks` map rendered as key list — each key as a `Tag`, value in a read-only monospace `TextArea` (values can be huge JSON; keep them collapsed behind the per-key section or a `Collapse`). Include `extractionMethod` as a tag.
- For non-PNGs: show the field block only, plus a `Callout` "Metadata extraction is only available for PNG files."

**AboutDialog** — clone the reference dialog structure (logo image `frontend/src/assets/logo.png` at 180px, `H5` "QIMG — IMAGE BROWSER" styled with accent color/uppercase/letter-spacing, version `1.0.0` in mono, one-line description "A local image browser with ComfyUI prompt inspection.", divider, then mono 0.75rem lines: `Copyright © 2026 Mattia Moretti`, `Built with Go • React • BlueprintJS • TypeScript`, `Licensed under the MIT License`).

**URL state** — `hooks/useUrlState.ts` (adapt the reference pattern): reflect `dir`, `q`, `sort`, `order`, `page`, `size`, `ext`, and the open detail `file` into `window.location.search` via `history.replaceState`, and initialize from it on load. This makes any view deep-linkable.

### 5.5 API client

`api/client.ts` — thin typed wrappers around `fetch` throwing on non-2xx with the server's `{"error"}` message:

```ts
export async function fetchImages(params: ImagesQuery): Promise<ImagesResponse>
export async function fetchDirs(dir: string): Promise<DirsResponse>
export async function fetchMetadata(path: string): Promise<MetadataResponse>
export async function fetchVersion(): Promise<VersionInfo>
```

`api/types.ts` mirrors the DTOs in §4.6 exactly. React Query hooks in `hooks/`: `useImages(params)` (`queryKey: ['images', params]`), `useDirs(dir)`, `useImageMetadata(path | null)` (enabled only when a path is set). Stale time 30s is fine; images are local files.

### 5.6 Frontend conventions and pitfalls

- Blueprint v6 class prefix is `bp6` — `theme.css` already assumes this. If `npm` resolves v5 for some reason, stop and align versions; do not rewrite the CSS.
- Always render through Blueprint components first and plain HTML second; never introduce another component library.
- Use `Intent.SUCCESS` toasts for copy/refresh, `Intent.DANGER` for API errors (surface `error.message` from the API client).
- Thumbnails may be missing for corrupt files — `<img>` `onError` → replace with a `NonIdealState`-style icon placeholder inside the card (simple local state flag).
- Keep components small and typed; no `any`.
- After the frontend builds and runs: delete root `App.tsx` and root `theme.css` (their content now lives in `frontend/`).

---

## 6. README.md (new, repo root)

Write a fresh `README.md` for **qimg** with:

1. Title + one-liner: "qimg — a fast local image browser with ComfyUI/A1111 prompt inspection for PNGs."
2. Screenshot placeholder (`docs/screenshot.png`, noted as TODO if none exists).
3. Features: directory browsing, grid thumbnails, sort/filter/search, PNG text-chunk metadata viewer, positive-prompt extraction (ComfyUI workflow/prompt chunks, A1111 `parameters`, PNG properties), copy-to-clipboard, editorial/dark-nord themes, single-binary deployment with embedded UI.
4. Requirements: Go ≥ 1.26, Node.js ≥ 20 (build only).
5. Build: `make build` (builds frontend, then the Go binary at `build/qimg`).
6. Run: `./build/qimg -root /path/to/images [-addr :8080] [-open]`; open `http://localhost:8080`.
7. Development: `make dev-backend` (Go server on :8080) + `make dev-frontend` (Vite on :5173 with proxy).
8. Project layout summary (the tree from §3, abbreviated).
9. Credits/license: MIT, © 2026 Mattia Moretti; note that it descends from goKomfy and uses BlueprintJS.

---

## 7. Makefile and housekeeping

Rewrite the `Makefile` (the old one is Fyne-specific — replace it wholesale):

```make
APP_NAME  := qimg
BUILD_DIR := build

.PHONY: all build frontend backend dev-backend dev-frontend test clean

all: build

frontend:
	cd frontend && npm ci && npm run build

backend: frontend
	mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(APP_NAME) ./cmd/qimg

build: backend

test:
	go test ./...

dev-backend:
	go run ./cmd/qimg -root $${QIMG_ROOT:-.}

dev-frontend:
	cd frontend && npm run dev

clean:
	rm -rf $(BUILD_DIR) frontend/dist frontend/node_modules
```

Update `.gitignore`: add `node_modules/`, `frontend/dist/*` with `!frontend/dist/index.html` (see §4.7), `build/`, `.DS_Store`, and the default thumbnail cache dir is outside the repo so nothing needed for it.

---

## 8. Execution order (phases with gates)

Work in this order; do not start a phase until the previous gate passes.

1. **Cleanup & rename** — §1.2 deletions, §4.1 module rename, `go mod tidy`. *Gate:* `go build ./... && go test ./...` green.
2. **Backend** — `internal/thumbs`, `internal/server`, `cmd/qimg`, tests (§4.2–4.8). *Gate:* `go test ./...` green; manual smoke: `go run ./cmd/qimg -root <dir-with-images>` and `curl` each endpoint from §4.6, including one `../` traversal attempt expecting rejection.
3. **Frontend scaffold** — §5.1–5.3 (Vite app, deps, theme wired, proxy). *Gate:* `npm run dev` renders the navbar + themed empty state against the running backend.
4. **Frontend features** — §5.4–5.6 components, hooks, detail dialog, toasts, URL state. *Gate:* `npm run build` succeeds with no TypeScript errors; manual run-through of browse → filter → paginate → open PNG → view prompts → copy prompt → toggle theme.
5. **Integration** — `frontend/embed.go`, Makefile (§7), remove root `App.tsx`/`theme.css`, placeholder `frontend/dist/index.html` policy. *Gate:* `make build` produces `build/qimg`; run it with no frontend dev server and verify the full SPA works from the embedded FS at `http://localhost:8080`.
6. **Docs & final pass** — README.md (§6), `.gitignore`, delete stray `.DS_Store`, `gofmt -l .` empty, `go vet ./...` clean, `npm run build` clean. *Gate:* the acceptance criteria in §9 all pass.

## 9. Acceptance criteria

- `go test ./...` passes (kept tests + new server/thumbs tests).
- `make build` yields a single `build/qimg` binary that serves the SPA and API with no external files.
- Browsing a directory of mixed images shows a thumbnail grid; JPG/PNG/GIF/WEBP/BMP all render.
- A ComfyUI PNG opened in the detail dialog shows its positive prompt(s) exactly as the old CLI would print them (spot-check one file against the old behavior before deleting `cmd/komfy-cli/`, or trust the kept extractor tests).
- An A1111-style PNG (`parameters` chunk) shows the positive prompt via the fallback cascade.
- Non-PNG images show dimensions/size fields and the "PNG only" callout.
- Path traversal attempts (`../`) are rejected; nothing outside `-root` is ever served.
- Theme toggle switches editorial ↔ dark-nord and survives reload; qimg-theme is the localStorage key.
- Refresh button re-lists the directory; all user-facing errors surface as danger toasts.
- The repository contains no Fyne code, no `cmd/komfy*`, no `internal/ui`, no root `App.tsx`/`theme.css`, and a new README.md exists.

## 10. Explicit non-goals

- No image editing, uploading, deleting, renaming, or any other write operation on the collection.
- No authentication, multi-user support, or remote access hardening — qimg is a localhost single-user tool.
- No EXIF/XMP parsing for JPEGs, no video, no recursive-gallery "library" database, no virtualized infinite scroll (plain pagination is enough).
- No changes to the extraction heuristics in `internal/extractor` — they are considered correct and frozen.
