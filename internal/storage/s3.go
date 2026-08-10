package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type S3Config struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Secure    bool
	Region    string
	Bucket    string
	CacheDir  string
}

type S3Storage struct {
	client   *minio.Client
	config   S3Config
	cacheDir string
}

func NewS3Storage(cfg S3Config) (*S3Storage, error) {
	if cfg.Endpoint == "" {
		return nil, errors.New("S3_ENDPOINT is required")
	}

	opts := &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.Secure,
	}
	if cfg.Region != "" {
		opts.Region = cfg.Region
	}

	client, err := minio.New(cfg.Endpoint, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to create S3 client: %w", err)
	}

	cacheDir := cfg.CacheDir
	if cacheDir == "" {
		cacheDir = filepath.Join(os.TempDir(), "qimg-s3-cache")
	}
	_ = os.MkdirAll(cacheDir, 0755)

	return &S3Storage{
		client:   client,
		config:   cfg,
		cacheDir: cacheDir,
	}, nil
}

func (s *S3Storage) Mode() string {
	return "s3"
}

func (s *S3Storage) ConfiguredBucket() string {
	return s.config.Bucket
}

func (s *S3Storage) resolveBucketAndPrefix(dir string) (string, string) {
	dir = CleanPath(dir)

	if s.config.Bucket != "" {
		bucket := s.config.Bucket
		prefix := ""
		if dir != "." {
			prefix = dir
			if !strings.HasSuffix(prefix, "/") {
				prefix += "/"
			}
		}
		return bucket, prefix
	}

	if dir == "." || dir == "" {
		return "", ""
	}

	parts := strings.SplitN(dir, "/", 2)
	bucket := parts[0]
	prefix := ""
	if len(parts) > 1 {
		prefix = parts[1]
		if prefix != "" && !strings.HasSuffix(prefix, "/") {
			prefix += "/"
		}
	}
	return bucket, prefix
}

func (s *S3Storage) resolveBucketAndKey(relPath string) (string, string, error) {
	relPath = CleanPath(relPath)
	if relPath == "." {
		return "", "", errors.New("invalid path")
	}

	if s.config.Bucket != "" {
		return s.config.Bucket, relPath, nil
	}

	parts := strings.SplitN(relPath, "/", 2)
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return "", "", errors.New("invalid S3 path: bucket required")
	}
	return parts[0], parts[1], nil
}

func (s *S3Storage) ListImages(dir string, q string, extFilter map[string]bool) ([]ImageItem, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	bucket, prefix := s.resolveBucketAndPrefix(dir)
	if bucket == "" {
		return []ImageItem{}, nil
	}

	opts := minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: false,
	}

	var items []ImageItem
	objectCh := s.client.ListObjects(ctx, bucket, opts)
	for obj := range objectCh {
		if obj.Err != nil {
			continue
		}
		if strings.HasSuffix(obj.Key, "/") {
			continue
		}

		name := path.Base(obj.Key)
		ext := filepath.Ext(name)
		if !IsSupportedMedia(ext) {
			continue
		}

		if q != "" && !strings.Contains(strings.ToLower(name), q) {
			continue
		}

		if len(extFilter) > 0 && !extFilter[strings.ToLower(ext)] {
			continue
		}

		relPath := obj.Key
		if s.config.Bucket == "" {
			relPath = bucket + "/" + obj.Key
		}

		items = append(items, ImageItem{
			Path:    relPath,
			Name:    name,
			Ext:     ext,
			Size:    obj.Size,
			ModTime: obj.LastModified,
			IsPng:   strings.EqualFold(ext, ".png"),
		})
	}
	return items, nil
}

func (s *S3Storage) ListDirs(dir string, recursive bool) ([]DirItem, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if recursive {
		var dirs []DirItem
		dirImageCounts := make(map[string]int)

		var buckets []string
		if s.config.Bucket != "" {
			buckets = []string{s.config.Bucket}
		} else {
			bl, err := s.client.ListBuckets(ctx)
			if err == nil {
				for _, b := range bl {
					buckets = append(buckets, b.Name)
				}
			}
		}

		for _, b := range buckets {
			if s.config.Bucket == "" {
				dirImageCounts[b] = 0
			} else {
				dirImageCounts["."] = 0
			}

			objectCh := s.client.ListObjects(ctx, b, minio.ListObjectsOptions{Recursive: true})
			for obj := range objectCh {
				if obj.Err != nil || strings.HasSuffix(obj.Key, "/") {
					continue
				}
				if !IsSupportedMedia(filepath.Ext(obj.Key)) {
					continue
				}

				dirKey := path.Dir(obj.Key)
				if s.config.Bucket == "" {
					if dirKey == "." {
						dirImageCounts[b]++
					} else {
						dirImageCounts[b+"/"+dirKey]++
					}
				} else {
					if dirKey == "." {
						dirImageCounts["."]++
					} else {
						dirImageCounts[dirKey]++
					}
				}
			}

			if s.config.Bucket == "" {
				dirs = append(dirs, DirItem{
					Path:       b,
					Name:       b,
					ImageCount: dirImageCounts[b],
				})
			} else {
				dirs = append(dirs, DirItem{
					Path:       ".",
					Name:       "Root (.)",
					ImageCount: dirImageCounts["."],
				})
			}

			for dPath, count := range dirImageCounts {
				if dPath == "." || (s.config.Bucket == "" && dPath == b) {
					continue
				}
				name := path.Base(dPath)
				dirs = append(dirs, DirItem{
					Path:       dPath,
					Name:       name,
					ImageCount: count,
				})
			}
		}

		return dirs, nil
	}

	bucket, prefix := s.resolveBucketAndPrefix(dir)
	if bucket == "" {
		// Root level: list buckets
		bl, err := s.client.ListBuckets(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to list buckets: %w", err)
		}
		var dirs []DirItem
		for _, b := range bl {
			dirs = append(dirs, DirItem{
				Path:       b.Name,
				Name:       b.Name,
				ImageCount: 0,
			})
		}
		return dirs, nil
	}

	opts := minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: false,
	}

	var dirs []DirItem
	objectCh := s.client.ListObjects(ctx, bucket, opts)
	for obj := range objectCh {
		if obj.Err != nil {
			continue
		}
		if strings.HasSuffix(obj.Key, "/") {
			cleanKey := strings.TrimSuffix(obj.Key, "/")
			name := path.Base(cleanKey)
			relPath := cleanKey
			if s.config.Bucket == "" {
				relPath = bucket + "/" + cleanKey
			}
			dirs = append(dirs, DirItem{
				Path:       relPath,
				Name:       name,
				ImageCount: 0,
			})
		}
	}
	return dirs, nil
}

func (s *S3Storage) GetFile(relPath string) (io.ReadCloser, int64, time.Time, error) {
	ctx := context.Background()
	bucket, key, err := s.resolveBucketAndKey(relPath)
	if err != nil {
		return nil, 0, time.Time{}, err
	}

	obj, err := s.client.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, 0, time.Time{}, err
	}

	stat, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, 0, time.Time{}, err
	}

	return obj, stat.Size, stat.LastModified, nil
}

func (s *S3Storage) GetLocalFile(relPath string) (string, func(), error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	bucket, key, err := s.resolveBucketAndKey(relPath)
	if err != nil {
		return "", func() {}, err
	}

	stat, err := s.client.StatObject(ctx, bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return "", func() {}, fmt.Errorf("stat object failed: %w", err)
	}

	hash := sha256.Sum256([]byte(bucket + "/" + key + "|" + stat.LastModified.Format(time.RFC3339Nano)))
	cacheKey := hex.EncodeToString(hash[:16]) + filepath.Ext(key)
	cachedPath := filepath.Join(s.cacheDir, cacheKey)

	if _, err := os.Stat(cachedPath); err == nil {
		return cachedPath, func() {}, nil
	}

	obj, err := s.client.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return "", func() {}, err
	}
	defer obj.Close()

	tmpFile, err := os.CreateTemp(s.cacheDir, "s3-dl-*.tmp")
	if err != nil {
		return "", func() {}, err
	}
	tmpPath := tmpFile.Name()

	_, err = io.Copy(tmpFile, obj)
	tmpFile.Close()
	if err != nil {
		os.Remove(tmpPath)
		return "", func() {}, err
	}

	_ = os.Rename(tmpPath, cachedPath)
	return cachedPath, func() {}, nil
}

func (s *S3Storage) DeleteFile(relPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	bucket, key, err := s.resolveBucketAndKey(relPath)
	if err != nil {
		return err
	}

	opts := minio.RemoveObjectOptions{}
	err = s.client.RemoveObject(ctx, bucket, key, opts)
	if err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}
	return nil
}

func (s *S3Storage) ListBuckets() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	bl, err := s.client.ListBuckets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list buckets: %w", err)
	}

	buckets := make([]string, 0, len(bl))
	for _, b := range bl {
		buckets = append(buckets, b.Name)
	}
	return buckets, nil
}

