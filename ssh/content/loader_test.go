package content

import (
	"os"
	"path/filepath"
	"testing"
)

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

const testArticle = `---
title: "X"
author: "a"
date: 2026-01-01
volume: 2
order: 1
category: editorial
description: "d"
---
body
`

const testPage = `---
title: "About"
description: "d"
---
about
`

func TestLoadStoreSeparateVolumesDir(t *testing.T) {
	root := t.TempDir()
	content := filepath.Join(root, "content")
	vols := filepath.Join(root, "vols")
	write(t, filepath.Join(content, "pages", "about.md"), testPage)
	write(t, filepath.Join(vols, "vol2", "01-x.md"), testArticle)

	store := LoadStore(content, vols)
	if len(store.Volumes) != 1 {
		t.Fatalf("volumes = %d, want 1", len(store.Volumes))
	}
	if store.Volumes[0].Number != 2 {
		t.Errorf("volume number = %d, want 2", store.Volumes[0].Number)
	}
	if len(store.Pages) != 1 {
		t.Errorf("pages = %d, want 1", len(store.Pages))
	}
}

func TestLoadStoreMissingVolumesDir(t *testing.T) {
	root := t.TempDir()
	content := filepath.Join(root, "content")
	write(t, filepath.Join(content, "pages", "about.md"), testPage)

	store := LoadStore(content, filepath.Join(root, "nope"))
	if len(store.Volumes) != 0 {
		t.Errorf("volumes = %d, want 0", len(store.Volumes))
	}
	if len(store.Pages) != 1 {
		t.Errorf("pages = %d, want 1", len(store.Pages))
	}
}
