package server

import (
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/mamorett/qimg/internal/extractor"
	"github.com/mamorett/qimg/internal/png"
	"github.com/mamorett/qimg/internal/thumbs"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/webp"
)

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, ErrorResponse{Error: message})
}

func (s *Server) handleListImages(w http.ResponseWriter, r *http.Request) {
	dirParam := r.URL.Query().Get("dir")
	if dirParam == "" {
		dirParam = "."
	}

	absDir, err := s.resolve(dirParam)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	st, err := os.Stat(absDir)
	if err != nil || !st.IsDir() {
		writeError(w, http.StatusNotFound, "directory not found")
		return
	}

	entries, err := os.ReadDir(absDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read directory")
		return
	}

	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	extParam := r.URL.Query().Get("ext")
	var extFilter map[string]bool
	if extParam != "" {
		extFilter = make(map[string]bool)
		for _, e := range strings.Split(extParam, ",") {
			e = strings.ToLower(strings.TrimSpace(e))
			if e != "" {
				if !strings.HasPrefix(e, ".") {
					e = "." + e
				}
				extFilter[e] = true
			}
		}
	}

	relDirFromRoot, err := filepath.Rel(s.config.Root, absDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to compute relative directory")
		return
	}
	if relDirFromRoot == "." {
		relDirFromRoot = ""
	}

	var items []ImageItem
	for _, entry := range entries {
		if entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		ext := filepath.Ext(entry.Name())
		if !isSupportedImage(ext) {
			continue
		}

		if q != "" && !strings.Contains(strings.ToLower(entry.Name()), q) {
			continue
		}

		if len(extFilter) > 0 && !extFilter[strings.ToLower(ext)] {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		relPath := entry.Name()
		if relDirFromRoot != "" {
			relPath = path.Join(filepath.ToSlash(relDirFromRoot), entry.Name())
		}

		items = append(items, ImageItem{
			Path:    relPath,
			Name:    entry.Name(),
			Ext:     ext,
			Size:    info.Size(),
			ModTime: info.ModTime(),
			IsPng:   strings.EqualFold(ext, ".png"),
		})
	}

	sortParam := r.URL.Query().Get("sort")
	orderParam := r.URL.Query().Get("order")
	if sortParam == "" {
		sortParam = "name"
	}
	if orderParam == "" {
		orderParam = "asc"
	}

	sort.Slice(items, func(i, j int) bool {
		var less bool
		switch sortParam {
		case "mtime":
			less = items[i].ModTime.Before(items[j].ModTime)
		case "size":
			less = items[i].Size < items[j].Size
		default: // "name"
			less = strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
		}

		if strings.EqualFold(orderParam, "desc") {
			return !less
		}
		return less
	})

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	if size < 1 {
		size = 60
	}
	if size > 500 {
		size = 500
	}

	total := len(items)
	start := (page - 1) * size
	end := start + size

	pagedItems := []ImageItem{}
	if start < total {
		if end > total {
			end = total
		}
		pagedItems = items[start:end]
	}

	displayDir := filepath.ToSlash(relDirFromRoot)
	if displayDir == "" {
		displayDir = "."
	}

	writeJSON(w, http.StatusOK, ImageListResponse{
		Dir:   displayDir,
		Items: pagedItems,
		Total: total,
		Page:  page,
		Size:  size,
	})
}

func (s *Server) handleListDirs(w http.ResponseWriter, r *http.Request) {
	isRecursive := r.URL.Query().Get("recursive") == "true" || r.URL.Query().Get("tree") == "true"

	if isRecursive {
		var dirs []DirItem
		dirImageCounts := make(map[string]int)

		_ = filepath.WalkDir(s.config.Root, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				if strings.HasPrefix(d.Name(), ".") && p != s.config.Root {
					return filepath.SkipDir
				}
				if s.config.CacheDir != "" && p == s.config.CacheDir {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasPrefix(d.Name(), ".") && isSupportedImage(filepath.Ext(d.Name())) {
				parent := filepath.Dir(p)
				relParent, err := filepath.Rel(s.config.Root, parent)
				if err == nil {
					relSlash := filepath.ToSlash(relParent)
					dirImageCounts[relSlash]++
				}
			}
			return nil
		})

		_ = filepath.WalkDir(s.config.Root, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if !d.IsDir() {
				return nil
			}
			if strings.HasPrefix(d.Name(), ".") && p != s.config.Root {
				return filepath.SkipDir
			}
			if s.config.CacheDir != "" && p == s.config.CacheDir {
				return filepath.SkipDir
			}

			rel, err := filepath.Rel(s.config.Root, p)
			if err != nil {
				return nil
			}
			relSlash := filepath.ToSlash(rel)
			name := d.Name()
			if relSlash == "." {
				name = "Root"
			}
			dirs = append(dirs, DirItem{
				Path:       relSlash,
				Name:       name,
				ImageCount: dirImageCounts[relSlash],
			})
			return nil
		})

		if dirs == nil {
			dirs = []DirItem{}
		}

		writeJSON(w, http.StatusOK, DirsResponse{Dirs: dirs})
		return
	}

	dirParam := r.URL.Query().Get("dir")
	if dirParam == "" {
		dirParam = "."
	}

	absDir, err := s.resolve(dirParam)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	st, err := os.Stat(absDir)
	if err != nil || !st.IsDir() {
		writeError(w, http.StatusNotFound, "directory not found")
		return
	}

	entries, err := os.ReadDir(absDir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read directory")
		return
	}

	relDirFromRoot, _ := filepath.Rel(s.config.Root, absDir)
	if relDirFromRoot == "." {
		relDirFromRoot = ""
	}

	var dirs []DirItem
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		subDirPath := filepath.Join(absDir, entry.Name())
		subEntries, err := os.ReadDir(subDirPath)
		imgCount := 0
		if err == nil {
			for _, subEntry := range subEntries {
				if !subEntry.IsDir() && !strings.HasPrefix(subEntry.Name(), ".") && isSupportedImage(filepath.Ext(subEntry.Name())) {
					imgCount++
				}
			}
		}

		relSubPath := entry.Name()
		if relDirFromRoot != "" {
			relSubPath = path.Join(filepath.ToSlash(relDirFromRoot), entry.Name())
		}

		dirs = append(dirs, DirItem{
			Path:       relSubPath,
			Name:       entry.Name(),
			ImageCount: imgCount,
		})
	}

	if dirs == nil {
		dirs = []DirItem{}
	}

	writeJSON(w, http.StatusOK, DirsResponse{Dirs: dirs})
}

func (s *Server) handleGetMetadata(w http.ResponseWriter, r *http.Request) {
	relPath := r.URL.Query().Get("path")
	if relPath == "" {
		writeError(w, http.StatusBadRequest, "path parameter required")
		return
	}

	absPath, err := s.resolve(relPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	st, err := os.Stat(absPath)
	if err != nil || st.IsDir() {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	ext := filepath.Ext(st.Name())
	isPng := strings.EqualFold(ext, ".png")

	wDim, hDim := 0, 0
	if f, err := os.Open(absPath); err == nil {
		cfg, _, err := image.DecodeConfig(f)
		if err == nil {
			wDim = cfg.Width
			hDim = cfg.Height
		}
		f.Close()
	}

	relFromRoot, _ := filepath.Rel(s.config.Root, absPath)
	fileDetails := FileDetails{
		Path:        filepath.ToSlash(relFromRoot),
		Name:        st.Name(),
		Ext:         ext,
		Size:        st.Size(),
		ModTime:     st.ModTime(),
		Width:       wDim,
		Height:      hDim,
		AspectRatio: calcAspectRatio(wDim, hDim),
	}

	var pngMeta *PNGMetadata
	if isPng {
		pngMeta = &PNGMetadata{
			Chunks:  make(map[string]string),
			Prompts: []PromptDTO{},
		}

		chunks, err := png.ReadTextChunks(absPath)
		if err == nil && chunks != nil {
			pngMeta.Chunks = chunks
		}

		pe := &extractor.PromptExtractor{}
		res, errComfy := pe.ExtractComfyUI(absPath, &extractor.ExtractionOptions{Width: wDim, Height: hDim})
		method := "comfyui"

		if errComfy != nil || res == nil || len(res.PositivePrompts) == 0 {
			resParam, errParam := pe.ExtractParameters(absPath, &extractor.ExtractionOptions{Width: wDim, Height: hDim})
			if errParam == nil && resParam != nil && len(resParam.PositivePrompts) > 0 {
				res = resParam
				method = "parameters"
			} else if res == nil && errComfy != nil {
				pngMeta.ExtractionError = errComfy.Error()
			}
		}

		if res != nil {
			pngMeta.ExtractionMethod = method
			for _, p := range res.PositivePrompts {
				pngMeta.Prompts = append(pngMeta.Prompts, PromptDTO{
					Text:     p.Text,
					NodeID:   p.NodeID,
					NodeType: p.NodeType,
					Title:    p.Title,
					Source:   p.Source,
				})
			}
		}
	}

	writeJSON(w, http.StatusOK, MetadataResponse{
		File: fileDetails,
		PNG:  pngMeta,
	})
}

func (s *Server) handleGetThumb(w http.ResponseWriter, r *http.Request) {
	relPath := r.PathValue("path")
	if relPath == "" {
		writeError(w, http.StatusBadRequest, "path required")
		return
	}

	absPath, err := s.resolve(relPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	st, err := os.Stat(absPath)
	if err != nil || st.IsDir() {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	if s.config.CacheDir == "" {
		http.Redirect(w, r, "/img/full/"+relPath, http.StatusFound)
		return
	}

	thumbPath, err := thumbs.Get(s.config.CacheDir, absPath, 384)
	if err != nil {
		http.Redirect(w, r, "/img/full/"+relPath, http.StatusFound)
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, r, thumbPath)
}

func (s *Server) handleGetFull(w http.ResponseWriter, r *http.Request) {
	relPath := r.PathValue("path")
	if relPath == "" {
		writeError(w, http.StatusBadRequest, "path required")
		return
	}

	absPath, err := s.resolve(relPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	st, err := os.Stat(absPath)
	if err != nil || st.IsDir() {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	f, err := os.Open(absPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "cannot open file")
		return
	}
	defer f.Close()

	w.Header().Set("Cache-Control", "public, max-age=3600")
	http.ServeContent(w, r, st.Name(), st.ModTime(), f)
}

func (s *Server) handleGetVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, VersionResponse{
		Name:    "qimg",
		Version: "1.0.0",
	})
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
