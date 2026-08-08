package server

import (
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/mamorett/qimg/frontend"
)

type Config struct {
	Root     string
	CacheDir string
}

type Server struct {
	config Config
	mux    *http.ServeMux
}

func New(cfg Config) (*Server, error) {
	absRoot, err := filepath.Abs(cfg.Root)
	if err != nil {
		return nil, fmt.Errorf("invalid root directory: %w", err)
	}
	st, err := os.Stat(absRoot)
	if err != nil || !st.IsDir() {
		return nil, fmt.Errorf("root path does not exist or is not a directory: %s", absRoot)
	}
	cfg.Root = absRoot

	if cfg.CacheDir != "" {
		absCache, err := filepath.Abs(cfg.CacheDir)
		if err == nil {
			cfg.CacheDir = absCache
		}
	}

	s := &Server{
		config: cfg,
		mux:    http.NewServeMux(),
	}

	s.routes()
	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/images", s.handleListImages)
	s.mux.HandleFunc("GET /api/dirs", s.handleListDirs)
	s.mux.HandleFunc("GET /api/metadata", s.handleGetMetadata)
	s.mux.HandleFunc("GET /api/version", s.handleGetVersion)
	s.mux.HandleFunc("GET /img/thumb/{path...}", s.handleGetThumb)
	s.mux.HandleFunc("GET /img/full/{path...}", s.handleGetFull)

	// Embedded SPA handling
	subFS, err := fs.Sub(frontend.Dist, "dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(subFS))

	s.mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/img/") {
			http.NotFound(w, r)
			return
		}

		cleanPath := path.Clean(p)
		if cleanPath == "/" || cleanPath == "." {
			fileServer.ServeHTTP(w, r)
			return
		}

		f, err := subFS.Open(strings.TrimPrefix(cleanPath, "/"))
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA routing
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

// resolve verifies that rel stays strictly inside s.config.Root and returns the resolved absolute path.
func (s *Server) resolve(rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	for strings.HasPrefix(rel, "/") || strings.HasPrefix(rel, "\\") {
		rel = rel[1:]
	}
	if rel == "" {
		rel = "."
	}

	cleanedRel := path.Clean(rel)
	if cleanedRel == ".." || strings.HasPrefix(cleanedRel, "../") {
		return "", errors.New("path traversal rejected")
	}

	target := filepath.Join(s.config.Root, filepath.FromSlash(cleanedRel))
	absTarget, err := filepath.Abs(target)
	if err != nil {
		return "", errors.New("invalid path")
	}

	absRoot, err := filepath.Abs(s.config.Root)
	if err != nil {
		return "", errors.New("invalid root")
	}

	relFromRoot, err := filepath.Rel(absRoot, absTarget)
	if err != nil || relFromRoot == ".." || strings.HasPrefix(relFromRoot, ".."+string(os.PathSeparator)) {
		return "", errors.New("path traversal rejected")
	}

	// Check if symlinks resolve outside root if target exists
	evalRoot, err := filepath.EvalSymlinks(absRoot)
	if err != nil {
		evalRoot = absRoot
	}

	evalTarget, err := filepath.EvalSymlinks(absTarget)
	if err == nil {
		relFromEval, err := filepath.Rel(evalRoot, evalTarget)
		if err != nil || relFromEval == ".." || strings.HasPrefix(relFromEval, ".."+string(os.PathSeparator)) {
			return "", errors.New("symlink traversal rejected")
		}
	}

	return absTarget, nil
}

func isSupportedImage(ext string) bool {
	switch strings.ToLower(ext) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp":
		return true
	default:
		return false
	}
}
