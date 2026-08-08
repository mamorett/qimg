// Package frontend embeds the built SPA.
package frontend

import "embed"

//go:embed all:dist
var Dist embed.FS
