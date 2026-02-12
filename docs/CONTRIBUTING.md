# Contributing

Guide for writing and publishing articles in terminull.

See also: [DEVELOPMENT.md](./DEVELOPMENT.md) | [ARCHITECTURE.md](./ARCHITECTURE.md) | [EDITING.md](./EDITING.md) | [ADMIN.md](./ADMIN.md)

---

## What We Publish

terminull is a hacker e-zine. We publish technical deep-dives, security
research, tool breakdowns, creative writing, ASCII art, and anything that
serves the hacker community. No corporate fluff, no SEO bait, no marketing
dressed up as content.

A good submission is:

- **Technical** -- teaches something real, doesn't hand-wave the hard parts
- **Original** -- your own work, your own perspective
- **Complete** -- a reader should walk away having learned something
- **Responsible** -- see [Ethics](#ethics) below

---

## Article Structure

### File Location

Articles live in `src/content/issues/vol{N}/` where `{N}` is the volume number.

```
src/content/issues/
└── vol1/
    ├── 00-editorial.md
    ├── 01-smashing-the-stack.md
    ├── 02-ascii-art-gallery.md
    ├── 03-kernel-rootkit-primer.md
    └── 04-news-roundup.md
```

### Naming Convention

```
{order:2d}-{slug}.md
```

- `order` -- two-digit zero-padded position in the volume TOC (e.g., `00`, `01`, `07`)
- `slug` -- lowercase, hyphen-separated identifier (e.g., `smashing-the-stack`)

Examples:

```
00-editorial.md
01-smashing-the-stack.md
12-advanced-rop-chains.md
```

### Frontmatter

Every article starts with YAML frontmatter between `---` fences:

```yaml
---
title: "Smashing the Stack in 2025"
author: "Sarah Chen"
handle: "stacksmash3r"            # optional, shown as (~handle)
date: 2025-06-15
volume: 1
order: 1
category: guide
tags: [exploitation, buffer-overflow, x86, linux]
description: "A modern guide to buffer overflow exploitation."
ascii_header: "/art/headers/skull.txt"  # optional, path in public/
draft: false
---
```

**Field reference:**

| Field          | Type       | Required | Description                                     |
|----------------|------------|----------|-------------------------------------------------|
| `title`        | string     | yes      | Article title. Displayed in TOC and article header. |
| `author`       | string     | yes      | Author's display name.                           |
| `handle`       | string     | no       | Author's handle, shown as `(~handle)`.           |
| `date`         | date       | yes      | Publication date in `YYYY-MM-DD` format.         |
| `volume`       | number     | yes      | Volume number this article belongs to.           |
| `order`        | number     | yes      | Position in the TOC. Must match filename prefix. |
| `category`     | enum       | yes      | One of the categories below.                     |
| `tags`         | string[]   | no       | Searchable tags. Default: `[]`.                  |
| `description`  | string     | yes      | One-line summary. Used in TOC and search.        |
| `ascii_header` | string     | no       | Path to ASCII art file in `public/`.             |
| `draft`        | boolean    | no       | If `true`, excluded from build. Default: `false`.|

### Categories

| Category        | Color | Purpose                                          |
|-----------------|-------|--------------------------------------------------|
| `editorial`     | gold  | Editor letters, meta commentary, volume intros   |
| `guide`         | cyan  | Technical tutorials, how-to articles             |
| `writeup`       | green | CTF writeups, vulnerability analyses, case studies |
| `tool`          | green | Tool reviews, tool-building guides               |
| `security-news` | red   | News roundups, incident analysis, industry commentary |
| `ascii-art`     | pink  | ASCII/ANSI art showcases and galleries           |
| `fiction`       | pink  | Short stories, cyberpunk fiction, speculative pieces |
| `interview`     | gold  | Q&A with hackers, researchers, artists           |

Categories are defined in `src/content/config.ts` and color-mapped in
`src/components/CategoryBadge.astro`.

---

## Writing in Markdown

Articles are standard Markdown rendered through the glow-md pipeline. Here is
every supported feature and how it appears.

### Headings

```markdown
# H1 -- Gold background block, dark text, uppercase
## H2 -- Cyan text with "## " prefix, bottom border
### H3 -- Green text with "### " prefix
#### H4 -- Gold-dim text
```

Use `# Title` as the first line of your article body (after frontmatter). Use
`##` for major sections, `###` for subsections.

### Code Blocks

Fenced code blocks with a language identifier get syntax highlighting (Shiki)
and a language label header:

````markdown
```python
def exploit(target):
    payload = b"A" * 64 + p64(ret_addr)
    target.send(payload)
```
````

Blocks without a language identifier render as plain preformatted text with no
header.

The custom `terminull` Shiki theme colors code to match the site palette:
keywords in cyan, strings in green, functions in pink, numbers in gold.

### Inline Code

```markdown
Use `nmap -sV` to scan for service versions.
```

Inline code renders in pink on a dark surface background.

### Admonitions

Three admonition types are supported via a custom remark plugin. Use them
inside blockquotes:

```markdown
> [!WARN] This technique may violate computer fraud laws in your jurisdiction.

> [!HACK] You can bypass the check by overwriting the return address.

> [!INFO] This section assumes familiarity with x86-64 calling conventions.
```

Each renders as a bordered box with a colored header:

- **WARN** -- Gold border and header, prefixed with `[!]`. Use for legal
  disclaimers, safety warnings, destructive operations.
- **HACK** -- Green border and header, prefixed with `[*]`. Use for tips,
  tricks, clever techniques, key insights.
- **INFO** -- Cyan border and header, prefixed with `[i]`. Use for background
  context, prerequisites, supplementary notes.

The admonition text follows the `[!TYPE]` marker on the same line or in
subsequent lines of the blockquote:

```markdown
> [!WARN] Single-line admonition.

> [!HACK] Multi-line admonition.
>
> Additional paragraphs go here. The entire blockquote
> becomes the admonition body.
```

### Tables

```markdown
| Register | Purpose         | Convention    |
|----------|-----------------|---------------|
| RAX      | Return value    | Caller-saved  |
| RDI      | 1st argument    | Caller-saved  |
| RSI      | 2nd argument    | Caller-saved  |
```

Tables render with gold headers, subtle row borders, and hover highlights.

### Lists

Unordered lists use green `*` bullets:

```markdown
- First item
- Second item
  - Nested item
```

Ordered lists use gold numbers:

```markdown
1. First step
2. Second step
3. Third step
```

### Blockquotes

```markdown
> The street finds its own uses for things.
> -- William Gibson
```

Blockquotes render with a green left border and `>` prefix.

### Links

```markdown
[Phrack Magazine](http://phrack.org)
```

Links render in cyan with an underline.

### Emphasis

```markdown
**Bold text** renders in white (brighter than default).
*Italic text* renders in pink italic.
```

### Horizontal Rules

```markdown
---
```

Renders as a dashed line. Use to separate major sections or before a sign-off.

### Images

```markdown
![Screenshot of the exploit](./screenshot.png)
```

Images get a subtle border and max-width: 100%.

---

## Content Conventions

### Tone

Write like you're explaining something to a competent peer. Direct, technical,
no hand-holding but no gatekeeping either. Skip corporate jargon, marketing
speak, and unnecessary disclaimers.

Good:
> The heap allocator maintains a freelist of previously-freed chunks.

Bad:
> In this section, we'll explore how the heap allocator leverages
> cutting-edge memory management strategies to optimize performance.

### Ethics

terminull publishes educational security content. Follow these rules:

1. **Responsible disclosure** -- never publish zero-days or unpatched vulns
   targeting production systems. If your research involves a real vuln, ensure
   it's been patched and disclosed before submitting.

2. **Legal warnings** -- use `> [!WARN]` admonitions before any technique
   that could violate computer fraud laws if misapplied.

3. **No live exploit code** -- demonstrate concepts, don't provide
   copy-paste weapons. Use intentionally vulnerable targets (CTF challenges,
   deliberately vulnerable VMs, your own lab).

4. **Attribution** -- cite your sources. Credit prior work.

### Sign-Off Convention

End articles with a horizontal rule followed by an italicized closing and
author handle:

```markdown
---

*Stay curious. Break things responsibly.*

*-- ~stacksmash3r*
```

### ASCII Art in Articles

Use fenced code blocks (no language identifier) or unfenced preformatted blocks
for inline ASCII art. Keep art under 76 characters wide to avoid horizontal
scroll on most terminals.

````markdown
```
  ____  _            _
 / ___|| | __ _  ___| | __
 \___ \| |/ _` |/ __| |/ /
  ___) | | (_| | (__|   <
 |____/|_|\__,_|\___|_|\_\
```
````

For reusable art, add files to `public/art/` and reference them via the
`ascii_header` frontmatter field or the `AsciiArt` component.

---

## Submission Workflow

1. **Fork** the repository and clone it locally.

2. **Create your article** in `src/content/issues/vol{N}/`:
   ```
   {order:2d}-{your-slug}.md
   ```
   Start with `draft: true` in frontmatter.

3. **Write** your content following the conventions above.

4. **Verify** the build:
   ```bash
   npm install
   npm run build
   ```
   The build will catch frontmatter schema errors, broken references, and
   markdown syntax issues.

5. **Preview** locally:
   ```bash
   npm run dev
   ```
   Navigate to your article and check rendering.

6. **Submit a PR** with your article. Keep `draft: true` until review is
   complete.

7. **Publication** -- once approved, `draft` is set to `false` and the article
   goes live on the next deploy.

---

## Static Pages

Static pages live in `src/content/pages/` and are auto-routed via
`src/pages/[page].astro`. Their frontmatter is simpler:

```yaml
---
title: "About"
description: "What is terminull?"
---
```

Only `title` is required. The page renders inside `BaseLayout` with the
`glow-md` wrapper, so all the same markdown features are available.

Currently: `about.md`, `manifesto.md`.
