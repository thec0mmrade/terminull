package content

import "strings"

// SearchResult pairs a matched article with its volume.
type SearchResult struct {
	Article Article
	Volume  int
}

// Search performs case-insensitive substring matching across article fields.
// Matches the SearchOverlay.astro client-side algorithm.
func Search(store *Store, query string) []SearchResult {
	if query == "" {
		return nil
	}

	q := strings.ToLower(query)
	var results []SearchResult

	for _, a := range store.Articles {
		if matchArticle(a, q) {
			results = append(results, SearchResult{Article: a, Volume: a.Volume})
		}
	}

	return results
}

func matchArticle(a Article, query string) bool {
	if strings.Contains(strings.ToLower(a.Title), query) {
		return true
	}
	if strings.Contains(strings.ToLower(a.Description), query) {
		return true
	}
	if strings.Contains(strings.ToLower(a.Author), query) {
		return true
	}
	if strings.Contains(strings.ToLower(a.Handle), query) {
		return true
	}
	if strings.Contains(strings.ToLower(a.Category), query) {
		return true
	}
	for _, tag := range a.Tags {
		if strings.Contains(strings.ToLower(tag), query) {
			return true
		}
	}
	return false
}
