package thumbs

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestGetThumbnail(t *testing.T) {
	tempDir := t.TempDir()
	cacheDir := filepath.Join(tempDir, "cache")
	imgDir := filepath.Join(tempDir, "images")
	if err := os.MkdirAll(imgDir, 0755); err != nil {
		t.Fatalf("failed to create imgDir: %v", err)
	}

	imgPath := filepath.Join(imgDir, "test.png")
	f, err := os.Create(imgPath)
	if err != nil {
		t.Fatalf("failed to create image file: %v", err)
	}

	srcImg := image.NewRGBA(image.Rect(0, 0, 800, 400))
	for y := 0; y < 400; y++ {
		for x := 0; x < 800; x++ {
			srcImg.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		}
	}
	if err := png.Encode(f, srcImg); err != nil {
		f.Close()
		t.Fatalf("failed to encode png: %v", err)
	}
	f.Close()

	thumbPath, err := Get(cacheDir, imgPath, 384)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	tf, err := os.Open(thumbPath)
	if err != nil {
		t.Fatalf("failed to open thumbPath: %v", err)
	}
	defer tf.Close()

	decodedThumb, format, err := image.Decode(tf)
	if err != nil {
		t.Fatalf("failed to decode thumbnail: %v", err)
	}
	if format != "jpeg" {
		t.Errorf("expected format jpeg, got %s", format)
	}

	b := decodedThumb.Bounds()
	if b.Dx() != 384 || b.Dy() != 192 {
		t.Errorf("expected 384x192, got %dx%d", b.Dx(), b.Dy())
	}

	// Second call should return cached path without error
	thumbPath2, err := Get(cacheDir, imgPath, 384)
	if err != nil {
		t.Fatalf("Get 2nd call failed: %v", err)
	}
	if thumbPath2 != thumbPath {
		t.Errorf("expected cached path %s, got %s", thumbPath, thumbPath2)
	}

	// Forced call should regenerate
	thumbPath3, err := Get(cacheDir, imgPath, 384, true)
	if err != nil {
		t.Fatalf("Get forced call failed: %v", err)
	}
	if _, err := os.Stat(thumbPath3); err != nil {
		t.Errorf("expected regenerated thumbnail to exist: %v", err)
	}
}

func TestTruncatedDecode(t *testing.T) {
	tempDir := t.TempDir()
	cacheDir := filepath.Join(tempDir, "cache")
	imgDir := filepath.Join(tempDir, "images")
	_ = os.MkdirAll(imgDir, 0755)

	imgPath := filepath.Join(imgDir, "half.png")
	srcImg := image.NewRGBA(image.Rect(0, 0, 400, 400))
	for y := 0; y < 400; y++ {
		for x := 0; x < 400; x++ {
			srcImg.Set(x, y, color.RGBA{R: 0, G: 255, B: 0, A: 255})
		}
	}
	f, _ := os.Create(imgPath)
	_ = png.Encode(f, srcImg)
	f.Close()

	// Truncate to half
	st, _ := os.Stat(imgPath)
	_ = os.Truncate(imgPath, st.Size()/2)

	_, err := Get(cacheDir, imgPath, 384)
	if err == nil {
		t.Fatalf("expected error on truncated image, got nil")
	}
}
