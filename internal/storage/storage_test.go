package storage

import (
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestStorageHelpers(t *testing.T) {
	if !IsSupportedMedia(".png") || !IsSupportedMedia(".MP4") || !IsSupportedMedia(".jpg") {
		t.Errorf("expected media extensions to be supported")
	}
	if IsSupportedMedia(".txt") || IsSupportedMedia(".exe") {
		t.Errorf("unexpected file extension supported")
	}

	if CleanPath("") != "." || CleanPath("/") != "." || CleanPath("/foo/bar") != "foo/bar" {
		t.Errorf("CleanPath failed: got %s", CleanPath("/foo/bar"))
	}
}

func TestLocalStorage(t *testing.T) {
	rootDir := t.TempDir()
	cacheDir := filepath.Join(rootDir, ".cache")

	subDir := filepath.Join(rootDir, "sub")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatal(err)
	}

	f1 := filepath.Join(rootDir, "img1.png")
	_ = os.WriteFile(f1, []byte("fake-png"), 0644)

	f2 := filepath.Join(rootDir, "clip.mp4")
	_ = os.WriteFile(f2, []byte("fake-mp4"), 0644)

	f3 := filepath.Join(subDir, "nested.jpg")
	_ = os.WriteFile(f3, []byte("fake-jpg"), 0644)

	store, err := NewLocalStorage(rootDir, cacheDir)
	if err != nil {
		t.Fatalf("failed to create LocalStorage: %v", err)
	}

	if store.Mode() != "local" {
		t.Errorf("expected mode local, got %s", store.Mode())
	}

	t.Run("ListImages", func(t *testing.T) {
		items, err := store.ListImages(".", "", nil)
		if err != nil {
			t.Fatal(err)
		}
		if len(items) != 2 {
			t.Errorf("expected 2 items in root, got %d", len(items))
		}

		itemsFiltered, err := store.ListImages(".", "clip", nil)
		if err != nil {
			t.Fatal(err)
		}
		if len(itemsFiltered) != 1 || itemsFiltered[0].Name != "clip.mp4" {
			t.Errorf("unexpected query filter result: %+v", itemsFiltered)
		}
	})

	t.Run("ListDirs", func(t *testing.T) {
		dirs, err := store.ListDirs(".", false)
		if err != nil {
			t.Fatal(err)
		}
		if len(dirs) != 1 || dirs[0].Name != "sub" {
			t.Errorf("unexpected dirs result: %+v", dirs)
		}

		treeDirs, err := store.ListDirs(".", true)
		if err != nil {
			t.Fatal(err)
		}
		if len(treeDirs) < 2 {
			t.Errorf("expected recursive dirs, got %+v", treeDirs)
		}
	})

	t.Run("GetFile", func(t *testing.T) {
		r, sz, _, err := store.GetFile("img1.png")
		if err != nil {
			t.Fatal(err)
		}
		defer r.Close()
		content, _ := io.ReadAll(r)
		if string(content) != "fake-png" || sz != int64(len("fake-png")) {
			t.Errorf("unexpected file content: %s (size %d)", content, sz)
		}
	})

	t.Run("GetLocalFile", func(t *testing.T) {
		localPath, cleanup, err := store.GetLocalFile("clip.mp4")
		if err != nil {
			t.Fatal(err)
		}
		defer cleanup()
		if _, err := os.Stat(localPath); err != nil {
			t.Errorf("local file does not exist: %v", err)
		}
	})
}
