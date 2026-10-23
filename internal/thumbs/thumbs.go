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
	"runtime"
	"sync"

	_ "golang.org/x/image/bmp"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

var (
	thumbSem  = make(chan struct{}, maxConcurrentThumbs())
	flightMu  sync.Mutex
	flightMap = make(map[string]*flightCall)
)

func maxConcurrentThumbs() int {
	n := runtime.NumCPU()
	if n < 2 {
		return 2
	}
	if n > 8 {
		return 8
	}
	return n
}

type flightCall struct {
	wg  sync.WaitGroup
	val string
	err error
}

// Get returns the absolute path to a cached thumbnail of absPath, with maximum dimension maxDim.
// If force is true, any existing thumbnail is deleted and regenerated from source.
func Get(cacheDir, absPath string, maxDim int, force ...bool) (string, error) {
	st, err := os.Stat(absPath)
	if err != nil {
		return "", err
	}

	isForced := len(force) > 0 && force[0]

	// Key incorporates path, modtime, file size and target dimension.
	keyData := fmt.Sprintf("%s|%d|%d|%d", absPath, st.ModTime().UnixNano(), st.Size(), maxDim)
	key := sha256.Sum256([]byte(keyData))
	hexKey := hex.EncodeToString(key[:])
	thumbFilename := hexKey + ".jpg"
	thumbPath := filepath.Join(cacheDir, thumbFilename)

	if !isForced {
		if fi, err := os.Stat(thumbPath); err == nil && fi.Size() > 0 {
			return thumbPath, nil
		}
	} else {
		_ = os.Remove(thumbPath)
	}

	// Deduplicate concurrent generation requests for the same thumbnail.
	flightMu.Lock()
	call, inFlight := flightMap[thumbPath]
	if inFlight {
		flightMu.Unlock()
		call.wg.Wait()
		return call.val, call.err
	}
	call = &flightCall{}
	call.wg.Add(1)
	flightMap[thumbPath] = call
	flightMu.Unlock()

	defer func() {
		flightMu.Lock()
		delete(flightMap, thumbPath)
		flightMu.Unlock()
		call.wg.Done()
	}()

	// Acquire semaphore to prevent memory exhaustion from dozens of concurrent decodes.
	thumbSem <- struct{}{}
	defer func() { <-thumbSem }()

	// Double check if another flight created it right before we got the semaphore.
	if !isForced {
		if fi, err := os.Stat(thumbPath); err == nil && fi.Size() > 0 {
			call.val = thumbPath
			return thumbPath, nil
		}
	}

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		call.err = fmt.Errorf("failed to create cache directory: %w", err)
		return "", call.err
	}

	f, err := os.Open(absPath)
	if err != nil {
		call.err = fmt.Errorf("failed to open source image: %w", err)
		return "", call.err
	}
	defer f.Close()

	srcImg, _, err := image.Decode(f)
	if err != nil {
		call.err = fmt.Errorf("failed to decode image: %w", err)
		return "", call.err
	}

	bounds := srcImg.Bounds()
	srcWidth := bounds.Dx()
	srcHeight := bounds.Dy()

	if srcWidth <= 0 || srcHeight <= 0 {
		call.err = fmt.Errorf("invalid image dimensions: %dx%d", srcWidth, srcHeight)
		return "", call.err
	}

	targetWidth, targetHeight := computeTargetDimensions(srcWidth, srcHeight, maxDim)

	dstImg := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	draw.CatmullRom.Scale(dstImg, dstImg.Bounds(), srcImg, bounds, draw.Over, nil)

	tmpFile, err := os.CreateTemp(cacheDir, "thumb-*.tmp")
	if err != nil {
		call.err = fmt.Errorf("failed to create temp thumb file: %w", err)
		return "", call.err
	}
	tmpPath := tmpFile.Name()

	opts := &jpeg.Options{Quality: 82}
	if err := jpeg.Encode(tmpFile, dstImg, opts); err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		call.err = fmt.Errorf("failed to encode jpeg thumbnail: %w", err)
		return "", call.err
	}

	if err := tmpFile.Sync(); err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		call.err = fmt.Errorf("failed to sync temp file: %w", err)
		return "", call.err
	}

	if err := tmpFile.Close(); err != nil {
		os.Remove(tmpPath)
		call.err = fmt.Errorf("failed to close temp file: %w", err)
		return "", call.err
	}

	// Verify temp file is non-empty before committing
	if fi, err := os.Stat(tmpPath); err != nil || fi.Size() == 0 {
		os.Remove(tmpPath)
		call.err = fmt.Errorf("generated thumbnail is empty or inaccessible")
		return "", call.err
	}

	if err := os.Rename(tmpPath, thumbPath); err != nil {
		os.Remove(tmpPath)
		call.err = fmt.Errorf("failed to rename temp thumbnail file: %w", err)
		return "", call.err
	}

	call.val = thumbPath
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
