package content

import (
	"bytes"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Classic BBS ANSI art (.ANS) as an article: CP437 text with SGR colour
// codes and cursor-forward moves, usually followed by a SAUCE record.
//
// This mirrors src/lib/ansi-art.js; keep the two in step.
//
// The parser never passes escape sequences from the file through: the result
// is a grid of printable runes with colour indexes, and all output escapes
// are generated here.

// AnsiCols is the canvas width ANSI art is drawn for.
const AnsiCols = 80

const cp437Low = " ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼"
const cp437High = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐" +
	"└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "

var cp437 = func() [256]rune {
	var t [256]rune
	low, high := []rune(cp437Low), []rune(cp437High)
	for i := 0; i < 256; i++ {
		switch {
		case i < 0x20:
			t[i] = low[i]
		case i < 0x7f:
			t[i] = rune(i)
		case i == 0x7f:
			t[i] = '⌂'
		default:
			t[i] = high[i-0x80]
		}
	}
	return t
}()

// vgaPalette is the 16-colour VGA text-mode palette, in ANSI colour order.
var vgaPalette = [16][3]uint8{
	{0, 0, 0}, {170, 0, 0}, {0, 170, 0}, {170, 85, 0},
	{0, 0, 170}, {170, 0, 170}, {0, 170, 170}, {170, 170, 170},
	{85, 85, 85}, {255, 85, 85}, {85, 255, 85}, {255, 255, 85},
	{85, 85, 255}, {255, 85, 255}, {85, 255, 255}, {255, 255, 255},
}

// AnsiCell is one character cell.
type AnsiCell struct {
	Ch     rune
	Fg, Bg uint8 // Fg 0-15, Bg 0-7
}

// AnsiArt is a parsed piece of ANSI art.
type AnsiArt struct {
	Rows [][]AnsiCell // each row padded to AnsiCols
	Body []byte       // art bytes only (no EOF marker, no SAUCE record)

	// From the SAUCE record, if present.
	Title, Author, Group, Date string
}

// sauce is the metadata record at the end of most art files.
type sauce struct {
	Title, Author, Group string
	Date                 string // YYYY-MM-DD or ""
	Width                int    // 0 when the record does not say
}

func parseSauce(data []byte) *sauce {
	if len(data) < 128 {
		return nil
	}
	rec := data[len(data)-128:]
	if string(rec[:7]) != "SAUCE00" {
		return nil
	}
	field := func(from, n int) string {
		var b strings.Builder
		for _, c := range rec[from : from+n] {
			b.WriteRune(cp437[c])
		}
		return strings.TrimRight(b.String(), " \u00a0")
	}
	s := &sauce{Title: field(7, 35), Author: field(42, 20), Group: field(62, 20)}
	if d := field(82, 8); len(d) == 8 {
		if _, err := strconv.Atoi(d); err == nil {
			s.Date = d[:4] + "-" + d[4:6] + "-" + d[6:]
		}
	}
	// DataType 1 (character), FileType 0/1 (ASCII/ANSi): TInfo1 is the width.
	if rec[94] == 1 && rec[95] <= 1 {
		s.Width = int(rec[96]) | int(rec[97])<<8
	}
	return s
}

// ansiBody returns the art bytes only: everything before the EOF marker or
// SAUCE record.
func ansiBody(data []byte) []byte {
	if i := bytes.IndexByte(data, 0x1a); i >= 0 {
		return data[:i]
	}
	if parseSauce(data) != nil {
		return data[:len(data)-128]
	}
	return data
}

// readCSI reads the CSI sequence starting at body[i] (ESC followed by '[').
// It returns the numeric parameters, the final byte (0 if truncated), and
// the index after the sequence.
func readCSI(body []byte, i int) (params []int, final byte, next int) {
	j := i + 2
	params = []int{0}
	for j < len(body) && (body[j] < 0x40 || body[j] > 0x7e) {
		switch c := body[j]; {
		case c >= '0' && c <= '9':
			params[len(params)-1] = params[len(params)-1]*10 + int(c-'0')
		case c == ';':
			params = append(params, 0)
		}
		j++
	}
	if j < len(body) {
		final = body[j]
	}
	return params, final, j + 1
}

func isCSI(body []byte, i int) bool {
	return body[i] == 0x1b && i+1 < len(body) && body[i+1] == '['
}

// AnsiUnsupportedReason says why a file cannot be shown, or "" if it can.
// Only 80-column art using colours and cursor-forward moves is supported.
func AnsiUnsupportedReason(data []byte) string {
	if s := parseSauce(data); s != nil && s.Width > AnsiCols {
		return fmt.Sprintf("it is %d columns wide (maximum %d)", s.Width, AnsiCols)
	}
	body := ansiBody(data)
	drawn := false
	for i := 0; i < len(body); i++ {
		if isCSI(body, i) {
			params, final, next := readCSI(body, i)
			switch final {
			case 'm':
				for _, p := range params {
					if p == 5 || p == 6 {
						return "it uses blinking text"
					}
				}
			case 'H', 'f':
				if drawn {
					return "it repositions the cursor mid-drawing"
				}
			case 'C', 'J', 'h', 'l':
			default:
				return fmt.Sprintf("it uses an unsupported cursor command (CSI %q)", final)
			}
			i = next - 1
		} else if body[i] != '\r' && body[i] != '\n' {
			drawn = true
		}
	}
	return ""
}

var ansiNameRe = regexp.MustCompile(`^(\d+)-(.*)$`)

// ansiArticle builds the article for an art file named {order}-{slug}.ans.
// Title, artist, group and date come from the SAUCE record when present.
func ansiArticle(filename string, data []byte, volume int) Article {
	stem := filename[:len(filename)-len(".ans")]
	art := ParseAnsiArt(data)

	title, order := stem, 0
	if m := ansiNameRe.FindStringSubmatch(stem); m != nil {
		order, _ = strconv.Atoi(m[1])
		title = m[2]
	}
	if art.Title != "" {
		title = art.Title
	}
	author := art.Author
	if author == "" {
		author = "unknown"
	}
	desc := "ANSI art by " + author
	if art.Group != "" {
		desc += " of " + art.Group
	}
	date, _ := time.Parse("2006-01-02", art.Date) // zero when absent

	return Article{
		Title:       title,
		Author:      author,
		Description: desc + ".",
		Date:        date,
		Volume:      volume,
		Order:       order,
		Category:    "ascii-art",
		Tags:        []string{"ansi"},
		Slug:        strings.ToLower(stem),
		Art:         art,
	}
}

// AnsiCursor replays the art's byte stream to track where a terminal's
// cursor would be after a given number of bytes.
type AnsiCursor struct {
	Pos, Row, Col int
}

// Advance consumes bytes up to target (an escape sequence is consumed whole),
// moving the cursor the way a terminal would. onChar is called for each
// printed byte and onSGR for each colour sequence; either may be nil.
//
// Wrap rule (as in ansilove, the reference renderer): a cursor that has run
// off the right edge wraps before the next byte of any kind is processed,
// including cursor moves and line breaks.
func (c *AnsiCursor) Advance(body []byte, target int, onChar func(b byte, row, col int), onSGR func(params []int)) {
	if target > len(body) {
		target = len(body)
	}
	for c.Pos < target {
		b := body[c.Pos]
		if c.Col >= AnsiCols {
			c.Col = 0
			c.Row++
		}
		if isCSI(body, c.Pos) {
			params, final, next := readCSI(body, c.Pos)
			switch final {
			case 'C':
				n := params[0]
				if n == 0 {
					n = 1
				}
				c.Col = min(AnsiCols, c.Col+n)
			case 'm':
				if onSGR != nil {
					onSGR(params)
				}
			}
			c.Pos = next
			continue
		}
		switch {
		case b == '\r':
			c.Col = 0
		case b == '\n':
			c.Row++
		case b != 0x1b:
			if onChar != nil {
				onChar(b, c.Row, c.Col)
			}
			c.Col++
		}
		c.Pos++
	}
}

// ParseAnsiArt parses a .ANS file.
func ParseAnsiArt(data []byte) *AnsiArt {
	art := &AnsiArt{Body: ansiBody(data)}
	if s := parseSauce(data); s != nil {
		art.Title, art.Author, art.Group, art.Date = s.Title, s.Author, s.Group, s.Date
	}

	var fg, bg uint8 = 7, 0
	bold := false

	var cur AnsiCursor
	cur.Advance(art.Body, len(art.Body),
		func(b byte, row, col int) {
			for len(art.Rows) <= row {
				r := make([]AnsiCell, AnsiCols)
				for i := range r {
					r[i] = AnsiCell{Ch: ' ', Fg: 7}
				}
				art.Rows = append(art.Rows, r)
			}
			f := fg
			if bold {
				f += 8
			}
			art.Rows[row][col] = AnsiCell{Ch: cp437[b], Fg: f, Bg: bg}
		},
		func(params []int) {
			for _, n := range params {
				switch {
				case n == 0:
					fg, bg, bold = 7, 0, false
				case n == 1:
					bold = true
				case n == 22:
					bold = false
				case n >= 30 && n <= 37:
					fg = uint8(n - 30)
				case n >= 40 && n <= 47:
					bg = uint8(n - 40)
				}
			}
		})

	return art
}

// RenderRow renders the first upto cells of a row as a string with 24-bit
// colour escapes in the VGA palette. The rest of the row is left unpainted.
func (a *AnsiArt) RenderRow(r, upto int) string {
	if r < 0 || r >= len(a.Rows) {
		return ""
	}
	cells := a.Rows[r]
	if upto > len(cells) {
		upto = len(cells)
	}
	var b strings.Builder
	for i := 0; i < upto; {
		c := cells[i]
		f, g := vgaPalette[c.Fg], vgaPalette[c.Bg]
		fmt.Fprintf(&b, "\x1b[38;2;%d;%d;%d;48;2;%d;%d;%dm", f[0], f[1], f[2], g[0], g[1], g[2])
		for i < upto && cells[i].Fg == c.Fg && cells[i].Bg == c.Bg {
			b.WriteRune(cells[i].Ch)
			i++
		}
	}
	if upto > 0 {
		b.WriteString("\x1b[0m")
	}
	return b.String()
}
