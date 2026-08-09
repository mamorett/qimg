# Stage 1: Build React Frontend SPA
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go Binary with Embedded Frontend (Native Cross-Compilation)
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS backend-builder
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build -ldflags="-s -w" -o qimg ./cmd/qimg

# Stage 3: Minimal Production Image
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

# Create default directories for data and cache
RUN mkdir -p /data /cache

COPY --from=backend-builder /app/qimg /app/qimg

EXPOSE 8080

ENV QIMG_ROOT="/data"
ENV QIMG_CACHE="/cache"

ENTRYPOINT ["/app/qimg"]
CMD ["-addr", ":8080", "-root", "/data", "-cache", "/cache"]
