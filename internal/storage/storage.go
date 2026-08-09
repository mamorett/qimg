package storage

import (
	"io"
	"path/filepath"
	"strings"
	"time"
)

type ImageItem struct {
	Path    string    `json:"path"`
	Name    string    `json:"name"`
	Ext     string    `json:"ext"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
	IsPng   bool      `json:"isPng"`
}

type DirItem struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	ImageCount int    `json:"imageCount"`
}

type FileDetails struct {
	Path        string    `json:"path"`
	Name        string    `json:"name"`
	Ext         string    `json:"ext"`
	Size        int64     `json:"size"`
	ModTime     time.Time `json:"modTime"`
	Width       int       `json:"width"`
	Height      int       `json:"height"`
	AspectRatio string    `json:"aspectRatio"`
}

type Storage interface {
	// ListImages lists media items under dir matching filter params
	ListImages(dir string, q string, extFilter map[string]bool) ([]ImageItem, error)

	// ListDirs lists child or recursive directories under dir
	ListDirs(dir string, recursive bool) ([]DirItem, error)

	// GetFile opens a stream for full file content
	GetFile(path string) (io.ReadCloser, int64, time.Time, error)

	// GetLocalFile returns a local file path (downloading to temp/cache if needed)
	GetLocalFile(path string) (string, func(), error)

	// Mode returns the storage mode name ("local" or "s3")
	Mode() string
}

func IsSupportedMedia(ext string) bool {
	switch strings.ToLower(ext) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".mp4":
		return true
	default:
		return false
	}
}

func CleanPath(p string) string {
	p = strings.TrimSpace(p)
	p = strings.ReplaceAll(p, "\\", "/")
	for strings.HasPrefix(p, "/") {
		p = p[1:]
	}
	if p == "" {
		return "."
	}
	cleaned := filepath.ToSlash(filepath.Clean(p))
	if cleaned == "." || cleaned == "" {
		return "."
	}
	return cleaned
}
