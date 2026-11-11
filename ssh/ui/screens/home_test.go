package screens

import (
	"reflect"
	"testing"

	"terminull-ssh/content"
)

func TestMainMenuMatchesWebsite(t *testing.T) {
	// Same order and wording as mainMenu() in src/lib/home.js.
	store := &content.Store{
		Volumes: []content.Volume{{Number: 1, Articles: make([]content.Article, 3)}, {Number: 2, Articles: make([]content.Article, 12)}},
		Pages:   []content.Page{{Slug: "manifesto"}, {Slug: "about"}},
	}
	items := mainMenu(store)
	var labels []string
	for _, it := range items {
		labels = append(labels, it.label+" - "+it.description)
	}
	want := []string{
		"Latest Volume - Volume 02, 12 articles",
		"Archive - All volumes",
		"About - What is terminull?",
		"Manifesto - What we believe",
		"Help - Commands & navigation",
	}
	if !reflect.DeepEqual(labels, want) {
		t.Errorf("menu = %q\nwant  %q", labels, want)
	}
	if items[0].action != "volume" || items[0].volume != 2 || items[1].action != "archive" {
		t.Errorf("Latest Volume should open volume 2 and Archive the archive: %+v", items[:2])
	}
}

func TestMainMenuWithoutVolumes(t *testing.T) {
	items := mainMenu(&content.Store{})
	if items[0].label != "Archive" {
		t.Errorf("with nothing published the menu should start at Archive, got %q", items[0].label)
	}
}

func TestArticleByOrderKey(t *testing.T) {
	arts := []content.Article{{Order: 0}, {Order: 1}, {Order: 3}}
	for key, want := range map[string]int{"0": 0, "1": 1, "3": 2} {
		if got, ok := articleByOrderKey(arts, key); !ok || got != want {
			t.Errorf("key %q: got %d, %v; want %d", key, got, ok, want)
		}
	}
	if _, ok := articleByOrderKey(arts, "2"); ok {
		t.Error("key 2 has no article with order 2")
	}
}
