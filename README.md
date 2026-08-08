# qimg

> A fast, lightweight local web-based image browser with ComfyUI and Automatic1111 PNG metadata & positive prompt inspection.

---

## Features

- **Directory Browsing**: Browse subdirectories without importing or building databases.
- **Responsive Thumbnail Grid**: Dynamic thumbnail generation cached locally outside your image collection.
- **ComfyUI & A1111 Metadata Extraction**: Extract positive prompts from ComfyUI PNG workflows (`workflow`/`prompt` text chunks) and A1111 (`parameters` / PNG properties text chunks).
- **Metadata Viewer**: Inspect raw text chunks, node types, IDs, image dimensions, aspect ratio, and file details.
- **One-Click Copy**: Copy individual prompts or all prompts to clipboard.
- **Theme Support**: Editorial Light and Dark Nord themes, persisted in local storage.
- **Single-Binary Deployment**: Built with Go's `embed` package—the built React frontend is compiled directly into the binary.
- **Path Traversal Protection**: Read-only operation restricted strictly within the specified `-root` path.

---

## Requirements

- **Go**: `≥ 1.26`
- **Node.js**: `≥ 20` (only required when building the frontend)

---

## Quick Start

### 1. Build from Source

```bash
make build
```

This compiles the frontend SPA and embeds it into `./build/qimg`.

### 2. Run

```bash
./build/qimg -root /path/to/your/images -open
```

Open your browser at `http://localhost:8080`.

#### CLI Options

| Flag | Default | Description |
|---|---|---|
| `-root` | Current working directory | Root directory to browse for images |
| `-addr` | `:8080` | Server listen address |
| `-open` | `false` | Automatically open the default browser |
| `-cache` | User cache directory (`~/.cache/qimg/thumbs`) | Directory for cached image thumbnails |

---

## Development

Run the backend and frontend development servers concurrently:

```bash
# Terminal 1: Go backend server (:8080)
make dev-backend

# Terminal 2: Vite React frontend dev server (:5173 with proxy)
make dev-frontend
```

---

## Repository Layout

```
qimg/
├── cmd/
│   └── qimg/              # Entry point (flags, root directory validation, server start)
├── internal/
│   ├── extractor/         # ComfyUI / A1111 positive prompt extraction engine
│   ├── png/               # PNG tEXt, zTXt, iTXt chunk parser
│   ├── server/            # REST API handlers, path safety, and static SPA serving
│   └── thumbs/            # Image thumbnail generator & cache
├── frontend/
│   ├── embed.go           # Go embed directive for embedded SPA
│   ├── src/               # React + BlueprintJS UI source
│   ├── package.json
│   └── vite.config.ts
├── Makefile
├── LICENSE
└── README.md
```

---

## License

MIT License — Copyright (c) 2026 Mattia Moretti.
