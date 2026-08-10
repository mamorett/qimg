package server

import "github.com/mamorett/qimg/internal/storage"

type ImageListResponse struct {
	Dir   string              `json:"dir"`
	Items []storage.ImageItem `json:"items"`
	Total int                 `json:"total"`
	Page  int                 `json:"page"`
	Size  int                 `json:"size"`
}

type ImageItem = storage.ImageItem
type DirItem = storage.DirItem

type DirsResponse struct {
	Dirs []storage.DirItem `json:"dirs"`
}

type MetadataResponse struct {
	File storage.FileDetails `json:"file"`
	PNG  *PNGMetadata        `json:"png"`
}

type FileDetails = storage.FileDetails

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

type DeleteResponse struct {
	Success bool   `json:"success"`
	Path    string `json:"path"`
}

type BucketsResponse struct {
	Buckets []string `json:"buckets"`
	Active  string   `json:"active,omitempty"`
}

type ModeResponse struct {
	Mode           string `json:"mode"`
	ConfiguredBucket string `json:"configuredBucket,omitempty"`
}

type VersionResponse struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
