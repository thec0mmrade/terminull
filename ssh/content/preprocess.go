package content

import "regexp"

var (
	// admonitionRegex matches > [!TYPE] text in blockquotes
	admonitionRegex = regexp.MustCompile(`(?m)^(>\s*)\[!(WARN|HACK|INFO)\]\s*(.*)`)

	// imageRegex matches ![alt](path)
	imageRegex = regexp.MustCompile(`!\[([^\]]*)\]\([^)]+\)`)

	// videoRegex matches <video ...>...</video>
	videoRegex = regexp.MustCompile(`(?s)<video[^>]*>.*?</video>`)

	// audioRegex matches <audio ...>...</audio>
	audioRegex = regexp.MustCompile(`(?s)<audio[^>]*>.*?</audio>`)
)

// PreprocessMarkdown transforms markdown for terminal rendering.
// Converts admonition syntax and replaces media with placeholders.
func PreprocessMarkdown(md string, siteURL string, volume int, slug string) string {
	// Admonitions: > [!TYPE] text → > **[!] TYPE:** text
	result := admonitionRegex.ReplaceAllString(md, `${1}**[!] ${2}:** ${3}`)

	articleURL := siteURL + "/vol/" + itoa(volume) + "/" + slug

	// Images → placeholder
	result = imageRegex.ReplaceAllStringFunc(result, func(match string) string {
		sub := imageRegex.FindStringSubmatch(match)
		alt := "image"
		if len(sub) > 1 && sub[1] != "" {
			alt = sub[1]
		}
		return "[IMAGE: " + alt + "] — view at " + articleURL
	})

	// Video → placeholder
	result = videoRegex.ReplaceAllString(result, "[VIDEO] — view at "+articleURL)

	// Audio → placeholder
	result = audioRegex.ReplaceAllString(result, "[AUDIO] — view at "+articleURL)

	return result
}

func itoa(n int) string {
	if n < 0 {
		return "-" + uitoa(uint(-n))
	}
	return uitoa(uint(n))
}

func uitoa(n uint) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append(buf, byte('0'+n%10))
		n /= 10
	}
	// reverse
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}
