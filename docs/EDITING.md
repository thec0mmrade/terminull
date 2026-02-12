# Editing

Guide for reviewing, curating, and publishing content in terminull.

See also: [CONTRIBUTING.md](./CONTRIBUTING.md) | [DEVELOPMENT.md](./DEVELOPMENT.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [ADMIN.md](./ADMIN.md)

---

## Role of the Editor

The editor manages the publication pipeline. Authors write articles and submit
PRs (see [CONTRIBUTING.md](./CONTRIBUTING.md)). The editor:

- Reviews submissions for correctness, tone, and editorial standards
- Manages `draft` status and publication timing
- Controls article ordering within volumes
- Creates new volumes and updates the homepage
- Maintains consistency across author names, tags, and categories

The editor does **not** need to touch CSS, layouts, or components. Content
management is entirely through Markdown frontmatter and a handful of page
files.

---

## Reviewing Submissions

Authors submit PRs with `draft: true` articles. Here is what to check.

### Frontmatter Validation

Zod schema validation (`src/content/config.ts`) catches type errors and missing
required fields at build time. It does **not** catch semantic issues. Check
manually:

| Field          | What to verify                                               |
|----------------|--------------------------------------------------------------|
| `title`        | Descriptive, not clickbait                                   |
| `author`       | Spelled consistently with their other articles               |
| `handle`       | Spelled consistently (no central registry -- editor enforces) |
| `date`         | Correct publication date, `YYYY-MM-DD` format                |
| `volume`       | Matches the directory (e.g., `vol1/` articles have `volume: 1`) |
| `order`        | Matches filename prefix and is unique within the volume      |
| `category`     | Appropriate for the content (see [CONTRIBUTING.md -- Categories](./CONTRIBUTING.md#categories)) |
| `tags`         | Useful and consistent with existing tag vocabulary           |
| `description`  | One-line summary, not empty boilerplate (used in TOC and search) |
| `ascii_header` | If set, file exists in `public/`                             |
| `draft`        | Should be `true` during review                               |

### Build Verification

```bash
npm run build
```

This catches schema violations, broken references, and markdown syntax issues.
A clean build is the minimum bar for any PR.

### Preview Rendering

```bash
npm run dev
```

Navigate to the article at `/vol/{N}/{slug}` and check:

- Headings render correctly (h1 gold block, h2 cyan, h3 green)
- Code blocks have language labels and syntax highlighting
- Admonitions (`> [!WARN]`, `> [!HACK]`, `> [!INFO]`) render as styled boxes
- Tables, lists, and inline code look right
- ASCII art stays under ~76 characters wide (no horizontal scroll)

### Content Review

- **Tone** -- direct, technical, no corporate speak. See
  [CONTRIBUTING.md -- Tone](./CONTRIBUTING.md#tone).
- **Ethics** -- responsible disclosure, no live exploits against production
  systems, legal warnings via `> [!WARN]` on techniques that could violate
  computer fraud laws. See [CONTRIBUTING.md -- Ethics](./CONTRIBUTING.md#ethics).
- **Sign-off** -- articles should end with a horizontal rule and italicized
  closing with author handle.

### Author Consistency

`author` and `handle` are free-text strings with no central registry. The
editor is the consistency enforcement layer. Before merging, search existing
articles for the same author and verify spelling matches.

---

## Publishing an Article

### Flip the Draft Flag

Change `draft: true` to `draft: false` in the article's frontmatter (or remove
the `draft` field entirely -- the default is `false`).

The `draft` field is filtered in every location that queries the `issues`
collection, all using the same pattern:

```javascript
getCollection('issues', ({ data }) => !data.draft)
```

| File                                      | Purpose                  |
|-------------------------------------------|--------------------------|
| `src/pages/vol/[volume]/[slug].astro`     | Article page routes      |
| `src/pages/vol/[volume]/index.astro`      | Volume TOC               |
| `src/lib/search-index.ts`                 | Search index             |
| `src/pages/vol/[volume]/[slug].txt.ts`    | ANSI text article        |
| `src/pages/vol/[volume]/index.txt.ts`     | ANSI text volume TOC     |
| `src/pages/index.txt.ts`                  | ANSI text homepage       |

There is no partial publishing. An article is either fully visible (in routes,
TOC, search, and text endpoints) or fully hidden. No middle state.

### Deploy

Merge to `main` and push. The GitHub Actions pipeline
(`.github/workflows/deploy.yml`) handles the rest: build, upload artifact,
deploy to GitHub Pages.

---

## Managing Article Order

The `order` field in frontmatter controls:

- Position in the volume table of contents (`src/pages/vol/[volume]/index.astro`)
- Prev/next navigation links (`src/pages/vol/[volume]/[slug].astro:14-20`)

Articles in each volume are sorted by `order` ascending. The filename prefix
(`{order:2d}-`) is a convention for filesystem readability -- only the
frontmatter `order` value is used at runtime.

### Reordering

Update the `order` field in frontmatter. Optionally rename the file to keep
the filename prefix in sync.

### Inserting Between Existing Articles

Either renumber subsequent articles or use gaps in the ordering (e.g., 10, 20,
30 instead of 1, 2, 3). Gaps let you insert without touching other files.

### Duplicate Order Values

Two articles in the same volume with the same `order` value will have
unpredictable sort order. The build will not catch this -- the editor must
verify uniqueness manually.

---

## Creating a New Volume

### Step by Step

1. **Create the directory:**
   ```
   src/content/issues/vol{N}/
   ```

2. **Update the volumes array** in `src/pages/vol/index.astro`:
   ```typescript
   const volumes = [
     { label: 'Volume 1', href: '/vol/1', description: 'June 2025 -- Inaugural Issue' },
   ];
   ```

3. **Add a `Latest Issue` menu item** to `src/pages/index.astro` if desired:
   ```typescript
   { label: 'Latest Issue', href: '/vol/1', description: 'Volume 1 -- June 2025' },
   ```

4. **Add articles** to the new directory with matching `volume` frontmatter.

### What Auto-Generates

Volume TOC pages (`/vol/{N}`), article pages (`/vol/{N}/{slug}`), and their
ANSI text counterparts (`/vol/{N}/index.txt`, `/vol/{N}/{slug}.txt`) are all
created automatically via `getStaticPaths()`. No manual route configuration
is needed. As long as articles have the correct `volume` field and `draft:
false`, they appear in both HTML and text endpoints.

---

## Maintaining the Homepage

The homepage is `src/pages/index.astro`. Key editable sections:

### Menu Items (lines 6-12)

```typescript
const menuItems = [
  { label: 'Archive', href: '/vol', description: 'All volumes' },
  { label: 'About', href: '/about', description: 'What is terminull?' },
  { label: 'Manifesto', href: '/manifesto', description: 'What we believe' },
  { label: 'Help', href: '/help', description: 'Commands & navigation' },
];
```

When publishing a new volume, add a `Latest Issue` entry pointing to the new
volume's `href` and `description`.

### MOTD (lines 22-29)

```html
<div class="motd">
  <p class="motd-label">[MESSAGE OF THE DAY]</p>
  <p class="motd-text">
    Welcome to <strong>terminull</strong>. ...
  </p>
</div>
```

Update the MOTD text for new volumes, announcements, or seasonal messages.

### Footer (line 34)

```html
<p>terminull v1.0 // no tracking // no ads // no javascript required*</p>
```

Update the version string when appropriate.

---

## Managing Static Pages

Static pages in `src/content/pages/` auto-route to `/{slug}` via
`src/pages/[page].astro`. Currently: `about.md`, `manifesto.md`.

### Adding a New Static Page

1. Create `src/content/pages/{slug}.md` with frontmatter:
   ```yaml
   ---
   title: "Your Page Title"
   description: "Optional description."
   ---
   ```

2. To add it to the homepage menu, add an entry to `menuItems` in
   `src/pages/index.astro:6-12`.

3. To make it reachable via the `cd` command, add a case in the switch
   statement at `src/components/BbsPrompt.astro:79-97`:
   ```typescript
   } else if (section === 'your-page') {
     window.location.href = '/your-page';
   ```

---

## Content Consistency Checklist

Common editorial mistakes and how to catch them:

| Issue                                     | How to catch                                                                 |
|-------------------------------------------|------------------------------------------------------------------------------|
| Duplicate `order` values in same volume   | Manual check -- build does not catch this                                    |
| Filename prefix doesn't match `order`     | Compare filename to frontmatter; only cosmetic but causes confusion          |
| Inconsistent author/handle spelling       | Search existing articles for the author before merging                        |
| Empty or boilerplate `description`        | Read the TOC preview -- description appears in volume TOC and search results |
| Missing `> [!WARN]` on sensitive content  | Content review -- any technique that could violate computer fraud laws        |
| Overly broad or inconsistent tags         | Check existing articles' tags for vocabulary consistency                      |
| `ascii_header` points to nonexistent file | `npm run build` may not catch this -- verify the path exists in `public/`    |
| `volume` doesn't match directory          | Compare frontmatter to file path (e.g., `vol2/` must have `volume: 2`)      |
| `category` doesn't fit the content        | Subjective -- review against [category definitions](./CONTRIBUTING.md#categories) |
