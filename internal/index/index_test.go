package index

import (
	"context"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mamorett/qimg/internal/storage"
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
	binary.BigEndian.PutUint32(ihdrData[4:8], 32)
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
			img.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		}
	}
	if err := jpeg.Encode(f, img, nil); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestIndex(t *testing.T) {
	tempDir := t.TempDir()
	cacheDir := filepath.Join(tempDir, "cache")
	_ = os.MkdirAll(cacheDir, 0755)

	pngPath := createTestPNGWithText(t, tempDir, "sunset.png", "Positive prompt", "majestic sunset over ocean")
	jpgPath := createTestJPEG(t, tempDir, "photo.jpg")

	pngSt, _ := os.Stat(pngPath)
	jpgSt, _ := os.Stat(jpgPath)

	idx := New(cacheDir)

	items := []storage.ImageItem{
		{
			Path:    "sunset.png",
			Name:    "sunset.png",
			Ext:     ".png",
			Size:    pngSt.Size(),
			ModTime: pngSt.ModTime(),
			IsPng:   true,
		},
		{
			Path:    "photo.jpg",
			Name:    "photo.jpg",
			Ext:     ".jpg",
			Size:    jpgSt.Size(),
			ModTime: jpgSt.ModTime(),
			IsPng:   false,
		},
	}

	callCount := 0
	getLocal := func(relPath string) (string, func(), error) {
		callCount++
		if relPath == "sunset.png" {
			return pngPath, func() {}, nil
		}
		return jpgPath, func() {}, nil
	}

	ctx := context.Background()
	entries := idx.EnsureIndexed(ctx, items, getLocal)

	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	if callCount != 2 {
		t.Errorf("expected 2 getLocal calls on initial index, got %d", callCount)
	}

	pngEntry := entries["sunset.png"]
	if pngEntry == nil {
		t.Fatal("expected sunset.png entry")
	}
	if len(pngEntry.Prompts) == 0 || pngEntry.Prompts[0] != "majestic sunset over ocean" {
		t.Errorf("unexpected extracted prompt: %+v", pngEntry.Prompts)
	}
	if pngEntry.Width != 64 || pngEntry.Height != 32 || pngEntry.AspectRatio != "2:1" {
		t.Errorf("unexpected dimensions: %dx%d (%s)", pngEntry.Width, pngEntry.Height, pngEntry.AspectRatio)
	}
	if pngEntry.Chunks["Positive prompt"] != "majestic sunset over ocean" {
		t.Errorf("unexpected chunks: %+v", pngEntry.Chunks)
	}

	jpgEntry := entries["photo.jpg"]
	if jpgEntry == nil {
		t.Fatal("expected photo.jpg entry")
	}
	if jpgEntry.Width != 100 || jpgEntry.Height != 50 || jpgEntry.AspectRatio != "2:1" {
		t.Errorf("unexpected JPEG dimensions: %dx%d (%s)", jpgEntry.Width, jpgEntry.Height, jpgEntry.AspectRatio)
	}
	if len(jpgEntry.Prompts) != 0 {
		t.Errorf("expected no prompts for JPEG, got %+v", jpgEntry.Prompts)
	}

	// 2. Test Cache Hit: calling again shouldn't invoke getLocal
	callCount = 0
	entriesHit := idx.EnsureIndexed(ctx, items, getLocal)
	if callCount != 0 {
		t.Errorf("expected 0 getLocal calls on cache hit, got %d", callCount)
	}
	if len(entriesHit) != 2 {
		t.Errorf("expected 2 entries from cache hit, got %d", len(entriesHit))
	}

	// 3. Test Invalidation on ModTime or Size change
	items[0].ModTime = items[0].ModTime.Add(time.Second)
	callCount = 0
	entriesInvalid := idx.EnsureIndexed(ctx, items, getLocal)
	if callCount != 1 {
		t.Errorf("expected 1 getLocal call for invalidated entry, got %d", callCount)
	}
	if len(entriesInvalid) != 2 {
		t.Errorf("expected 2 entries, got %d", len(entriesInvalid))
	}

	// 4. Test Persistence & Reload from Disk
	if err := idx.Save(); err != nil {
		t.Fatalf("failed to save index: %v", err)
	}

	idxReloaded := New(cacheDir)
	reloadedEntry, ok := idxReloaded.Get("photo.jpg")
	if !ok || reloadedEntry == nil {
		t.Fatal("failed to find photo.jpg in reloaded index")
	}
	if reloadedEntry.Width != 100 || reloadedEntry.AspectRatio != "2:1" {
		t.Errorf("unexpected reloaded dimensions: %dx%d (%s)", reloadedEntry.Width, reloadedEntry.Height, reloadedEntry.AspectRatio)
	}

	// 5. Test Delete
	idxReloaded.Delete("photo.jpg")
	if _, ok := idxReloaded.Get("photo.jpg"); ok {
		t.Error("expected photo.jpg to be deleted from index")
	}
}
