package server

import (
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/mamorett/qimg/frontend"
	"github.com/mamorett/qimg/internal/storage"
)

type Config struct {
	Root     string
	CacheDir string
	Storage  storage.Storage
}

type Server struct {
	config  Config
	storage storage.Storage
	mux     *http.ServeMux
}

func New(cfg Config) (*Server, error) {
	if cfg.CacheDir != "" {
		absCache, err := filepath.Abs(cfg.CacheDir)
		if err == nil {
			cfg.CacheDir = absCache
		}
	} else {
		cfg.CacheDir = filepath.Join(os.TempDir(), "qimg-cache")
	}

	st := cfg.Storage
	if st == nil {
		ls, err := storage.NewLocalStorage(cfg.Root, cfg.CacheDir)
		if err != nil {
			return nil, err
		}
		st = ls
	}

	s := &Server{
		config:  cfg,
		storage: st,
		mux:     http.NewServeMux(),
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
	s.mux.HandleFunc("GET /api/buckets", s.handleListBuckets)
	s.mux.HandleFunc("GET /api/mode", s.handleGetMode)
	s.mux.HandleFunc("DELETE /api/image", s.handleDeleteImage)
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
