package content

import "time"

// Article represents an issue article parsed from markdown frontmatter.
type Article struct {
	Title       string
	Author      string
	Handle      string
	Description string
	Date        time.Time
	Volume      int
	Order       int
	Category    string
	Tags        []string
	Draft       bool
	Slug        string // from filename: "01-smashing-the-stack"
	Body        string // raw markdown after frontmatter
}

// Page represents a static page (about, manifesto).
type Page struct {
	Title       string
	Description string
	Slug        string
	Body        string
}

// Volume groups articles by volume number.
type Volume struct {
	Number   int
	Articles []Article // sorted by Order
}

// Store holds all loaded content, shared read-only across SSH sessions.
type Store struct {
	Volumes  []Volume  // sorted by Number
	Pages    []Page
	Articles []Article // flat list of all non-draft articles
}
