package theme

import (
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/glamour/ansi"
)

// boolPtr returns a pointer to a bool.
func boolPtr(b bool) *bool { return &b }

// strPtr returns a pointer to a string.
func strPtr(s string) *string { return &s }

// uintPtr returns a pointer to a uint.
func uintPtr(n uint) *uint { return &n }

// TerminullStyle returns a custom Glamour StyleConfig matching glow-markdown.css.
func TerminullStyle() ansi.StyleConfig {
	return ansi.StyleConfig{
		Document: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color: strPtr("252"),
			},
			Margin: uintPtr(0),
		},
		Heading: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Bold:  boolPtr(true),
				Color: strPtr("220"), // gold
			},
		},
		H1: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Bold:            boolPtr(true),
				Color:           strPtr("220"), // gold
				BackgroundColor: strPtr("232"),
				BlockPrefix:     "\n",
				BlockSuffix:     "\n",
			},
		},
		H2: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Bold:   boolPtr(true),
				Color:  strPtr("81"), // cyan
				Prefix: "## ",
			},
		},
		H3: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Bold:   boolPtr(true),
				Color:  strPtr("148"), // green
				Prefix: "### ",
			},
		},
		H4: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color:  strPtr("136"), // goldDim
				Prefix: "#### ",
			},
		},
		H5: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color:  strPtr("136"),
				Prefix: "##### ",
			},
		},
		H6: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color:  strPtr("244"),
				Prefix: "###### ",
			},
		},
		Paragraph: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color: strPtr("252"),
			},
		},
		BlockQuote: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color:  strPtr("100"), // greenDim
				Italic: boolPtr(true),
			},
			Indent:      uintPtr(1),
			IndentToken: strPtr("│ "),
		},
		List: ansi.StyleList{
			StyleBlock: ansi.StyleBlock{
				StylePrimitive: ansi.StylePrimitive{
					Color: strPtr("252"),
				},
			},
			LevelIndent: 2,
		},
		Item: ansi.StylePrimitive{
			Color: strPtr("252"),
		},
		Enumeration: ansi.StylePrimitive{
			Color: strPtr("148"), // green bullets
		},
		Code: ansi.StyleBlock{
			StylePrimitive: ansi.StylePrimitive{
				Color:           strPtr("252"),
				BackgroundColor: strPtr("234"), // bgSurface
			},
			Margin: uintPtr(0),
		},
		CodeBlock: ansi.StyleCodeBlock{
			StyleBlock: ansi.StyleBlock{
				StylePrimitive: ansi.StylePrimitive{
					Color: strPtr("252"),
				},
				Margin: uintPtr(0),
			},
			Chroma: &ansi.Chroma{
				Text: ansi.StylePrimitive{
					Color: strPtr("#d0d0d0"),
				},
				Keyword: ansi.StylePrimitive{
					Color: strPtr("#5fd7ff"), // cyan
				},
				Name: ansi.StylePrimitive{
					Color: strPtr("#afd700"), // green
				},
				NameFunction: ansi.StylePrimitive{
					Color: strPtr("#ffd700"), // gold
				},
				LiteralString: ansi.StylePrimitive{
					Color: strPtr("#afd700"), // green
				},
				LiteralNumber: ansi.StylePrimitive{
					Color: strPtr("#ff5fd7"), // pink
				},
				Comment: ansi.StylePrimitive{
					Color: strPtr("#808080"), // secondary
				},
				Operator: ansi.StylePrimitive{
					Color: strPtr("#d0d0d0"),
				},
				Punctuation: ansi.StylePrimitive{
					Color: strPtr("#808080"),
				},
			},
		},
		Table: ansi.StyleTable{
			StyleBlock: ansi.StyleBlock{
				StylePrimitive: ansi.StylePrimitive{
					Color: strPtr("252"),
				},
			},
			CenterSeparator: strPtr("┼"),
			ColumnSeparator: strPtr("│"),
			RowSeparator:    strPtr("─"),
		},
		Link: ansi.StylePrimitive{
			Color:     strPtr("81"), // cyan
			Underline: boolPtr(true),
		},
		LinkText: ansi.StylePrimitive{
			Color: strPtr("81"),
		},
		Image: ansi.StylePrimitive{
			Color: strPtr("206"), // pink
		},
		ImageText: ansi.StylePrimitive{
			Color: strPtr("206"),
		},
		Emph: ansi.StylePrimitive{
			Color:  strPtr("206"), // pink
			Italic: boolPtr(true),
		},
		Strong: ansi.StylePrimitive{
			Bold: boolPtr(true),
		},
		Strikethrough: ansi.StylePrimitive{
			Color:     strPtr("244"),
			CrossedOut: boolPtr(true),
		},
		HorizontalRule: ansi.StylePrimitive{
			Color:  strPtr("236"), // border
			Format: "\n─────────────────────────────────────────────────────────────────\n",
		},
		DefinitionTerm: ansi.StylePrimitive{
			Color: strPtr("220"),
			Bold:  boolPtr(true),
		},
		DefinitionDescription: ansi.StylePrimitive{
			Color: strPtr("252"),
		},
		Task: ansi.StyleTask{
			Ticked:   "[x] ",
			Unticked: "[ ] ",
		},
	}
}

// NewGlamourRenderer creates a Glamour renderer with the terminull theme.
func NewGlamourRenderer(width int) (*glamour.TermRenderer, error) {
	style := TerminullStyle()
	return glamour.NewTermRenderer(
		glamour.WithStyles(style),
		glamour.WithWordWrap(width),
	)
}
