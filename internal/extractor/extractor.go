package extractor

import (
	"encoding/json"
	"fmt"
	"image"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/mamorett/qimg/internal/png"
)

// FileInfo describes the source file.
type FileInfo struct {
	Filename string
	Width    int
	Height   int
	Mode     string // "PNG", "JSON", "TEXT"
}

// PromptInfo holds one extracted positive prompt.
type PromptInfo struct {
	Text     string
	NodeID   string
	NodeType string
	Title    string
	Source   string
}

// ExtractionResult is the result for one file.
type ExtractionResult struct {
	FileInfo         FileInfo
	PositivePrompts  []PromptInfo
	ExtractionMethod string
	Error            string
}

// ExtractionOptions allows passing pre-calculated dimensions.
type ExtractionOptions struct {
	Width  int
	Height int
}

type PromptExtractor struct{}

func (e *PromptExtractor) ExtractComfyUI(filePath string, opts ...*ExtractionOptions) (*ExtractionResult, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var w, h int
	if len(opts) > 0 && opts[0] != nil && opts[0].Width > 0 {
		w = opts[0].Width
		h = opts[0].Height
	} else {
		config, _, err := image.DecodeConfig(f)
		if err != nil {
			return nil, err
		}
		w = config.Width
		h = config.Height
		if _, err := f.Seek(0, 0); err != nil {
			return nil, err
		}
	}

	meta, err := png.ReadTextChunksFromReader(f)
	if err != nil {
		return nil, err
	}

	result := &ExtractionResult{
		FileInfo: FileInfo{
			Filename: filepath.Base(filePath),
			Width:    w,
			Height:   h,
			Mode:     "PNG",
		},
		ExtractionMethod: "comfyui",
	}

	processedNodes := make(map[any]bool)

	// 1. Try A1111/Krea parameters chunk first (salvatore_image.py approach)
	if promptText, ok := e.extractPositiveFromParametersStrict(meta); ok {
		result.PositivePrompts = append(result.PositivePrompts, PromptInfo{
			Text:     promptText,
			NodeID:   "parameters",
			NodeType: "parameters",
			Title:    "Parameters",
			Source:   "parameters",
		})
		result.ExtractionMethod = "parameters"
		return result, nil
	}

	// 2. Try visual workflow chunk
	if workflowJSON, ok := meta["workflow"]; ok {
		var workflowData map[string]any
		if err := json.Unmarshal([]byte(workflowJSON), &workflowData); err == nil {
			prompts := e.extractPositiveFromWorkflow(workflowData, processedNodes)
			result.PositivePrompts = append(result.PositivePrompts, prompts...)
		}
	}

	// 3. Try prompt API graph chunk if no prompts found yet
	if len(result.PositivePrompts) == 0 {
		if promptJSON, ok := meta["prompt"]; ok {
			var promptData map[string]any
			if err := json.Unmarshal([]byte(promptJSON), &promptData); err == nil {
				prompts := e.extractPositiveFromPromptData(promptData, processedNodes)
				result.PositivePrompts = append(result.PositivePrompts, prompts...)
			}
		}
	}

	// 4. Fallback to PNG properties
	if len(result.PositivePrompts) == 0 {
		if promptText, ok := e.extractPositiveFromPNGProperties(meta); ok {
			result.PositivePrompts = append(result.PositivePrompts, PromptInfo{
				Text:     promptText,
				NodeID:   "png_properties",
				NodeType: "png_properties",
				Title:    "PNG Properties",
				Source:   "png_properties",
			})
			result.ExtractionMethod = "png_properties"
		}
	}

	return result, nil
}

func (e *PromptExtractor) ExtractParameters(filePath string, opts ...*ExtractionOptions) (*ExtractionResult, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var w, h int
	if len(opts) > 0 && opts[0] != nil && opts[0].Width > 0 {
		w = opts[0].Width
		h = opts[0].Height
	} else {
		config, _, err := image.DecodeConfig(f)
		if err != nil {
			return nil, err
		}
		w = config.Width
		h = config.Height
		if _, err := f.Seek(0, 0); err != nil {
			return nil, err
		}
	}

	meta, err := png.ReadTextChunksFromReader(f)
	if err != nil {
		return nil, err
	}

	result := &ExtractionResult{
		FileInfo: FileInfo{
			Filename: filepath.Base(filePath),
			Width:    w,
			Height:   h,
			Mode:     "PNG",
		},
		ExtractionMethod: "parameters",
	}

	if promptText, ok := e.extractPositiveFromParametersStrict(meta); ok {
		result.PositivePrompts = append(result.PositivePrompts, PromptInfo{
			Text:     promptText,
			NodeID:   "parameters",
			NodeType: "parameters",
			Title:    "Parameters",
			Source:   "parameters",
		})
	} else if promptText, ok := e.extractPositiveFromPNGProperties(meta); ok {
		result.PositivePrompts = append(result.PositivePrompts, PromptInfo{
			Text:     promptText,
			NodeID:   "png_properties",
			NodeType: "png_properties",
			Title:    "PNG Properties",
			Source:   "png_properties",
		})
	} else {
		processedNodes := make(map[any]bool)
		if workflowJSON, ok := meta["workflow"]; ok {
			var workflowData map[string]any
			if err := json.Unmarshal([]byte(workflowJSON), &workflowData); err == nil {
				prompts := e.extractPositiveFromWorkflow(workflowData, processedNodes)
				result.PositivePrompts = append(result.PositivePrompts, prompts...)
			}
		}
		if len(result.PositivePrompts) == 0 {
			if promptJSON, ok := meta["prompt"]; ok {
				var promptData map[string]any
				if err := json.Unmarshal([]byte(promptJSON), &promptData); err == nil {
					prompts := e.extractPositiveFromPromptData(promptData, processedNodes)
					result.PositivePrompts = append(result.PositivePrompts, prompts...)
				}
			}
		}
	}

	return result, nil
}

func (e *PromptExtractor) ExtractJSON(filePath string) (*ExtractionResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, err
	}

	result := &ExtractionResult{
		FileInfo: FileInfo{
			Filename: filepath.Base(filePath),
			Mode:     "JSON",
		},
		ExtractionMethod: "json",
	}

	processedNodes := make(map[any]bool)

	if _, ok := jsonData["nodes"]; ok {
		prompts := e.extractPositiveFromWorkflow(jsonData, processedNodes)
		result.PositivePrompts = append(result.PositivePrompts, prompts...)
	}

	if len(result.PositivePrompts) == 0 {
		isAPIFormat := false
		for _, v := range jsonData {
			if node, ok := v.(map[string]any); ok {
				_, hasClass := node["class_type"]
				_, hasInputs := node["inputs"]
				if hasClass || hasInputs {
					isAPIFormat = true
					break
				}
			}
		}

		if isAPIFormat {
			prompts := e.extractPositiveFromPromptData(jsonData, processedNodes)
			result.PositivePrompts = append(result.PositivePrompts, prompts...)
		}
	}

	return result, nil
}

func (e *PromptExtractor) ExtractText(filePath string) (*ExtractionResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return &ExtractionResult{
			FileInfo: FileInfo{Filename: filepath.Base(filePath)},
			Error:    err.Error(),
		}, nil
	}

	textContent := string(data)
	result := &ExtractionResult{
		FileInfo: FileInfo{
			Filename: filepath.Base(filePath),
			Width:    len(textContent),
			Mode:     "TEXT",
		},
		ExtractionMethod: "text_parameters",
	}

	fakeMeta := map[string]string{"parameters": textContent}
	if promptText, ok := e.extractPositiveFromParametersStrict(fakeMeta); ok {
		result.PositivePrompts = append(result.PositivePrompts, PromptInfo{
			Text:     promptText,
			NodeID:   "parameters",
			NodeType: "parameters",
			Title:    "Parameters",
			Source:   "text_parameters",
		})
	}

	return result, nil
}

func (e *PromptExtractor) extractPositiveFromWorkflow(workflowData map[string]any, processed map[any]bool) []PromptInfo {
	var positivePrompts []PromptInfo
	nodesRaw, ok := workflowData["nodes"]
	if !ok {
		return nil
	}
	nodes, ok := nodesRaw.([]any)
	if !ok {
		return nil
	}

	for _, n := range nodes {
		node, ok := n.(map[string]any)
		if !ok {
			continue
		}

		nodeID := node["id"]
		nodeType, _ := node["type"].(string)
		title, _ := node["title"].(string)
		titleLower := strings.ToLower(title)

		if processed[nodeID] {
			continue
		}

		isCLIP := nodeType == "CLIPTextEncode" || strings.Contains(strings.ToLower(nodeType), "cliptext")
		if !isCLIP {
			if props, ok := node["properties"].(map[string]any); ok {
				if name, ok := props["Node name for S&R"].(string); ok && name == "CLIPTextEncode" {
					isCLIP = true
				}
			}
		}

		if isCLIP {
			widgetsValuesRaw, ok := node["widgets_values"]
			if !ok {
				continue
			}
			widgetsValues, ok := widgetsValuesRaw.([]any)
			if !ok || len(widgetsValues) == 0 {
				continue
			}

			promptTextRaw := widgetsValues[0]
			promptText := ""
			switch v := promptTextRaw.(type) {
			case string:
				promptText = v
			case []any:
				var sb strings.Builder
				for i, item := range v {
					if i > 0 {
						sb.WriteString("\n")
					}
					sb.WriteString(fmt.Sprintf("%v", item))
				}
				promptText = sb.String()
			case float64, int:
				promptText = fmt.Sprintf("%v", v)
			default:
				continue
			}

			promptTextLower := strings.ToLower(promptText)
			promptTextTrimmed := strings.TrimSpace(promptTextLower)

			isPositive := strings.Contains(titleLower, "positive") ||
				strings.Contains(titleLower, "pos") ||
				((title == "" || titleLower == "untitled") && promptTextTrimmed != "" &&
					!strings.Contains(promptTextLower[:min(50, len(promptTextLower))], "negative") &&
					!strings.Contains(promptTextLower, "blurry") &&
					!strings.Contains(promptTextLower, "watermark") &&
					!strings.Contains(promptTextLower, "low quality"))

			isNegative := strings.Contains(titleLower, "negative") ||
				strings.Contains(titleLower, "neg") ||
				promptTextTrimmed == "" ||
				strings.HasPrefix(promptTextTrimmed, "negative prompt") ||
				strings.HasPrefix(promptTextTrimmed, "negative:")

			if isPositive && !isNegative {
				nodeTitle := title
				if nodeTitle == "" {
					nodeTitle = "Untitled"
				}
				positivePrompts = append(positivePrompts, PromptInfo{
					Text:     promptText,
					NodeID:   fmt.Sprintf("%v", nodeID),
					NodeType: nodeType,
					Title:    nodeTitle,
					Source:   "workflow",
				})
				processed[nodeID] = true
			}
		}
	}

	return positivePrompts
}

// Helper to resolve node text by following link references in inputs [nodeID, slot]
func (e *PromptExtractor) resolveNodeText(promptData map[string]any, node map[string]any, visited map[string]bool) string {
	inputs, ok := node["inputs"].(map[string]any)
	if !ok {
		return ""
	}

	for _, key := range []string{"text", "prompt", "string", "value", "text_g", "text_l", "val"} {
		valRaw, ok := inputs[key]
		if !ok || valRaw == nil {
			continue
		}

		switch v := valRaw.(type) {
		case string:
			trimmed := strings.TrimSpace(v)
			if trimmed != "" {
				return trimmed
			}
		case []any:
			if len(v) == 2 { // Node link [nodeID, slotIdx]
				linkedID := fmt.Sprintf("%v", v[0])
				if !visited[linkedID] {
					visited[linkedID] = true
					if targetNode, ok := promptData[linkedID].(map[string]any); ok {
						if res := e.resolveNodeText(promptData, targetNode, visited); res != "" {
							return res
						}
					}
				}
			} else {
				var sb strings.Builder
				for i, item := range v {
					if i > 0 {
						sb.WriteString("\n")
					}
					sb.WriteString(fmt.Sprintf("%v", item))
				}
				s := strings.TrimSpace(sb.String())
				if s != "" {
					return s
				}
			}
		}
	}

	if widgetsRaw, ok := node["widgets_values"].([]any); ok && len(widgetsRaw) > 0 {
		for _, w := range widgetsRaw {
			if str, ok := w.(string); ok {
				trimmed := strings.TrimSpace(str)
				if trimmed != "" {
					return trimmed
				}
			}
		}
	}

	return ""
}

func (e *PromptExtractor) extractPositiveFromPromptData(promptData map[string]any, processed map[any]bool) []PromptInfo {
	var positivePrompts []PromptInfo

	posNodeIDs := make(map[string]bool)
	negNodeIDs := make(map[string]bool)

	// Scan KSampler nodes in API graph to find positive & negative inputs explicitly
	for _, v := range promptData {
		node, ok := v.(map[string]any)
		if !ok {
			continue
		}
		classType, _ := node["class_type"].(string)
		if strings.Contains(strings.ToLower(classType), "sampler") {
			inputs, ok := node["inputs"].(map[string]any)
			if !ok {
				continue
			}
			if pos, ok := inputs["positive"].([]any); ok && len(pos) > 0 {
				posNodeIDs[fmt.Sprintf("%v", pos[0])] = true
			}
			if neg, ok := inputs["negative"].([]any); ok && len(neg) > 0 {
				negNodeIDs[fmt.Sprintf("%v", neg[0])] = true
			}
		}
	}

	// 1. Process nodes connected to KSampler positive input pin
	for keyStr := range posNodeIDs {
		if node, ok := promptData[keyStr].(map[string]any); ok {
			if processed[keyStr] {
				continue
			}
			classType, _ := node["class_type"].(string)
			text := e.resolveNodeText(promptData, node, map[string]bool{keyStr: true})
			if text != "" {
				positivePrompts = append(positivePrompts, PromptInfo{
					Text:     text,
					NodeID:   keyStr,
					NodeType: classType,
					Title:    fmt.Sprintf("Node %s", keyStr),
					Source:   "prompt_data",
				})
				processed[keyStr] = true
			}
		}
	}

	// 2. Process remaining CLIPTextEncode nodes (excluding sampler negative nodes)
	if len(positivePrompts) == 0 {
		for key, v := range promptData {
			keyStr := fmt.Sprintf("%v", key)
			if processed[keyStr] || negNodeIDs[keyStr] {
				continue
			}

			node, ok := v.(map[string]any)
			if !ok {
				continue
			}

			classType, _ := node["class_type"].(string)
			if classType == "CLIPTextEncode" || strings.Contains(strings.ToLower(classType), "cliptext") {
				text := e.resolveNodeText(promptData, node, map[string]bool{keyStr: true})
				if text != "" {
					textLower := strings.ToLower(text)
					isNeg := strings.HasPrefix(textLower, "negative prompt") ||
						strings.HasPrefix(textLower, "negative:") ||
						strings.Contains(textLower[:min(50, len(textLower))], "negative prompt:")

					if !isNeg {
						positivePrompts = append(positivePrompts, PromptInfo{
							Text:     text,
							NodeID:   keyStr,
							NodeType: classType,
							Title:    fmt.Sprintf("Node %s", keyStr),
							Source:   "prompt_data",
						})
						processed[keyStr] = true
					}
				}
			}
		}
	}

	return positivePrompts
}

func (e *PromptExtractor) extractPositiveFromPNGProperties(meta map[string]string) (string, bool) {
	possibleKeys := []string{
		"Positive prompt",
		"positive prompt",
		"Positive Prompt",
		"positive_prompt",
		"prompt",
		"Prompt",
		"Description",
		"description",
		"Comment",
		"comment",
		"user_comment",
		"UserComment",
	}

	for _, key := range possibleKeys {
		for k, val := range meta {
			if strings.EqualFold(k, key) {
				val = strings.TrimSpace(val)
				val = strings.Trim(val, "\x00\r")
				if val != "" {
					if (strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) ||
						(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
						val = val[1 : len(val)-1]
					}
					return val, true
				}
			}
		}
	}
	return "", false
}

func isDelimiterLine(line string) bool {
	l := strings.ToLower(strings.TrimSpace(line))
	if l == "" {
		return false
	}
	if strings.HasPrefix(l, "negative prompt") || strings.HasPrefix(l, "negative:") || strings.HasPrefix(l, "steps:") {
		return true
	}
	if strings.HasPrefix(l, "ti hashes:") || strings.HasPrefix(l, "lora hashes:") || strings.HasPrefix(l, "hashes:") || strings.HasPrefix(l, "version:") || strings.HasPrefix(l, "template:") {
		return true
	}
	if strings.Contains(l, "steps:") && (strings.Contains(l, "sampler:") || strings.Contains(l, "cfg scale:") || strings.Contains(l, "seed:")) {
		return true
	}
	return false
}

func (e *PromptExtractor) extractPositiveFromParametersStrict(meta map[string]string) (string, bool) {
	var params string
	var found bool
	for k, v := range meta {
		if strings.EqualFold(k, "parameters") {
			params = v
			found = true
			break
		}
	}
	if !found {
		for k, v := range meta {
			if strings.EqualFold(k, "prompt") || strings.EqualFold(k, "description") || strings.EqualFold(k, "comment") {
				params = v
				found = true
				break
			}
		}
	}
	if !found || strings.TrimSpace(params) == "" {
		return "", false
	}

	params = strings.Trim(params, "\x00\r")

	// Try JSON first
	var parsed map[string]any
	if err := json.Unmarshal([]byte(params), &parsed); err == nil {
		// If JSON is a ComfyUI prompt API graph (containing node objects with class_type/inputs), skip parameters extraction
		for _, v := range parsed {
			if node, ok := v.(map[string]any); ok {
				_, hasClass := node["class_type"]
				_, hasInputs := node["inputs"]
				if hasClass || hasInputs {
					return "", false
				}
			}
		}

		possibleKeys := []string{
			"Positive prompt",
			"positive prompt",
			"Positive Prompt",
			"positive_prompt",
			"positive",
			"Positive",
			"prompt",
			"Prompt",
			"text",
			"Text",
		}
		for _, key := range possibleKeys {
			if v, ok := parsed[key]; ok {
				if list, ok := v.([]any); ok {
					var sb strings.Builder
					for i, item := range list {
						if i > 0 {
							sb.WriteString("\n")
						}
						sb.WriteString(fmt.Sprintf("%v", item))
					}
					return sb.String(), true
				}
				if strVal := fmt.Sprintf("%v", v); strings.TrimSpace(strVal) != "" {
					return strVal, true
				}
			}
		}
	}

	// salvatore_image.py logic: prefix "Positive prompt: " if missing and not JSON
	paramsLower := strings.ToLower(strings.TrimSpace(params))
	if !strings.HasPrefix(paramsLower, "positive prompt:") && !strings.HasPrefix(paramsLower, "{") {
		params = "Positive prompt: " + params
	}

	// Parse text format (Automatic1111)
	lines := strings.Split(params, "\n")

	for i, line := range lines {
		lineTrimmedLower := strings.ToLower(strings.TrimSpace(line))
		if strings.HasPrefix(lineTrimmedLower, "positive prompt:") {
			parts := strings.SplitN(line, ":", 2)
			promptText := ""
			if len(parts) > 1 {
				promptText = strings.TrimSpace(parts[1])
			}

			var promptLines []string
			if promptText != "" {
				promptLines = append(promptLines, promptText)
			}

			j := i + 1
			for j < len(lines) {
				nextLine := lines[j]
				if isDelimiterLine(nextLine) {
					break
				}
				promptLines = append(promptLines, strings.TrimRight(nextLine, "\r\n"))
				j++
			}

			fullPrompt := strings.TrimSpace(strings.Join(promptLines, "\n"))
			if fullPrompt != "" {
				return fullPrompt, true
			}
		}
	}

	// Fallback without header
	var promptLines []string
	for _, line := range lines {
		if isDelimiterLine(line) {
			break
		}
		promptLines = append(promptLines, strings.TrimRight(line, "\r\n"))
	}

	fullPrompt := strings.TrimSpace(strings.Join(promptLines, "\n"))
	if fullPrompt != "" {
		return fullPrompt, true
	}

	return "", false
}
