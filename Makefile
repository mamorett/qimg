APP_NAME        := qimg
BUILD_DIR       := build
RELEASE_DIR     := $(BUILD_DIR)/release
DOCKER_IMAGE    := qimg:latest

.PHONY: all build frontend backend cross-build dev-backend dev-frontend test clean docker-build

all: build

frontend:
	cd frontend && npm ci && npm run build

backend: frontend
	mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(APP_NAME) ./cmd/qimg

build: backend

cross-build: frontend
	mkdir -p $(RELEASE_DIR)
	@echo "==> Building cross-platform binaries into $(RELEASE_DIR)..."
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(RELEASE_DIR)/$(APP_NAME)-linux-amd64 ./cmd/qimg
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(RELEASE_DIR)/$(APP_NAME)-linux-arm64 ./cmd/qimg
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(RELEASE_DIR)/$(APP_NAME)-darwin-amd64 ./cmd/qimg
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(RELEASE_DIR)/$(APP_NAME)-darwin-arm64 ./cmd/qimg
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(RELEASE_DIR)/$(APP_NAME)-windows-amd64.exe ./cmd/qimg
	@echo "==> Cross-build complete!"

docker-build:
	docker build -t $(DOCKER_IMAGE) .

test:
	go test ./...

dev-backend:
	go run ./cmd/qimg -root $${QIMG_ROOT:-.}

dev-frontend:
	cd frontend && npm run dev

clean:
	rm -rf $(BUILD_DIR) frontend/dist frontend/node_modules
