package index

import (
	"context"
	"encoding/gob"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/mamorett/qimg/internal/extractor"
	"github.com/mamorett/qimg/internal/png"
	"github.com/mamorett/qimg/internal/storage"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/webp"
)

const (
	indexFileName   = "search_index.gob"
	maxChunkIndexed = 64 * 1024 // 64 KB per chunk stored in index
)

// Entry holds cached metadata and prompts for a single file.
type Entry struct {
	Path         string            `json:"path"`
	Size         int64             `json:"size"`
	ModTimeUnix  int64             `json:"modTimeUnix"`
	Width        int               `json:"width,omitempty"`
	Height       int               `json:"height,omitempty"`
	AspectRatio  string            `json:"aspectRatio,omitempty"`
	Prompts      []string          `json:"prompts,omitempty"`
	PromptsLower string            `json:"-"`
	Chunks       map[string]string `json:"chunks,omitempty"`
	ChunksLower  string            `json:"-"`
}

func (e *Entry) initDerived() {
	if len(e.Prompts) > 0 {
		e.PromptsLower = strings.ToLower(strings.Join(e.Prompts, "\n"))
	} else {
		e.PromptsLower = ""
	}

	if len(e.Chunks) > 0 {
		var sb strings.Builder
		for k, v := range e.Chunks {
			sb.WriteString(strings.ToLower(k))
			sb.WriteString(": ")
			sb.WriteString(strings.ToLower(v))
			sb.WriteString("\n")
		}
		e.ChunksLower = sb.String()
	} else {
		e.ChunksLower = ""
	}
}

// Index manages concurrent in-memory and disk-backed search metadata.
type Index struct {
	mu       sync.RWMutex
	cacheDir string
	entries  map[string]*Entry
	saveMu   sync.Mutex
}

// New creates or loads an Index from cacheDir.
func New(cacheDir string) *Index {
	idx := &Index{
		cacheDir: cacheDir,
		entries:  make(map[string]*Entry),
	}

	if cacheDir != "" {
		_ = os.MkdirAll(cacheDir, 0755)
		idx.load()
	}

	return idx
}

func (idx *Index) load() {
	if idx.cacheDir == "" {
		return
	}
	filePath := filepath.Join(idx.cacheDir, indexFileName)
	f, err := os.Open(filePath)
	if err != nil {
		return
	}
	defer f.Close()

	var loaded map[string]*Entry
	if err := gob.NewDecoder(f).Decode(&loaded); err != nil {
		log.Printf("[WARN] Failed to decode search index: %v", err)
		return
	}

	for _, entry := range loaded {
		if entry != nil {
			entry.initDerived()
			idx.entries[entry.Path] = entry
		}
	}
}

// Save persists the current index to disk atomically.
func (idx *Index) Save() error {
	if idx.cacheDir == "" {
		return nil
	}
	idx.saveMu.Lock()
	defer idx.saveMu.Unlock()

	idx.mu.RLock()
	copyMap := make(map[string]*Entry, len(idx.entries))
	for k, v := range idx.entries {
		copyMap[k] = v
	}
	idx.mu.RUnlock()

	tmpFile, err := os.CreateTemp(idx.cacheDir, "search_index_*.tmp")
	if err != nil {
		return fmt.Errorf("failed to create temp index file: %w", err)
	}
	tmpPath := tmpFile.Name()

	enc := gob.NewEncoder(tmpFile)
	if err := enc.Encode(copyMap); err != nil {
		tmpFile.Close()
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to encode search index: %w", err)
	}
	tmpFile.Close()

	destPath := filepath.Join(idx.cacheDir, indexFileName)
	return os.Rename(tmpPath, destPath)
}

// Get returns the cached entry for path if valid.
func (idx *Index) Get(path string) (*Entry, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	entry, ok := idx.entries[path]
	return entry, ok
}

// Delete removes an entry from the index.
func (idx *Index) Delete(path string) {
	idx.mu.Lock()
	delete(idx.entries, path)
	idx.mu.Unlock()
	go func() { _ = idx.Save() }()
}

// EnsureIndexed checks and extracts metadata for candidate items in parallel.
func (idx *Index) EnsureIndexed(
	ctx context.Context,
	items []storage.ImageItem,
	getLocal func(path string) (string, func(), error),
) map[string]*Entry {
	result := make(map[string]*Entry, len(items))
	var toExtract []storage.ImageItem

	idx.mu.RLock()
	for _, item := range items {
		if entry, ok := idx.entries[item.Path]; ok {
			if entry.Size == item.Size && entry.ModTimeUnix == item.ModTime.UnixNano() {
				result[item.Path] = entry
				continue
			}
		}
		toExtract = append(toExtract, item)
	}
	idx.mu.RUnlock()

	if len(toExtract) == 0 {
		return result
	}

	workerCount := runtime.NumCPU()
	if workerCount < 2 {
		workerCount = 2
	}
	if workerCount > 8 {
		workerCount = 8
	}
	if workerCount > len(toExtract) {
		workerCount = len(toExtract)
	}

	jobs := make(chan storage.ImageItem, len(toExtract))
	for _, item := range toExtract {
		jobs <- item
	}
	close(jobs)

	var wg sync.WaitGroup
	var outMu sync.Mutex
	newEntries := make(map[string]*Entry)

	pe := &extractor.PromptExtractor{}

	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range jobs {
				select {
				case <-ctx.Done():
					return
				default:
				}

				entry := idx.extractItem(item, getLocal, pe)
				if entry != nil {
					outMu.Lock()
					newEntries[item.Path] = entry
					result[item.Path] = entry
					outMu.Unlock()
				}
			}
		}()
	}

	wg.Wait()

	if len(newEntries) > 0 {
		idx.mu.Lock()
		for k, v := range newEntries {
			idx.entries[k] = v
		}
		idx.mu.Unlock()

		go func() {
			_ = idx.Save()
		}()
	}

	return result
}

func (idx *Index) extractItem(
	item storage.ImageItem,
	getLocal func(path string) (string, func(), error),
	pe *extractor.PromptExtractor,
) *Entry {
	localPath, cleanup, err := getLocal(item.Path)
	if err != nil {
		return nil
	}
	defer cleanup()

	wDim, hDim := 0, 0
	if f, err := os.Open(localPath); err == nil {
		if cfg, _, err := image.DecodeConfig(f); err == nil {
			wDim = cfg.Width
			hDim = cfg.Height
		}
		f.Close()
	}

	entry := &Entry{
		Path:        item.Path,
		Size:        item.Size,
		ModTimeUnix: item.ModTime.UnixNano(),
		Width:       wDim,
		Height:      hDim,
		AspectRatio: calcAspectRatio(wDim, hDim),
		Chunks:      make(map[string]string),
	}

	if item.IsPng {
		if chunks, err := png.ReadTextChunks(localPath); err == nil && chunks != nil {
			for k, v := range chunks {
				if len(v) > maxChunkIndexed {
					entry.Chunks[k] = v[:maxChunkIndexed]
				} else {
					entry.Chunks[k] = v
				}
			}
		}

		res, errComfy := pe.ExtractComfyUI(localPath, &extractor.ExtractionOptions{Width: wDim, Height: hDim})
		if errComfy != nil || res == nil || len(res.PositivePrompts) == 0 {
			resParam, errParam := pe.ExtractParameters(localPath, &extractor.ExtractionOptions{Width: wDim, Height: hDim})
			if errParam == nil && resParam != nil && len(resParam.PositivePrompts) > 0 {
				res = resParam
			}
		}

		if res != nil {
			for _, p := range res.PositivePrompts {
				textTrim := strings.TrimSpace(p.Text)
				if textTrim != "" {
					entry.Prompts = append(entry.Prompts, textTrim)
				}
			}
		}
	}

	entry.initDerived()
	return entry
}

func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	return a
}

func calcAspectRatio(w, h int) string {
	if w <= 0 || h <= 0 {
		return ""
	}
	g := gcd(w, h)
	return fmt.Sprintf("%d:%d", w/g, h/g)
}
