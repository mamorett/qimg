package server

import (
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/mamorett/qimg/internal/extractor"
	"github.com/mamorett/qimg/internal/png"
	"github.com/mamorett/qimg/internal/storage"
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

	items, err := s.storage.ListImages(dirParam, q, extFilter)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
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

	writeJSON(w, http.StatusOK, ImageListResponse{
		Dir:   dirParam,
		Items: pagedItems,
		Total: total,
		Page:  page,
		Size:  size,
	})
}

func (s *Server) handleListDirs(w http.ResponseWriter, r *http.Request) {
	dirParam := r.URL.Query().Get("dir")
	if dirParam == "" {
		dirParam = "."
	}

	isRecursive := r.URL.Query().Get("recursive") == "true" || r.URL.Query().Get("tree") == "true"

	dirs, err := s.storage.ListDirs(dirParam, isRecursive)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, DirsResponse{Dirs: dirs})
}

func (s *Server) handleGetMetadata(w http.ResponseWriter, r *http.Request) {
	relPath := r.URL.Query().Get("path")
	if relPath == "" {
		writeError(w, http.StatusBadRequest, "path parameter required")
		return
	}

	localPath, cleanup, err := s.storage.GetLocalFile(relPath)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	defer cleanup()

	st, err := os.Stat(localPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	ext := filepath.Ext(relPath)
	isPng := strings.EqualFold(ext, ".png")

	wDim, hDim := 0, 0
	if f, err := os.Open(localPath); err == nil {
		cfg, _, err := image.DecodeConfig(f)
		if err == nil {
			wDim = cfg.Width
			hDim = cfg.Height
		}
		f.Close()
	}

	fileDetails := FileDetails{
		Path:        relPath,
		Name:        path.Base(relPath),
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

		chunks, err := png.ReadTextChunks(localPath)
		if err == nil && chunks != nil {
			pngMeta.Chunks = chunks
		}

		pe := &extractor.PromptExtractor{}
		res, errComfy := pe.ExtractComfyUI(localPath, &extractor.ExtractionOptions{Width: wDim, Height: hDim})
		method := "comfyui"

		if errComfy != nil || res == nil || len(res.PositivePrompts) == 0 {
			resParam, errParam := pe.ExtractParameters(localPath, &extractor.ExtractionOptions{Width: wDim, Height: hDim})
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

	localPath, cleanup, err := s.storage.GetLocalFile(relPath)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	defer cleanup()

	if s.config.CacheDir == "" {
		http.Redirect(w, r, "/img/full/"+relPath, http.StatusFound)
		return
	}

	thumbPath, err := thumbs.Get(s.config.CacheDir, localPath, 384)
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

	reader, size, modTime, err := s.storage.GetFile(relPath)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	defer reader.Close()

	w.Header().Set("Cache-Control", "public, max-age=3600")
	if seeker, ok := reader.(io.ReadSeeker); ok {
		http.ServeContent(w, r, path.Base(relPath), modTime, seeker)
		return
	}

	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	w.Header().Set("Last-Modified", modTime.UTC().Format(http.TimeFormat))
	_, _ = io.Copy(w, reader)
}

func (s *Server) handleGetVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, VersionResponse{
		Name:    "qimg",
		Version: "1.0.0",
	})
}

func (s *Server) handleDeleteImage(w http.ResponseWriter, r *http.Request) {
	relPath := r.URL.Query().Get("path")
	if relPath == "" {
		writeError(w, http.StatusBadRequest, "path parameter required")
		return
	}

	err := s.storage.DeleteFile(relPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, DeleteResponse{
		Success: true,
		Path:    relPath,
	})
}

func (s *Server) handleListBuckets(w http.ResponseWriter, r *http.Request) {
	buckets, err := s.storage.ListBuckets()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, BucketsResponse{
		Buckets: buckets,
	})
}

func (s *Server) handleGetMode(w http.ResponseWriter, r *http.Request) {
	configuredBucket := ""
	if s3Store, ok := s.storage.(*storage.S3Storage); ok {
		configuredBucket = s3Store.ConfiguredBucket()
	}
	writeJSON(w, http.StatusOK, ModeResponse{
		Mode:             s.storage.Mode(),
		ConfiguredBucket: configuredBucket,
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
