package content

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// articleFrontmatter matches the Astro content schema for issues.
type articleFrontmatter struct {
	Title       string   `yaml:"title"`
	Author      string   `yaml:"author"`
	Handle      string   `yaml:"handle"`
	Date        string   `yaml:"date"`
	Volume      int      `yaml:"volume"`
	Order       int      `yaml:"order"`
	Category    string   `yaml:"category"`
	Tags        []string `yaml:"tags"`
	Description string   `yaml:"description"`
	Draft       bool     `yaml:"draft"`
}

// pageFrontmatter matches the Astro content schema for pages.
type pageFrontmatter struct {
	Title       string `yaml:"title"`
	Description string `yaml:"description"`
}

// maxFileSize is the maximum markdown file size we'll read (1 MB).
const maxFileSize = 1 << 20

// volDirRegex matches "vol1", "vol2", etc.
var volDirRegex = regexp.MustCompile(`^vol(\d+)$`)

// isInsideDir checks that child is a descendant of parent after resolving symlinks.
func isInsideDir(child, parent string) bool {
	resolvedChild, err := filepath.EvalSymlinks(child)
	if err != nil {
		return false
	}
	resolvedParent, err := filepath.EvalSymlinks(parent)
	if err != nil {
		return false
	}
	// Ensure trailing separator for prefix check
	resolvedParent = filepath.Clean(resolvedParent) + string(filepath.Separator)
	resolvedChild = filepath.Clean(resolvedChild)
	return strings.HasPrefix(resolvedChild, resolvedParent) || resolvedChild == strings.TrimSuffix(resolvedParent, string(filepath.Separator))
}

// safeReadFile reads a file if it's within baseDir and under maxFileSize.
func safeReadFile(path, baseDir string) ([]byte, error) {
	if !isInsideDir(path, baseDir) {
		return nil, fmt.Errorf("path %s resolves outside content directory", path)
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > maxFileSize {
		return nil, fmt.Errorf("file %s exceeds max size (%d > %d)", path, info.Size(), maxFileSize)
	}
	return os.ReadFile(path)
}

// LoadStore scans contentDir for issues and pages, returns a populated Store.
func LoadStore(contentDir string) *Store {
	store := &Store{}

	// Resolve the content directory to an absolute path for symlink checks
	absContentDir, err := filepath.Abs(contentDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "warn: cannot resolve content dir %s: %v\n", contentDir, err)
		return store
	}

	// Load issues
	issuesDir := filepath.Join(absContentDir, "issues")
	volumeMap := make(map[int][]Article)

	entries, err := os.ReadDir(issuesDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "warn: cannot read issues dir %s: %v\n", issuesDir, err)
	} else {
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			match := volDirRegex.FindStringSubmatch(entry.Name())
			if match == nil {
				continue // skip _templates, etc.
			}
			volNum, _ := strconv.Atoi(match[1])
			volDir := filepath.Join(issuesDir, entry.Name())
			articles := loadArticlesFromDir(volDir, volNum, absContentDir)
			for _, a := range articles {
				if !a.Draft {
					volumeMap[volNum] = append(volumeMap[volNum], a)
					store.Articles = append(store.Articles, a)
				}
			}
		}
	}

	// Build sorted volumes
	var volNums []int
	for n := range volumeMap {
		volNums = append(volNums, n)
	}
	sort.Ints(volNums)
	for _, n := range volNums {
		arts := volumeMap[n]
		sort.Slice(arts, func(i, j int) bool { return arts[i].Order < arts[j].Order })
		store.Volumes = append(store.Volumes, Volume{Number: n, Articles: arts})
	}

	// Sort flat article list
	sort.Slice(store.Articles, func(i, j int) bool {
		if store.Articles[i].Volume != store.Articles[j].Volume {
			return store.Articles[i].Volume < store.Articles[j].Volume
		}
		return store.Articles[i].Order < store.Articles[j].Order
	})

	// Load pages
	pagesDir := filepath.Join(absContentDir, "pages")
	store.Pages = loadPages(pagesDir, absContentDir)

	fmt.Fprintf(os.Stderr, "content: loaded %d volumes, %d articles, %d pages\n",
		len(store.Volumes), len(store.Articles), len(store.Pages))

	return store
}

func loadArticlesFromDir(dir string, defaultVolume int, baseDir string) []Article {
	var articles []Article

	entries, err := os.ReadDir(dir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "warn: cannot read dir %s: %v\n", dir, err)
		return nil
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".md") && !strings.HasSuffix(name, ".mdx") {
			continue
		}

		filePath := filepath.Join(dir, name)
		data, err := safeReadFile(filePath, baseDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warn: skipping %s: %v\n", name, err)
			continue
		}

		fm, body, err := splitFrontmatter(string(data))
		if err != nil {
			fmt.Fprintf(os.Stderr, "warn: bad frontmatter in %s: %v\n", name, err)
			continue
		}

		var meta articleFrontmatter
		if err := yaml.Unmarshal([]byte(fm), &meta); err != nil {
			fmt.Fprintf(os.Stderr, "warn: cannot parse frontmatter in %s: %v\n", name, err)
			continue
		}

		// Extract slug from filename (strip extension)
		slug := strings.TrimSuffix(name, filepath.Ext(name))

		// Parse date
		date, _ := time.Parse("2006-01-02", meta.Date)

		vol := meta.Volume
		if vol == 0 {
			vol = defaultVolume
		}

		articles = append(articles, Article{
			Title:       meta.Title,
			Author:      meta.Author,
			Handle:      meta.Handle,
			Description: meta.Description,
			Date:        date,
			Volume:      vol,
			Order:       meta.Order,
			Category:    meta.Category,
			Tags:        meta.Tags,
			Draft:       meta.Draft,
			Slug:        slug,
			Body:        body,
		})
	}

	return articles
}

func loadPages(dir string, baseDir string) []Page {
	var pages []Page

	entries, err := os.ReadDir(dir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "warn: cannot read pages dir %s: %v\n", dir, err)
		return nil
	}

	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || (!strings.HasSuffix(name, ".md") && !strings.HasSuffix(name, ".mdx")) {
			continue
		}

		filePath := filepath.Join(dir, name)
		data, err := safeReadFile(filePath, baseDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warn: skipping page %s: %v\n", name, err)
			continue
		}

		fm, body, err := splitFrontmatter(string(data))
		if err != nil {
			continue
		}

		var meta pageFrontmatter
		if err := yaml.Unmarshal([]byte(fm), &meta); err != nil {
			continue
		}

		slug := strings.TrimSuffix(name, filepath.Ext(name))

		pages = append(pages, Page{
			Title:       meta.Title,
			Description: meta.Description,
			Slug:        slug,
			Body:        body,
		})
	}

	return pages
}

// splitFrontmatter splits a markdown file at the --- fences.
func splitFrontmatter(content string) (frontmatter, body string, err error) {
	const fence = "---"

	// Must start with ---
	trimmed := strings.TrimSpace(content)
	if !strings.HasPrefix(trimmed, fence) {
		return "", "", fmt.Errorf("no opening frontmatter fence")
	}

	// Find closing fence
	rest := trimmed[len(fence):]
	idx := strings.Index(rest, "\n"+fence)
	if idx < 0 {
		return "", "", fmt.Errorf("no closing frontmatter fence")
	}

	frontmatter = strings.TrimSpace(rest[:idx])

	// Body starts after closing fence line
	afterFence := rest[idx+len("\n"+fence):]
	// Skip to next newline (in case of trailing chars on fence line)
	if nlIdx := strings.Index(afterFence, "\n"); nlIdx >= 0 {
		body = afterFence[nlIdx+1:]
	} else {
		body = ""
	}

	return frontmatter, body, nil
}
