package thumbs

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strconv"
	"time"

	_ "golang.org/x/image/bmp"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// Get returns the absolute path to a cached thumbnail of absPath, with maximum dimension maxDim.
func Get(cacheDir, absPath string, maxDim int) (string, error) {
	st, err := os.Stat(absPath)
	if err != nil {
		return "", err
	}

	key := sha256.Sum256([]byte(absPath + "|" + st.ModTime().Format(time.RFC3339Nano) + "|" + strconv.Itoa(maxDim)))
	hexKey := hex.EncodeToString(key[:])
	thumbFilename := hexKey + ".jpg"
	thumbPath := filepath.Join(cacheDir, thumbFilename)

	if _, err := os.Stat(thumbPath); err == nil {
		return thumbPath, nil
	}

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create cache directory: %w", err)
	}

	f, err := os.Open(absPath)
	if err != nil {
		return "", fmt.Errorf("failed to open source image: %w", err)
	}
	defer f.Close()

	srcImg, _, err := image.Decode(f)
	if err != nil {
		return "", fmt.Errorf("failed to decode image: %w", err)
	}

	bounds := srcImg.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()

	if srcWidth <= 0 || srcHeight <= 0 {
		return "", fmt.Errorf("invalid image dimensions: %dx%d", srcWidth, srcHeight)
	}

	targetWidth, targetHeight := computeTargetDimensions(srcWidth, srcHeight, maxDim)

	dstImg := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	draw.CatmullRom.Scale(dstImg, dstImg.Bounds(), srcImg, bounds, draw.Over, nil)

	tmpFile, err := os.CreateTemp(cacheDir, "thumb-*.tmp")
	if err != nil {
		return "", fmt.Errorf("failed to create temp thumb file: %w", err)
	}
	tmpPath := tmpFile.Name()

	opts := &jpeg.Options{Quality: 82}
	if err := jpeg.Encode(tmpFile, dstImg, opts); err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		return "", fmt.Errorf("failed to encode jpeg thumbnail: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		os.Remove(tmpPath)
		return "", fmt.Errorf("failed to close temp file: %w", err)
	}

	if err := os.Rename(tmpPath, thumbPath); err != nil {
		os.Remove(tmpPath)
		return "", fmt.Errorf("failed to rename temp thumbnail file: %w", err)
	}

	return thumbPath, nil
}

func computeTargetDimensions(srcW, srcH, maxDim int) (int, int) {
	if srcW <= maxDim && srcH <= maxDim {
		return srcW, srcH
	}
	if srcW >= srcH {
		targetW := maxDim
		targetH := (srcH * maxDim) / srcW
		if targetH < 1 {
			targetH = 1
		}
		return targetW, targetH
	}
	targetH := maxDim
	targetW := (srcW * maxDim) / srcH
	if targetW < 1 {
		targetW = 1
	}
	return targetW, targetH
}
