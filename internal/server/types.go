package server

import "time"

type ImageListResponse struct {
	Dir   string      `json:"dir"`
	Items []ImageItem `json:"items"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Size  int         `json:"size"`
}

type ImageItem struct {
	Path    string    `json:"path"`
	Name    string    `json:"name"`
	Ext     string    `json:"ext"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
	IsPng   bool      `json:"isPng"`
}

type DirsResponse struct {
	Dirs []DirItem `json:"dirs"`
}

type DirItem struct {
	Path       string `json:"path"`
	Name       string `json:"name"`
	ImageCount int    `json:"imageCount"`
}

type MetadataResponse struct {
	File FileDetails  `json:"file"`
	PNG  *PNGMetadata `json:"png"`
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

type PNGMetadata struct {
	Chunks           map[string]string `json:"chunks"`
	ExtractionMethod string            `json:"extractionMethod"`
	Prompts          []PromptDTO       `json:"prompts"`
	ExtractionError  string            `json:"extractionError,omitempty"`
}

type PromptDTO struct {
	Text     string `json:"text"`
	NodeID   string `json:"nodeId"`
	NodeType string `json:"nodeType"`
	Title    string `json:"title"`
	Source   string `json:"source"`
}

type VersionResponse struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
