package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/mamorett/qimg/internal/server"
	"github.com/mamorett/qimg/internal/storage"
)

func parseBoolEnv(val string, defaultVal bool) bool {
	if val == "" {
		return defaultVal
	}
	val = strings.ToLower(strings.TrimSpace(val))
	return val == "true" || val == "1" || val == "yes" || val == "on"
}

func main() {
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}

	defaultCacheDir := ""
	if userCache, err := os.UserCacheDir(); err == nil {
		defaultCacheDir = filepath.Join(userCache, "qimg", "thumbs")
	} else {
		defaultCacheDir = filepath.Join(os.TempDir(), "qimg-cache", "thumbs")
	}

	// S3 environment variable defaults
	s3EndpointEnv := os.Getenv("S3_ENDPOINT")
	s3AccessKeyEnv := os.Getenv("S3_ACCESS_KEY")
	s3SecretKeyEnv := os.Getenv("S3_SECRET_KEY")
	s3SecureEnv := os.Getenv("S3_SECURE")
	s3RegionEnv := os.Getenv("S3_REGION")
	s3BucketEnv := os.Getenv("S3_BUCKET")

	// CLI flags
	rootDirFlag := flag.String("root", cwd, "Root directory to browse for local images")
	addrFlag := flag.String("addr", ":8080", "Listen address for HTTP server")
	openFlag := flag.Bool("open", false, "Open browser automatically on startup")
	cacheDirFlag := flag.String("cache", defaultCacheDir, "Thumbnail cache directory")

	s3EndpointFlag := flag.String("s3-endpoint", s3EndpointEnv, "S3 server address (e.g., localhost:9000)")
	s3AccessKeyFlag := flag.String("s3-access-key", s3AccessKeyEnv, "S3 access key")
	s3SecretKeyFlag := flag.String("s3-secret-key", s3SecretKeyEnv, "S3 secret key")
	s3SecureFlag := flag.String("s3-secure", s3SecureEnv, "S3 secure (true for HTTPS, false for HTTP)")
	s3RegionFlag := flag.String("s3-region", s3RegionEnv, "S3 region (optional)")
	s3BucketFlag := flag.String("s3-bucket", s3BucketEnv, "S3 bucket name (optional)")

	flag.Parse()

	if *cacheDirFlag != "" {
		if err := os.MkdirAll(*cacheDirFlag, 0755); err != nil {
			log.Printf("[WARN] Failed to create cache directory %s: %v", *cacheDirFlag, err)
		}
	}

	var st storage.Storage

	// Mutually exclusive: S3 Storage mode vs Local Directory Storage mode
	if *s3EndpointFlag != "" {
		secure := parseBoolEnv(*s3SecureFlag, true)
		s3Store, err := storage.NewS3Storage(storage.S3Config{
			Endpoint:  *s3EndpointFlag,
			AccessKey: *s3AccessKeyFlag,
			SecretKey: *s3SecretKeyFlag,
			Secure:    secure,
			Region:    *s3RegionFlag,
			Bucket:    *s3BucketFlag,
			CacheDir:  *cacheDirFlag,
		})
		if err != nil {
			log.Fatalf("failed to initialize S3 storage: %v", err)
		}
		st = s3Store
		fmt.Printf("qimg initialized in S3 storage mode (endpoint: %s, bucket: %s, secure: %v)\n", *s3EndpointFlag, *s3BucketFlag, secure)
	} else {
		absRoot, err := filepath.Abs(*rootDirFlag)
		if err != nil {
			log.Fatalf("invalid -root directory: %v", err)
		}
		localStore, err := storage.NewLocalStorage(absRoot, *cacheDirFlag)
		if err != nil {
			log.Fatalf("failed to initialize local storage: %v", err)
		}
		st = localStore
		fmt.Printf("qimg initialized in Local storage mode (root: %s)\n", absRoot)
	}

	srv, err := server.New(server.Config{
		Root:     *rootDirFlag,
		CacheDir: *cacheDirFlag,
		Storage:  st,
	})
	if err != nil {
		log.Fatalf("failed to initialize server: %v", err)
	}

	serverURL := formatServerURL(*addrFlag)
	fmt.Printf("qimg serving on %s\n", serverURL)

	if *openFlag {
		go openBrowser(serverURL)
	}

	if err := http.ListenAndServe(*addrFlag, srv); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func formatServerURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		if strings.HasPrefix(addr, ":") {
			return "http://localhost" + addr
		}
		return "http://" + addr
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "localhost"
	}
	return fmt.Sprintf("http://%s:%s", host, port)
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
