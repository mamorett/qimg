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
)

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

	rootDirFlag := flag.String("root", cwd, "Root directory to browse for images")
	addrFlag := flag.String("addr", ":8080", "Listen address for HTTP server")
	openFlag := flag.Bool("open", false, "Open browser automatically on startup")
	cacheDirFlag := flag.String("cache", defaultCacheDir, "Thumbnail cache directory")

	flag.Parse()

	absRoot, err := filepath.Abs(*rootDirFlag)
	if err != nil {
		log.Fatalf("invalid -root directory: %v", err)
	}

	st, err := os.Stat(absRoot)
	if err != nil || !st.IsDir() {
		log.Fatalf("-root path does not exist or is not a directory: %s", absRoot)
	}

	if *cacheDirFlag != "" {
		if err := os.MkdirAll(*cacheDirFlag, 0755); err != nil {
			log.Printf("[WARN] Failed to create cache directory %s: %v", *cacheDirFlag, err)
		}
	}

	srv, err := server.New(server.Config{
		Root:     absRoot,
		CacheDir: *cacheDirFlag,
	})
	if err != nil {
		log.Fatalf("failed to initialize server: %v", err)
	}

	serverURL := formatServerURL(*addrFlag)
	fmt.Printf("qimg serving %s on %s\n", absRoot, serverURL)

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
