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

Articles live in `src/content/volumes/vol{N}/` where `{N}` is the volume number. That folder is the zine's content repo, kept separate from the engine repo (see [DEVELOPMENT.md](./DEVELOPMENT.md)); starter templates are in `src/content/templates/`.

```
src/content/volumes/
└── vol{N}/
    ├── 00-editorial.md
    ├── 01-first-article.md
    └── 02-second-article.mdx    # .mdx for video/audio embeds
```

### Naming Convention

```
{order:2d}-{slug}.md       # standard markdown
{order:2d}-{slug}.mdx      # MDX (needed for video/audio embeds)
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

Categories are defined in `src/content.config.ts` and color-mapped in
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
![Screenshot of the exploit](/media/screenshot.png)
```

Images get a subtle border and max-width: 100%. Place files in `public/media/`.

### Video (MDX only)

Use `.mdx` file extension to embed `<video>` elements:

```mdx
<video src="/media/demo.mp4" controls>
  Your browser does not support the video element.
</video>
```

Videos get a border, dark surface background, and max-width: 100%.

### Audio (MDX only)

Use `.mdx` file extension to embed `<audio>` elements:

```mdx
<audio src="/media/clip.mp3" controls>
  Your browser does not support the audio element.
</audio>
```

Audio players render at full width. Place media files in `public/media/`.

### YouTube (MDX only)

Use the privacy-enhanced embed address, which sets no tracking cookies until
the reader presses play:

```mdx
<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
  title="What the video shows" width="560" height="315" allowfullscreen></iframe>
```

Only the website plays it: the SSH BBS, the `.txt` endpoints and the print
zine can't, so also give the plain `https://www.youtube.com/watch?v=VIDEO_ID`
link in the text.

### What the site's security policy allows

The site sends a Content-Security-Policy (see [ADMIN.md](./ADMIN.md)), so an
article can use:

- images and `<video>`/`<audio>` from this site or any `https://` address;
- YouTube embeds (`www.youtube.com` or `www.youtube-nocookie.com`).

It cannot use scripts (inline or from another site) or iframes from any other
site: the browser blocks them and shows an empty space. Ask the site admin to
allow a new embed host if an article needs one.

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

### ANSI Art as an Article

A classic BBS ANSI art file can be an article by itself. Put the `.ANS` file
in the volume folder, named like any article:

```
src/content/volumes/vol1/11-xibalba.ans
```

That is the whole step. There is no markdown file and no frontmatter:

- The number sets its place in the table of contents; the rest of the name is
  its URL (`/vol/1/11-xibalba`).
- Title, artist, group and date come from the file's SAUCE record (the credits
  most art files carry). A file without one uses its filename as the title and
  "unknown" as the artist.
- It is published as soon as the file is in the folder. There is no draft
  flag; keep a file out of the folder to hold it back.

Readers see it draw in cell by cell at 9600 baud on the web and over SSH, get
the coloured art from the `.txt` endpoint, and find it in greyscale in the
print zine.

Limits: 80 columns wide at most, colours and "cursor right" moves only. A file
that blinks, repositions the cursor mid-drawing, or is wider than 80 columns is
skipped with a build warning. Only publish art you have the right to share,
and keep the artist's credits intact.

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

### Submitting to terminull

Articles are not taken by pull request: terminull's issues live in a private
content repo, and the editor adds each accepted article to it.

1. **Pitch or send it.** Email **c0mmrade02@proton.me** with either a short pitch (topic,
   category, rough length) or the finished article. A pitch first saves you
   work if the topic is already covered.

2. **Write it** as a markdown file named `{order:2d}-{your-slug}.md`, starting
   from a template in `src/content/templates/`, following the conventions
   above. Send it with `draft: true` in the frontmatter; the editor flips it
   when the article is accepted. Attach the file, plus any images or media it
   uses.

3. **Preview it (optional).** Clone the engine and drop your file into
   `src/content/volumes/vol1/` (that folder is gitignored, so nothing you put
   there is ever committed). The site hides drafts, so set `draft: false` in
   your local copy while you look at it (and back to `true` before you send
   it). Then:
   ```bash
   npm install
   npm run dev
   ```
   Check how it renders. `npm run build` also catches frontmatter schema
   errors, broken references and markdown syntax issues.

4. **Review.** The editor reads it for correctness, tone and the ethics
   guidelines, and may ask for changes. `.mdx` files can import modules and
   run JavaScript at build time, so an `.mdx` submission is reviewed as code,
   not just as prose. Use `.md` unless you need a video or audio embed.

5. **Publication.** The editor sets the article's order, flips `draft` to
   `false`, commits it to the content repo and publishes. It appears on the
   website, the SSH BBS, the `.txt` endpoints and in the next print zine.

### Improving the engine

Code, theme, documentation and bug-fix contributions are welcome as pull
requests to the public `terminull` repository (see
[DEVELOPMENT.md](./DEVELOPMENT.md)). Keep them free of article content.

### Running your own zine

terminull is a template as much as a publication. To run your own:

1. Fork or clone the engine.
2. Keep your issues in your own content repo, checked out at
   `src/content/volumes/` (see [DEVELOPMENT.md](./DEVELOPMENT.md) and
   [DEPLOY.md](./DEPLOY.md)). Nothing of terminull's content comes with the
   engine.
3. Rewrite the starter text: the About page, the manifesto and the homepage
   message are examples, and **this section's contact address and the About
   page's are terminull's, not yours**. Replace them with where your writers
   should send submissions.

This guide then works unchanged for your own authors: article format,
markdown features, ethics and sign-off conventions. Only the place they send
articles differs.

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
