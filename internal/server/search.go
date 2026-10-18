package server

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/mamorett/qimg/internal/index"
	"github.com/mamorett/qimg/internal/storage"
)

// SearchParams contains all parsed search and filter criteria.
type SearchParams struct {
	Dir        string
	Recursive  bool
	Q          string
	QTerms     []string          // positive words or quoted phrases
	QExclude   []string          // -negative words
	FieldScope map[string]bool   // "name", "path", "prompt", "meta"
	Name       string
	PathFilter string
	Prompt     string
	Meta       string
	ExtFilter  map[string]bool
	MinSize    int64
	MaxSize    int64
	FromDate   *time.Time
	ToDate     *time.Time
	Aspect     string
	HasPrompt  *bool
	Sort       string
	Order      string
	Page       int
	Size       int
}

// parseSearchParams extracts and normalizes query params from request.
func parseSearchParams(values url.Values) SearchParams {
	dir := values.Get("dir")
	if dir == "" {
		dir = "."
	}

	recursive := values.Get("recursive") == "true"

	rawQ := strings.TrimSpace(values.Get("q"))
	fieldsParam := strings.ToLower(strings.TrimSpace(values.Get("fields")))

	fieldScope := make(map[string]bool)
	if fieldsParam == "all" {
		fieldScope["name"] = true
		fieldScope["path"] = true
		fieldScope["prompt"] = true
		fieldScope["meta"] = true
	} else if fieldsParam != "" {
		for _, f := range strings.Split(fieldsParam, ",") {
			f = strings.ToLower(strings.TrimSpace(f))
			if f != "" {
				fieldScope[f] = true
			}
		}
	}

	// Default scope is name and path if empty
	if len(fieldScope) == 0 {
		fieldScope["name"] = true
		fieldScope["path"] = true
	}

	nameFilter := strings.ToLower(strings.TrimSpace(values.Get("name")))
	pathFilter := strings.ToLower(strings.TrimSpace(values.Get("pathFilter")))
	promptFilter := strings.ToLower(strings.TrimSpace(values.Get("prompt")))
	metaFilter := strings.ToLower(strings.TrimSpace(values.Get("meta")))

	extParam := values.Get("ext")
	var extFilter map[string]bool
	if extParam != "" {
		extFilter = make(map[string]bool)
		for _, e := range strings.Split(extParam, ",") {
			e = strings.ToLower(strings.TrimSpace(e))
			if e != "" {
				if !strings.HasPrefix(e, ".") {
					e = "." + e
				}
				extFilter[e] = true
			}
		}
	}

	var hasPrompt *bool
	if hp := values.Get("hasPrompt"); hp != "" {
		val := hp == "true" || hp == "1"
		hasPrompt = &val
	}

	// Parse inline tokens from rawQ (e.g., prompt:foo, meta:bar, is:recursive, etc.)
	qTerms, qExclude, inlineRecursive, inlineHasPrompt := parseInlineQueryTokens(
		rawQ,
		&nameFilter,
		&pathFilter,
		&promptFilter,
		&metaFilter,
		&extFilter,
	)

	if inlineRecursive {
		recursive = true
	}
	if inlineHasPrompt != nil {
		hasPrompt = inlineHasPrompt
	}

	minSize, _ := strconv.ParseInt(values.Get("minSize"), 10, 64)
	maxSize, _ := strconv.ParseInt(values.Get("maxSize"), 10, 64)

	var fromDate, toDate *time.Time
	if fd := values.Get("fromDate"); fd != "" {
		if t, err := time.Parse("2006-01-02", fd); err == nil {
			fromDate = &t
		} else if t, err := time.Parse(time.RFC3339, fd); err == nil {
			fromDate = &t
		}
	}
	if td := values.Get("toDate"); td != "" {
		if t, err := time.Parse("2006-01-02", td); err == nil {
			// Include full end of day
			tEnd := t.Add(24*time.Hour - time.Nanosecond)
			toDate = &tEnd
		} else if t, err := time.Parse(time.RFC3339, td); err == nil {
			toDate = &t
		}
	}

	aspect := strings.ToLower(strings.TrimSpace(values.Get("aspect")))

	sortParam := values.Get("sort")
	if sortParam == "" {
		sortParam = "name"
	}
	orderParam := values.Get("order")
	if orderParam == "" {
		orderParam = "asc"
	}

	page, _ := strconv.Atoi(values.Get("page"))
	if page < 1 {
		page = 1
	}
	size, _ := strconv.Atoi(values.Get("size"))
	if size < 1 {
		size = 60
	}
	if size > 500 {
		size = 500
	}

	return SearchParams{
		Dir:        dir,
		Recursive:  recursive,
		Q:          rawQ,
		QTerms:     qTerms,
		QExclude:   qExclude,
		FieldScope: fieldScope,
		Name:       nameFilter,
		PathFilter: pathFilter,
		Prompt:     promptFilter,
		Meta:       metaFilter,
		ExtFilter:  extFilter,
		MinSize:    minSize,
		MaxSize:    maxSize,
		FromDate:   fromDate,
		ToDate:     toDate,
		Aspect:     aspect,
		HasPrompt:  hasPrompt,
		Sort:       sortParam,
		Order:      orderParam,
		Page:       page,
		Size:       size,
	}
}

// parseInlineQueryTokens parses inline tokens like prompt:"..." or -exclude.
func parseInlineQueryTokens(
	raw string,
	nameFilter *string,
	pathFilter *string,
	promptFilter *string,
	metaFilter *string,
	extFilter *map[string]bool,
) (terms []string, exclude []string, recursive bool, hasPrompt *bool) {
	if raw == "" {
		return nil, nil, false, nil
	}

	tokens := tokenize(raw)
	for _, tok := range tokens {
		tokLower := strings.ToLower(tok)

		if tokLower == "is:recursive" || tokLower == "in:subfolders" {
			recursive = true
			continue
		}
		if tokLower == "has:prompt" {
			val := true
			hasPrompt = &val
			continue
		}
		if tokLower == "-has:prompt" || tokLower == "has:no-prompt" {
			val := false
			hasPrompt = &val
			continue
		}

		if strings.HasPrefix(tokLower, "prompt:") {
			val := strings.TrimPrefix(tok, tok[:7])
			val = strings.Trim(val, "\"")
			if *promptFilter == "" {
				*promptFilter = strings.ToLower(val)
			} else {
				*promptFilter += " " + strings.ToLower(val)
			}
			continue
		}

		if strings.HasPrefix(tokLower, "meta:") {
			val := strings.TrimPrefix(tok, tok[:5])
			val = strings.Trim(val, "\"")
			if *metaFilter == "" {
				*metaFilter = strings.ToLower(val)
			} else {
				*metaFilter += " " + strings.ToLower(val)
			}
			continue
		}

		if strings.HasPrefix(tokLower, "name:") {
			val := strings.TrimPrefix(tok, tok[:5])
			val = strings.Trim(val, "\"")
			*nameFilter = strings.ToLower(val)
			continue
		}

		if strings.HasPrefix(tokLower, "path:") {
			val := strings.TrimPrefix(tok, tok[:5])
			val = strings.Trim(val, "\"")
			*pathFilter = strings.ToLower(val)
			continue
		}

		if strings.HasPrefix(tokLower, "ext:") || strings.HasPrefix(tokLower, "type:") {
			parts := strings.SplitN(tokLower, ":", 2)
			val := strings.Trim(parts[1], "\".")
			if *extFilter == nil {
				*extFilter = make(map[string]bool)
			}
			(*extFilter)["."+val] = true
			continue
		}

		if strings.HasPrefix(tok, "-") && len(tok) > 1 {
			exclude = append(exclude, strings.ToLower(tok[1:]))
			continue
		}

		terms = append(terms, strings.ToLower(strings.Trim(tok, "\"")))
	}

	return terms, exclude, recursive, hasPrompt
}

func tokenize(s string) []string {
	var tokens []string
	var current strings.Builder
	inQuotes := false

	for i := 0; i < len(s); i++ {
		c := s[i]
		if c == '"' {
			inQuotes = !inQuotes
			current.WriteByte(c)
		} else if (c == ' ' || c == '\t') && !inQuotes {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
		} else {
			current.WriteByte(c)
		}
	}
	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}
	return tokens
}

// filterImages executes the two-phase search and filtering pipeline.
func filterImages(
	ctx context.Context,
	items []storage.ImageItem,
	params SearchParams,
	idx *index.Index,
	getLocal func(path string) (string, func(), error),
) []storage.ImageItem {
	// Phase 1: Fast in-memory pre-filtering (No file I/O)
	var candidates []storage.ImageItem

	for _, item := range items {
		// Extension filter
		if len(params.ExtFilter) > 0 && !params.ExtFilter[strings.ToLower(item.Ext)] {
			continue
		}

		// Size filters
		if params.MinSize > 0 && item.Size < params.MinSize {
			continue
		}
		if params.MaxSize > 0 && item.Size > params.MaxSize {
			continue
		}

		// Date filters
		if params.FromDate != nil && item.ModTime.Before(*params.FromDate) {
			continue
		}
		if params.ToDate != nil && item.ModTime.After(*params.ToDate) {
			continue
		}

		// Explicit Name filter
		nameLower := strings.ToLower(item.Name)
		if params.Name != "" && !strings.Contains(nameLower, params.Name) {
			continue
		}

		// Explicit Path filter
		pathLower := strings.ToLower(item.Path)
		if params.PathFilter != "" && !strings.Contains(pathLower, params.PathFilter) {
			continue
		}

		candidates = append(candidates, item)
	}

	needsDeep := params.Prompt != "" ||
		params.Meta != "" ||
		params.HasPrompt != nil ||
		params.Aspect != "" ||
		(len(params.QTerms) > 0 && (params.FieldScope["prompt"] || params.FieldScope["meta"]))

	if !needsDeep {
		// If no deep search criteria, evaluate terms on name & path directly in Phase 1
		if len(params.QTerms) == 0 && len(params.QExclude) == 0 {
			return candidates
		}

		var matched []storage.ImageItem
		for _, item := range candidates {
			nameLower := strings.ToLower(item.Name)
			pathLower := strings.ToLower(item.Path)

			var matchedFields []string
			if matchesTerms(nameLower, params.QTerms, params.QExclude) && params.FieldScope["name"] {
				matchedFields = append(matchedFields, "name")
			}
			if matchesTerms(pathLower, params.QTerms, params.QExclude) && params.FieldScope["path"] {
				matchedFields = append(matchedFields, "path")
			}

			if len(matchedFields) > 0 {
				item.MatchedFields = matchedFields
				matched = append(matched, item)
			}
		}
		return matched
	}

	// Phase 2: Deep inspection pass using Index cache & parallel extraction
	var entries map[string]*index.Entry
	if idx != nil {
		entries = idx.EnsureIndexed(ctx, candidates, getLocal)
	}

	var matched []storage.ImageItem
	for _, item := range candidates {
		var entry *index.Entry
		if entries != nil {
			entry = entries[item.Path]
		}

		// Check hasPrompt filter
		promptCount := 0
		if entry != nil {
			promptCount = len(entry.Prompts)
		}
		if params.HasPrompt != nil {
			if *params.HasPrompt && promptCount == 0 {
				continue
			}
			if !*params.HasPrompt && promptCount > 0 {
				continue
			}
		}

		// Check explicit aspect ratio filter
		if params.Aspect != "" {
			if entry == nil || !matchesAspect(entry, params.Aspect) {
				continue
			}
		}

		// Check explicit Prompt filter
		if params.Prompt != "" {
			if entry == nil || !containsAllTerms(entry.PromptsLower, []string{params.Prompt}, nil) {
				continue
			}
		}

		// Check explicit Meta chunk filter
		if params.Meta != "" {
			if entry == nil || !containsAllTerms(entry.ChunksLower, []string{params.Meta}, nil) {
				continue
			}
		}

		// Check Q across selected FieldScope
		nameLower := strings.ToLower(item.Name)
		pathLower := strings.ToLower(item.Path)
		promptsLower := ""
		chunksLower := ""
		if entry != nil {
			promptsLower = entry.PromptsLower
			chunksLower = entry.ChunksLower
		}

		var matchedFields []string
		if len(params.QTerms) > 0 || len(params.QExclude) > 0 {
			if params.FieldScope["name"] && matchesTerms(nameLower, params.QTerms, params.QExclude) {
				matchedFields = append(matchedFields, "name")
			}
			if params.FieldScope["path"] && matchesTerms(pathLower, params.QTerms, params.QExclude) {
				matchedFields = append(matchedFields, "path")
			}
			if params.FieldScope["prompt"] && matchesTerms(promptsLower, params.QTerms, params.QExclude) {
				matchedFields = append(matchedFields, "prompt")
			}
			if params.FieldScope["meta"] && matchesTerms(chunksLower, params.QTerms, params.QExclude) {
				matchedFields = append(matchedFields, "meta")
			}

			if len(matchedFields) == 0 {
				continue
			}
		} else {
			// Annotate matching fields from explicit filters
			if params.Name != "" {
				matchedFields = append(matchedFields, "name")
			}
			if params.PathFilter != "" {
				matchedFields = append(matchedFields, "path")
			}
			if params.Prompt != "" {
				matchedFields = append(matchedFields, "prompt")
			}
			if params.Meta != "" {
				matchedFields = append(matchedFields, "meta")
			}
		}

		item.MatchedFields = matchedFields

		// Add prompt snippet if prompt matched or was filtered
		if entry != nil && len(entry.Prompts) > 0 {
			queryForSnippet := params.Prompt
			if queryForSnippet == "" && len(params.QTerms) > 0 && params.FieldScope["prompt"] {
				queryForSnippet = params.QTerms[0]
			}
			item.PromptSnippet = buildPromptSnippet(entry.Prompts, queryForSnippet)
		}

		matched = append(matched, item)
	}

	return matched
}

func matchesTerms(text string, terms []string, exclude []string) bool {
	if text == "" && len(terms) > 0 {
		return false
	}
	for _, ex := range exclude {
		if strings.Contains(text, ex) {
			return false
		}
	}
	return containsAllTerms(text, terms, nil)
}

func containsAllTerms(text string, terms []string, exclude []string) bool {
	for _, ex := range exclude {
		if strings.Contains(text, ex) {
			return false
		}
	}
	for _, term := range terms {
		if !strings.Contains(text, term) {
			return false
		}
	}
	return true
}

func matchesAspect(entry *index.Entry, aspect string) bool {
	if entry.Width <= 0 || entry.Height <= 0 {
		return false
	}
	w, h := entry.Width, entry.Height
	switch aspect {
	case "square":
		return w == h
	case "portrait":
		return h > w
	case "landscape":
		return w > h
	default:
		// Check explicit ratio like "16:9", "4:3", etc.
		if entry.AspectRatio == aspect {
			return true
		}
		// Also support approximate ratio check if aspect is "16:9"
		parts := strings.Split(aspect, ":")
		if len(parts) == 2 {
			wTarget, err1 := strconv.ParseFloat(parts[0], 64)
			hTarget, err2 := strconv.ParseFloat(parts[1], 64)
			if err1 == nil && err2 == nil && hTarget > 0 {
				targetRatio := wTarget / hTarget
				actualRatio := float64(w) / float64(h)
				diff := targetRatio - actualRatio
				if diff < 0 {
					diff = -diff
				}
				return diff < 0.05
			}
		}
		return false
	}
}

func buildPromptSnippet(prompts []string, term string) string {
	if len(prompts) == 0 {
		return ""
	}

	targetPrompt := prompts[0]
	if term != "" {
		termLower := strings.ToLower(term)
		for _, p := range prompts {
			if strings.Contains(strings.ToLower(p), termLower) {
				targetPrompt = p
				break
			}
		}
	}

	clean := strings.ReplaceAll(targetPrompt, "\n", " ")
	clean = strings.TrimSpace(clean)

	if term == "" {
		if len(clean) > 120 {
			return clean[:117] + "..."
		}
		return clean
	}

	idx := strings.Index(strings.ToLower(clean), strings.ToLower(term))
	if idx == -1 {
		if len(clean) > 120 {
			return clean[:117] + "..."
		}
		return clean
	}

	start := idx - 40
	prefix := "..."
	if start <= 0 {
		start = 0
		prefix = ""
	}

	end := start + 120
	suffix := "..."
	if end >= len(clean) {
		end = len(clean)
		suffix = ""
	}

	return prefix + strings.TrimSpace(clean[start:end]) + suffix
}
