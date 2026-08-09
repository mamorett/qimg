# qimg
<p align="center">
  <img src="logo.png" alt="QQuestio Logo" width="500" />
</p>
<p align="center">
  <b>A fast, lightweight web-based image & media browser featuring S3 object storage support, MP4 playback, continuous infinite scroll, dynamic thumbnail fitting, and ComfyUI / Automatic1111 PNG metadata extraction.</b>
</p>

---

## 🌟 Key Features

- 📁 **Dual Storage Backends (Local Directory & S3)**
  - **Local Mode**: Browse subdirectories on your filesystem instantly without importing or building databases.
  - **S3 Mode**: Connect directly to S3 object storage (MinIO, AWS S3, Ceph, Wasabi, Cloudflare R2) using standard `S3_*` environment variables or CLI flags.

- ♾️ **Continuous Infinite Scroll**
  - Smooth continuous scrolling powered by `@tanstack/react-query` and `IntersectionObserver`. Opening and closing image detail dialogs preserves your exact scroll position seamlessly.

- 🎬 **MP4 Video Support**
  - Muted autoplay looping previews in the grid view and interactive HTML5 video player in the detail view.

- 📐 **Dynamic Thumbnail Resizing & Fit / Crop Controls**
  - Customize thumbnail sizes live from **120px to 360px** using the navbar slider or quick **S / M / L** presets.
  - Switch dynamically between **Fit** (`contain`: complete uncropped portrait/landscape framing) and **Crop** (`cover`: square cropped).

- ⬇️ **Explicit Direct File Downloads**
  - Download original files instantly from card views or from the detail modal with a single click.

- 🧠 **ComfyUI & Automatic1111 Prompt Extraction**
  - Automatically parses positive prompts from PNG text chunks (`tEXt`, `zTXt`, `iTXt`), ComfyUI workflow JSON graphs, and A1111 parameters.
  - Markdown rendering toggle and one-click clipboard copying.

- 🎨 **Nord Dark & Editorial Light Themes**
  - Built with BlueprintJS and styled with the Nord dark color palette. Preserves theme and view preferences in `localStorage`.

- ⚡ **Single-Binary Deployment**
  - Embedded React frontend using Go's `embed` package—zero external dependencies required at runtime.

---

## 🚀 Quick Start

### 1. Build from Source

Requirements: **Go** `≥ 1.26`, **Node.js** `≥ 20`

```bash
make build
```

This compiles the React SPA and packages everything into `./build/qimg`.

### 2. Run Local Directory Mode

```bash
./build/qimg -root /path/to/your/images -open
```

Open your browser at `http://localhost:8080`.

---

## ☁️ S3 Object Storage Mode

`qimg` supports S3 object storage as a mutually exclusive option to local directory browsing.

> **Note on Precedence**: If the `-root` flag is explicitly passed on the command line, it **supersedes** any `S3_*` environment variables or flags, opening in Local Directory Mode instead.

### Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `S3_ENDPOINT` | S3 server host and port (**Required to trigger S3 mode**) | `localhost:9000` or `s3.amazonaws.com` |
| `S3_ACCESS_KEY` | S3 Access Key ID | `minioadmin` |
| `S3_SECRET_KEY` | S3 Secret Access Key | `minioadmin` |
| `S3_SECURE` | Set `true` for HTTPS, `false` for HTTP | `false` |
| `S3_REGION` | (Optional) S3 region | `us-east-1` |
| `S3_BUCKET` | (Optional) Target bucket name | `my-image-bucket` |

### S3 Running Examples

#### Local MinIO (HTTP)
```bash
export S3_ENDPOINT="localhost:9000"
export S3_ACCESS_KEY="minioadmin"
export S3_SECRET_KEY="minioadmin"
export S3_SECURE="false"

./build/qimg
```

#### AWS S3 (HTTPS)
```bash
export S3_ENDPOINT="s3.us-east-1.amazonaws.com"
export S3_ACCESS_KEY="AKIAIOSFODNN7EXAMPLE"
export S3_SECRET_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export S3_SECURE="true"
export S3_REGION="us-east-1"
export S3_BUCKET="my-ai-art"

./build/qimg
```

#### CLI Flags Alternative
```bash
./build/qimg -s3-endpoint localhost:9000 -s3-access-key minioadmin -s3-secret-key minioadmin -s3-secure false -s3-bucket my-bucket
```

---

## 🐳 Docker & Docker Compose

### Run with Docker

```bash
# Build Docker image
make docker-build

# Run in Local Mode
docker run -d -p 8080:8080 -v /path/to/images:/data qimg:latest

# Run in S3 Mode
docker run -d -p 8080:8080 \
  -e S3_ENDPOINT="minio.internal:9000" \
  -e S3_ACCESS_KEY="minioadmin" \
  -e S3_SECRET_KEY="minioadmin" \
  -e S3_SECURE="false" \
  qimg:latest
```

### Run with Docker Compose

Spin up both `qimg` and a local **MinIO S3 server**:

```bash
docker-compose up -d
```

- **qimg (Local Mode)**: `http://localhost:8080`
- **qimg (S3 Mode)**: `http://localhost:8081`
- **MinIO Console**: `http://localhost:9001` (user: `minioadmin` / pass: `minioadmin`)

---

## 📦 Cross-Platform Compilation

Compile single-file binaries for Linux, macOS, and Windows with a single command:

```bash
make cross-build
```

Binaries will be placed in `./build/release/`:
- `qimg-linux-amd64`
- `qimg-linux-arm64`
- `qimg-darwin-amd64`
- `qimg-darwin-arm64`
- `qimg-windows-amd64.exe`

---

## ⚙️ Full CLI Options Reference

| Flag | Default | Description |
| :--- | :--- | :--- |
| `-root` | Current working directory | Root directory to browse in Local Mode |
| `-addr` | `:8080` | HTTP server listen address |
| `-open` | `false` | Automatically open default browser on start |
| `-cache` | User cache directory (`~/.cache/qimg/thumbs`) | Thumbnail cache directory |
| `-s3-endpoint` | `""` | S3 server host (e.g., `localhost:9000`) |
| `-s3-access-key` | `""` | S3 Access Key ID |
| `-s3-secret-key` | `""` | S3 Secret Access Key |
| `-s3-secure` | `true` | `true` for HTTPS, `false` for HTTP |
| `-s3-region` | `""` | Optional S3 region |
| `-s3-bucket` | `""` | Optional S3 bucket name |

---

## 🛠️ Development

Run frontend and backend development servers concurrently:

```bash
# Terminal 1: Go backend server (:8080)
make dev-backend

# Terminal 2: Vite React frontend dev server (:5173 with API proxy)
make dev-frontend
```

---

## 📂 Repository Layout

```
qimg/
├── cmd/
│   └── qimg/              # CLI entry point (flags, env vars, S3 vs Local mode init)
├── internal/
│   ├── extractor/         # ComfyUI / A1111 positive prompt extraction engine
│   ├── png/               # PNG tEXt, zTXt, iTXt chunk parser
│   ├── server/            # REST API handlers, path safety, and static SPA serving
│   ├── storage/           # Storage abstraction (LocalStorage & S3Storage via minio-go)
│   └── thumbs/            # Image thumbnail generator & cache
├── frontend/
│   ├── embed.go           # Go embed directive for embedded SPA
│   ├── src/               # React + BlueprintJS UI source
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile             # Multi-stage Docker build file
├── docker-compose.yml     # Docker Compose stack with MinIO S3 support
├── Makefile               # Build, cross-build, dev, and test commands
├── LICENSE
└── README.md
```

---

## 📄 License

MIT License — Copyright (c) 2026 Mattia Moretti.
