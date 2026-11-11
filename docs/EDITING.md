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

Zod schema validation (`src/content.config.ts`) catches type errors and missing
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

### Publish

Articles live in the private content repo at `src/content/volumes/`. Publishing
is two steps:

1. Commit and push the content repo (`cd src/content/volumes && git add -A &&
   git commit && git push`). Publish refuses to run while it has uncommitted or
   unpushed changes.
2. From the engine repo, run `npm run publish`. It builds, uploads, switches
   the live site and BBS to the new release and verifies it. See
   [DEPLOY.md](./DEPLOY.md) for setup and rollback.

### The print zine

Every publish also exports each volume as two PDFs and puts them on the site.
Each volume's table of contents links them ("reader PDF", "booklet PDF"):

| File | For |
|------|-----|
| `/zine/terminull-vol{N}.pdf` | Reading on screen, or printing one 5.5"×8.5" page per sheet |
| `/zine/terminull-vol{N}-booklet.pdf` | A folded, stapled zine: two pages per letter sheet, in saddle-stitch order |

To print the booklet: letter paper, landscape, **double-sided, flip on the
short edge**, at 100% scale (not "fit to page"). Fold the stack in half and
staple along the fold.

To make the PDFs without publishing, run `npm run zine -- --volume N` (on
NixOS, inside the Chromium wrapper in [DEVELOPMENT.md](./DEVELOPMENT.md)).
They land in `public/zine/`.

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

1. **Create the directory** in the content repo:
   ```
   src/content/volumes/vol{N}/
   ```
   (Template articles to copy are in `src/content/templates/`.)

2. **Nothing to register.** The Archive page (`/vol`) lists volumes
   automatically from the articles it finds.

3. **Add a `Latest Issue` menu item** to `src/pages/index.astro` if desired:
   ```typescript
   { label: 'Latest Issue', href: '/vol/1', description: 'Volume 1 -- June 2025' },
   ```

4. **Add articles** to the new directory with matching `volume` frontmatter, then commit, push and publish (see above).

### What Auto-Generates

Volume TOC pages (`/vol/{N}`), article pages (`/vol/{N}/{slug}`), and their
ANSI text counterparts (`/vol/{N}/index.txt`, `/vol/{N}/{slug}.txt`) are all
created automatically via `getStaticPaths()`. No manual route configuration
is needed. As long as articles have the correct `volume` field and `draft:
false`, they appear in both HTML and text endpoints.

---

## Maintaining the Homepage

The homepage is `src/pages/index.astro`. The main menu and the message of the day are defined once, in
`src/lib/home.js` (`mainMenu()`, `MOTD_TEXT`), and used by the homepage
(`src/pages/index.astro`) and its `.txt` twin. The SSH BBS shows the same
menu and message: `mainMenu()` in `ssh/ui/screens/home.go` and `RenderMOTD()`
in `ssh/ui/components/chrome.go`. Change all three together; the Go and
JavaScript tests check the menu wording matches.

### Menu

Numbered from `[00]`, the same on the website, `.txt` and the BBS:

```
[00] Latest Volume - Volume 01, 12 articles
[01] Archive - All volumes
[02] About - What is terminull?
[03] Manifesto - What we believe
[04] Help - Commands & navigation
```

**Latest Volume** always opens the newest published volume, so publishing a
new volume needs no menu change. Number keys pick items: `0` opens `[00]`.

### MOTD

`MOTD_TEXT` in `src/lib/home.js` (and the same text in `RenderMOTD()` for the
BBS). Update it for new volumes, announcements, or seasonal messages. The
website adds "Type help or press ? …"; the BBS, which has no `help` command,
adds "Press ? …".

### Footer

```astro
<p>{versionLabel} // no analytics // no ads</p>
```

`versionLabel` ("terminull v1.0.0") comes from `package.json`; don't edit the
version here (see [Releasing](./DEVELOPMENT.md#releasing)). If you change the
claims, change them everywhere they appear: this footer, the `.txt` footer
(`src/lib/ansi-text.ts`), the SSH BBS footer (`ssh/ui/components/chrome.go`),
the print zine's back cover (`scripts/export-zine.js`) and the manifesto.

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

2. To add it to the homepage menu, add it to `mainMenu()` in
   `src/lib/home.js` and in `ssh/ui/screens/home.go`.

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
