package storage

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

type LocalStorage struct {
	root     string
	cacheDir string
}

func NewLocalStorage(root, cacheDir string) (*LocalStorage, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("invalid root directory: %w", err)
	}
	st, err := os.Stat(absRoot)
	if err != nil || !st.IsDir() {
		return nil, fmt.Errorf("root path does not exist or is not a directory: %s", absRoot)
	}
	return &LocalStorage{
		root:     absRoot,
		cacheDir: cacheDir,
	}, nil
}

func (l *LocalStorage) Mode() string {
	return "local"
}

func (l *LocalStorage) resolve(rel string) (string, error) {
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

	target := filepath.Join(l.root, filepath.FromSlash(cleanedRel))
	absTarget, err := filepath.Abs(target)
	if err != nil {
		return "", errors.New("invalid path")
	}

	absRoot, err := filepath.Abs(l.root)
	if err != nil {
		return "", errors.New("invalid root")
	}

	relFromRoot, err := filepath.Rel(absRoot, absTarget)
	if err != nil || relFromRoot == ".." || strings.HasPrefix(relFromRoot, ".."+string(os.PathSeparator)) {
		return "", errors.New("path traversal rejected")
	}

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

func (l *LocalStorage) ListImages(dir string, q string, extFilter map[string]bool) ([]ImageItem, error) {
	absDir, err := l.resolve(dir)
	if err != nil {
		return nil, err
	}

	st, err := os.Stat(absDir)
	if err != nil || !st.IsDir() {
		return nil, errors.New("directory not found")
	}

	entries, err := os.ReadDir(absDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	relDirFromRoot, err := filepath.Rel(l.root, absDir)
	if err != nil {
		return nil, fmt.Errorf("failed to compute relative directory: %w", err)
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
		if !IsSupportedMedia(ext) {
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
	return items, nil
}

func (l *LocalStorage) ListDirs(dir string, recursive bool) ([]DirItem, error) {
	if recursive {
		var dirs []DirItem
		dirImageCounts := make(map[string]int)

		_ = filepath.WalkDir(l.root, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				if strings.HasPrefix(d.Name(), ".") && p != l.root {
					return filepath.SkipDir
				}
				if l.cacheDir != "" && p == l.cacheDir {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasPrefix(d.Name(), ".") && IsSupportedMedia(filepath.Ext(d.Name())) {
				parent := filepath.Dir(p)
				relParent, err := filepath.Rel(l.root, parent)
				if err == nil {
					relSlash := filepath.ToSlash(relParent)
					dirImageCounts[relSlash]++
				}
			}
			return nil
		})

		_ = filepath.WalkDir(l.root, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if !d.IsDir() {
				return nil
			}
			if strings.HasPrefix(d.Name(), ".") && p != l.root {
				return filepath.SkipDir
			}
			if l.cacheDir != "" && p == l.cacheDir {
				return filepath.SkipDir
			}

			rel, err := filepath.Rel(l.root, p)
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
		return dirs, nil
	}

	absDir, err := l.resolve(dir)
	if err != nil {
		return nil, err
	}

	st, err := os.Stat(absDir)
	if err != nil || !st.IsDir() {
		return nil, errors.New("directory not found")
	}

	entries, err := os.ReadDir(absDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	relDirFromRoot, _ := filepath.Rel(l.root, absDir)
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
				if !subEntry.IsDir() && !strings.HasPrefix(subEntry.Name(), ".") && IsSupportedMedia(filepath.Ext(subEntry.Name())) {
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
	return dirs, nil
}

func (l *LocalStorage) GetFile(relPath string) (io.ReadCloser, int64, time.Time, error) {
	absPath, err := l.resolve(relPath)
	if err != nil {
		return nil, 0, time.Time{}, err
	}

	st, err := os.Stat(absPath)
	if err != nil || st.IsDir() {
		return nil, 0, time.Time{}, errors.New("file not found")
	}

	f, err := os.Open(absPath)
	if err != nil {
		return nil, 0, time.Time{}, err
	}

	return f, st.Size(), st.ModTime(), nil
}

func (l *LocalStorage) GetLocalFile(relPath string) (string, func(), error) {
	absPath, err := l.resolve(relPath)
	if err != nil {
		return "", func() {}, err
	}
	st, err := os.Stat(absPath)
	if err != nil || st.IsDir() {
		return "", func() {}, errors.New("file not found")
	}
	return absPath, func() {}, nil
}
