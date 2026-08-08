package server

import (
	"encoding/binary"
	"encoding/json"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writePNGChunk(f *os.File, typeName string, data []byte) {
	_ = binary.Write(f, binary.BigEndian, uint32(len(data)))
	_, _ = f.WriteString(typeName)
	_, _ = f.Write(data)
	crc := crc32.ChecksumIEEE(append([]byte(typeName), data...))
	_ = binary.Write(f, binary.BigEndian, crc)
}

func createTestPNGWithText(t *testing.T, dir, filename, key, val string) string {
	path := filepath.Join(dir, filename)
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	_, _ = f.Write([]byte("\x89PNG\r\n\x1a\n"))

	ihdrData := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdrData[0:4], 64)
	binary.BigEndian.PutUint32(ihdrData[4:8], 64)
	ihdrData[8] = 8
	ihdrData[9] = 2
	writePNGChunk(f, "IHDR", ihdrData)

	textData := append([]byte(key), 0)
	textData = append(textData, []byte(val)...)
	writePNGChunk(f, "tEXt", textData)

	writePNGChunk(f, "IDAT", []byte{0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x01, 0x00, 0x05, 0x00, 0x05})
	writePNGChunk(f, "IEND", nil)

	return path
}

func createTestJPEG(t *testing.T, dir, filename string) string {
	path := filepath.Join(dir, filename)
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	img := image.NewRGBA(image.Rect(0, 0, 100, 50))
	for y := 0; y < 50; y++ {
		for x := 0; x < 100; x++ {
			img.Set(x, y, color.RGBA{R: 0, G: 255, B: 0, A: 255})
		}
	}
	if err := jpeg.Encode(f, img, nil); err != nil {
		t.Fatal(err)
	}
	return path
}

func setupTestServer(t *testing.T) (*Server, string) {
	rootDir := t.TempDir()
	cacheDir := filepath.Join(rootDir, ".cache")

	subDir := filepath.Join(rootDir, "sub")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatal(err)
	}

	createTestPNGWithText(t, rootDir, "test1.png", "Positive prompt", "a beautiful sunset")
	createTestJPEG(t, rootDir, "test2.jpg")
	createTestPNGWithText(t, subDir, "nested.png", "parameters", "a forest view")

	srv, err := New(Config{Root: rootDir, CacheDir: cacheDir})
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}
	return srv, rootDir
}

func TestServerHandlers(t *testing.T) {
	srv, _ := setupTestServer(t)
	ts := httptest.NewServer(srv)
	defer ts.Close()

	// 1. GET /api/version
	t.Run("Version", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/api/version")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		var v VersionResponse
		if err := json.NewDecoder(res.Body).Decode(&v); err != nil {
			t.Fatal(err)
		}
		if v.Name != "qimg" || v.Version != "1.0.0" {
			t.Errorf("unexpected version response: %+v", v)
		}
	})

	// 2. GET /api/images - listing & filter & pagination
	t.Run("ListImages", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/api/images?dir=.")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		var list ImageListResponse
		if err := json.NewDecoder(res.Body).Decode(&list); err != nil {
			t.Fatal(err)
		}
		if list.Total != 2 {
			t.Errorf("expected 2 images in root, got %d", list.Total)
		}

		// Filter by ext=jpg
		resJpg, err := http.Get(ts.URL + "/api/images?dir=.&ext=jpg")
		if err != nil {
			t.Fatal(err)
		}
		defer resJpg.Body.Close()
		var listJpg ImageListResponse
		_ = json.NewDecoder(resJpg.Body).Decode(&listJpg)
		if listJpg.Total != 1 || listJpg.Items[0].Name != "test2.jpg" {
			t.Errorf("expected test2.jpg, got %+v", listJpg)
		}

		// Filter by q=test1
		resQ, err := http.Get(ts.URL + "/api/images?dir=.&q=test1")
		if err != nil {
			t.Fatal(err)
		}
		defer resQ.Body.Close()
		var listQ ImageListResponse
		_ = json.NewDecoder(resQ.Body).Decode(&listQ)
		if listQ.Total != 1 || listQ.Items[0].Name != "test1.png" {
			t.Errorf("expected test1.png, got %+v", listQ)
		}
	})

	// 3. GET /api/dirs
	t.Run("ListDirs", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/api/dirs?dir=.")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		var dirs DirsResponse
		if err := json.NewDecoder(res.Body).Decode(&dirs); err != nil {
			t.Fatal(err)
		}
		if len(dirs.Dirs) != 1 || dirs.Dirs[0].Name != "sub" || dirs.Dirs[0].ImageCount != 1 {
			t.Errorf("unexpected dirs response: %+v", dirs)
		}
	})

	// 4. GET /api/metadata
	t.Run("MetadataPNG", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/api/metadata?path=test1.png")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		var meta MetadataResponse
		if err := json.NewDecoder(res.Body).Decode(&meta); err != nil {
			t.Fatal(err)
		}
		if meta.File.Name != "test1.png" || !strings.EqualFold(meta.File.Ext, ".png") {
			t.Errorf("unexpected file metadata: %+v", meta.File)
		}
		if meta.PNG == nil {
			t.Fatal("expected PNG metadata, got nil")
		}
		if len(meta.PNG.Prompts) == 0 {
			t.Fatalf("unexpected prompts: %+v (chunks: %+v, error: %s)", meta.PNG.Prompts, meta.PNG.Chunks, meta.PNG.ExtractionError)
		}
	})

	t.Run("MetadataJPEG", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/api/metadata?path=test2.jpg")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		var meta MetadataResponse
		if err := json.NewDecoder(res.Body).Decode(&meta); err != nil {
			t.Fatal(err)
		}
		if meta.File.Width != 100 || meta.File.Height != 50 || meta.File.AspectRatio != "2:1" {
			t.Errorf("unexpected JPEG dimensions: %dx%d (%s)", meta.File.Width, meta.File.Height, meta.File.AspectRatio)
		}
		if meta.PNG != nil {
			t.Errorf("expected PNG to be nil for JPEG file, got %+v", meta.PNG)
		}
	})

	// 5. Path Traversal Rejection
	t.Run("PathTraversal", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/api/metadata?path=../../etc/passwd")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusBadRequest && res.StatusCode != http.StatusNotFound {
			t.Errorf("expected 400 or 404 Bad Request for path traversal, got %d", res.StatusCode)
		}
	})

	// 6. Full Image and If-Modified-Since
	t.Run("FullImageAnd304", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/img/full/test2.jpg")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", res.StatusCode)
		}

		lastMod := res.Header.Get("Last-Modified")
		if lastMod == "" {
			t.Fatal("expected Last-Modified header")
		}

		req, _ := http.NewRequest("GET", ts.URL+"/img/full/test2.jpg", nil)
		req.Header.Set("If-Modified-Since", lastMod)
		res304, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res304.Body.Close()

		if res304.StatusCode != http.StatusNotModified {
			t.Errorf("expected 304 Not Modified, got %d", res304.StatusCode)
		}
	})

	// 7. Thumbnail endpoint
	t.Run("Thumbnail", func(t *testing.T) {
		res, err := http.Get(ts.URL + "/img/thumb/test2.jpg")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Errorf("expected 200 OK for thumbnail, got %d", res.StatusCode)
		}
		if res.Header.Get("Cache-Control") == "" {
			t.Errorf("expected Cache-Control header on thumbnail")
		}
	})
}
