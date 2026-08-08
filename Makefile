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
