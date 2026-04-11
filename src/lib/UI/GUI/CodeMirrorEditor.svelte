<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { highlightSpecialChars, drawSelection, EditorView, ViewPlugin, Decoration, type DecorationSet, type ViewUpdate, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
    import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
    import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
    import { EditorState, RangeSetBuilder } from '@codemirror/state'
    import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
    import { textAreaSize } from 'src/ts/gui/guisize'

    const minimalSetup = [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
    ]

    interface Props {
        value?: string
        lang?: 'markdown' | 'html' | 'plain' | 'regex' | 'cbs'
        placeholder?: string
        class?: string
        height?: '20' | '24' | '28' | '32' | '36' | '40' | 'full' | 'default'
        onchange?: (value: string) => void
    }

    let {
        value = $bindable(''),
        lang = 'markdown',
        placeholder = '',
        class: className = '',
        height = 'default',
        onchange
    }: Props = $props()

    let editorEl: HTMLDivElement
    let view: EditorView | null = null
    let isInternalUpdate = false

    // Check if className contains height classes (h- or min-h-)
    const hasCustomHeight = className.includes('h-') || className.includes('min-h-')

    // CBS nesting level colors
    const cbsColors = [
        '#8be9fd', // level 0 - cyan
        '#50fa7b', // level 1 - green
        '#ffb86c', // level 2 - orange
        '#ff79c6', // level 3 - pink
        '#bd93f9', // level 4 - purple
    ]

    // CBS highlighting decoration classes
    const cbsBracketDecos = cbsColors.map((_, i) =>
        Decoration.mark({ class: `cm-cbs-bracket-${i}` })
    )
    const cbsContentDecos = cbsColors.map((_, i) =>
        Decoration.mark({ class: `cm-cbs-content-${i}` })
    )

    // CBS parsing
    function parseCBS(text: string): { from: number; to: number; type: 'bracket' | 'content'; level: number }[] {
        const results: { from: number; to: number; type: 'bracket' | 'content'; level: number }[] = []
        let depth = 0
        let i = 0
        const stack: number[] = []

        while (i < text.length) {
            if (text[i] === '{' && text[i + 1] === '{') {
                results.push({ from: i, to: i + 2, type: 'bracket', level: depth })
                stack.push(i + 2)
                depth++
                i += 2
            } else if (text[i] === '}' && text[i + 1] === '}' && depth > 0) {
                depth--
                const contentStart = stack.pop()!
                if (i > contentStart) {
                    results.push({ from: contentStart, to: i, type: 'content', level: depth })
                }
                results.push({ from: i, to: i + 2, type: 'bracket', level: depth })
                i += 2
            } else {
                i++
            }
        }

        return results
    }

    // Markdown decoration classes
    const mdHeading1Deco = Decoration.mark({ class: 'cm-md-h1' })
    const mdHeading2Deco = Decoration.mark({ class: 'cm-md-h2' })
    const mdHeading3Deco = Decoration.mark({ class: 'cm-md-h3' })
    const mdHeadingDeco = Decoration.mark({ class: 'cm-md-heading' }) // h4-h6
    const mdBoldDeco = Decoration.mark({ class: 'cm-md-bold' })
    const mdItalicDeco = Decoration.mark({ class: 'cm-md-italic' })
    const mdBoldItalicDeco = Decoration.mark({ class: 'cm-md-bold-italic' })
    const mdStrikeDeco = Decoration.mark({ class: 'cm-md-strike' })
    const mdCodeDeco = Decoration.mark({ class: 'cm-md-code' })

    // XML tag nesting level decorations (same colors as CBS)
    const xmlTagDecos = cbsColors.map((_, i) =>
        Decoration.mark({ class: `cm-xml-tag-${i}` })
    )

    // CSS decoration classes
    const cssSelectorDeco = Decoration.mark({ class: 'cm-css-selector' })
    const cssPropertyDeco = Decoration.mark({ class: 'cm-css-property' })
    const cssValueDeco = Decoration.mark({ class: 'cm-css-value' })
    const cssBracketDeco = Decoration.mark({ class: 'cm-css-bracket' })
    const cssCommentDeco = Decoration.mark({ class: 'cm-css-comment' })

    // XML tag parsing with nesting level tracking
    type XmlTagMatch = { from: number; to: number; level: number }

    function parseXmlTags(text: string): XmlTagMatch[] {
        const results: XmlTagMatch[] = []
        const tagStack: string[] = []

        // Match opening tags, closing tags, and self-closing tags
        const tagRegex = /<(\/?)\s*([a-zA-Z_][\w\-]*)[^>]*?(\/?)>/g
        let match

        while ((match = tagRegex.exec(text)) !== null) {
            const isClosing = match[1] === '/'
            const tagName = match[2].toLowerCase()
            const isSelfClosing = match[3] === '/'

            if (isSelfClosing) {
                // Self-closing tag: use current depth
                results.push({ from: match.index, to: match.index + match[0].length, level: tagStack.length })
            } else if (isClosing) {
                // Closing tag: pop from stack first, then color at new level
                const lastIndex = tagStack.lastIndexOf(tagName)
                if (lastIndex !== -1) {
                    tagStack.splice(lastIndex, 1)
                }
                results.push({ from: match.index, to: match.index + match[0].length, level: tagStack.length })
            } else {
                // Opening tag: color at current level, then push
                results.push({ from: match.index, to: match.index + match[0].length, level: tagStack.length })
                tagStack.push(tagName)
            }
        }

        return results
    }

    // CSS parsing for <style> tag contents
    type CssMatch = { from: number; to: number; type: 'selector' | 'property' | 'value' | 'bracket' | 'comment' }

    function parseCSS(text: string, offset: number): CssMatch[] {
        const results: CssMatch[] = []

        // Comments: /* ... */
        const commentRegex = /\/\*[\s\S]*?\*\//g
        let match
        while ((match = commentRegex.exec(text)) !== null) {
            results.push({ from: offset + match.index, to: offset + match.index + match[0].length, type: 'comment' })
        }

        // Remove comments for further parsing
        const textNoComments = text.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

        // Find all braces positions
        const braceRegex = /[{}]/g
        while ((match = braceRegex.exec(textNoComments)) !== null) {
            results.push({ from: offset + match.index, to: offset + match.index + 1, type: 'bracket' })
        }

        // Parse selectors (text before {)
        const selectorRegex = /([^{}]+?)(\s*\{)/g
        while ((match = selectorRegex.exec(textNoComments)) !== null) {
            const selector = match[1].trim()
            if (selector.length > 0) {
                // Find actual position of selector in original text
                const searchStart = match.index
                const selectorPos = textNoComments.indexOf(selector, searchStart)
                if (selectorPos !== -1) {
                    results.push({ from: offset + selectorPos, to: offset + selectorPos + selector.length, type: 'selector' })
                }
            }
        }

        // Parse property: value pairs
        const declRegex = /([\w-]+)(\s*:\s*)([^;{}]+)/g
        while ((match = declRegex.exec(textNoComments)) !== null) {
            const propName = match[1]
            const colonPart = match[2]
            const propValue = match[3].trimEnd()

            // Property name position
            const propStart = match.index
            results.push({ from: offset + propStart, to: offset + propStart + propName.length, type: 'property' })

            // Value position (after property name and colon)
            const valueStart = propStart + propName.length + colonPart.length
            results.push({ from: offset + valueStart, to: offset + valueStart + propValue.length, type: 'value' })
        }

        return results
    }

    // Find <style> tag contents and parse CSS
    function findStyleTagContents(text: string): CssMatch[] {
        const results: CssMatch[] = []
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
        let match

        while ((match = styleRegex.exec(text)) !== null) {
            const cssContent = match[1]
            const cssStart = match.index + match[0].indexOf(cssContent)
            const cssMatches = parseCSS(cssContent, cssStart)
            results.push(...cssMatches)
        }

        return results
    }

    // Markdown parsing (regex-based for universal highlighting)
    type MarkdownMatch = { from: number; to: number; type: 'h1' | 'h2' | 'h3' | 'heading' | 'bold' | 'italic' | 'bolditalic' | 'strike' | 'code' }

    function parseMarkdown(text: string): MarkdownMatch[] {
        const results: MarkdownMatch[] = []

        // Headings: # at line start (up to 6 levels)
        const headingRegex = /^(#{1,6})\s+.+$/gm
        let match
        while ((match = headingRegex.exec(text)) !== null) {
            const level = match[1].length
            let type: 'h1' | 'h2' | 'h3' | 'heading' = 'heading'
            if (level === 1) type = 'h1'
            else if (level === 2) type = 'h2'
            else if (level === 3) type = 'h3'
            results.push({ from: match.index, to: match.index + match[0].length, type })
        }

        // Bold+Italic: ***text*** (not underscore style to avoid variable_name issues, no newlines)
        const boldItalicRegex = /(\*\*\*)(?!\s)([^\*\n]+?)(?<!\s)\1/g
        while ((match = boldItalicRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'bolditalic' })
        }

        // Bold: **text** (not *** or underscore style to avoid variable_name issues, no newlines)
        const boldRegex = /(?<!\*)(\*\*)(?!\*)(?!\s)([^\*\n]+?)(?<!\s)(?<!\*)\1(?!\*)/g
        while ((match = boldRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'bold' })
        }

        // Italic: *text* (not ** or underscore style to avoid variable_name issues, no newlines)
        const italicRegex = /(?<!\*)(\*)(?!\*)(?!\s)([^\*\n]+?)(?<!\s)(?<!\*)\1(?!\*)/g
        while ((match = italicRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'italic' })
        }

        // Strikethrough: ~~text~~ (no newlines)
        const strikeRegex = /~~(?!\s)([^\n]+?)(?<!\s)~~/g
        while ((match = strikeRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'strike' })
        }

        // Inline code: `code`
        const codeRegex = /`([^`\n]+)`/g
        while ((match = codeRegex.exec(text)) !== null) {
            results.push({ from: match.index, to: match.index + match[0].length, type: 'code' })
        }

        return results
    }

    // Regex decoration classes
    const regexGroupDeco = Decoration.mark({ class: 'cm-regex-group' })
    const regexCharClassDeco = Decoration.mark({ class: 'cm-regex-charclass' })
    const regexQuantifierDeco = Decoration.mark({ class: 'cm-regex-quantifier' })
    const regexAnchorDeco = Decoration.mark({ class: 'cm-regex-anchor' })
    const regexEscapeDeco = Decoration.mark({ class: 'cm-regex-escape' })
    const regexAlternationDeco = Decoration.mark({ class: 'cm-regex-alternation' })

    type RegexMatch = { from: number; to: number; type: 'group' | 'charclass' | 'quantifier' | 'anchor' | 'escape' | 'alternation' }

    function parseRegex(text: string): RegexMatch[] {
        const results: RegexMatch[] = []
        let i = 0

        while (i < text.length) {
            // Escape sequences: \d, \w, \s, \D, \W, \S, \b, \B, \n, \r, \t, \\, \., etc.
            if (text[i] === '\\' && i + 1 < text.length) {
                results.push({ from: i, to: i + 2, type: 'escape' })
                i += 2
                continue
            }

            // Character class: [...]
            if (text[i] === '[') {
                const start = i
                i++
                // Handle negation [^...]
                if (text[i] === '^') i++
                // Find closing ]
                while (i < text.length) {
                    if (text[i] === '\\' && i + 1 < text.length) {
                        i += 2 // Skip escaped char
                    } else if (text[i] === ']') {
                        i++
                        break
                    } else {
                        i++
                    }
                }
                results.push({ from: start, to: i, type: 'charclass' })
                continue
            }

            // Groups: (...), (?:...), (?=...), (?!...), (?<=...), (?<!...)
            if (text[i] === '(' || text[i] === ')') {
                results.push({ from: i, to: i + 1, type: 'group' })
                i++
                continue
            }

            // Quantifiers: *, +, ?, {n}, {n,}, {n,m}
            if (text[i] === '*' || text[i] === '+' || text[i] === '?') {
                results.push({ from: i, to: i + 1, type: 'quantifier' })
                i++
                continue
            }

            if (text[i] === '{') {
                const start = i
                const match = text.slice(i).match(/^\{\d+(?:,\d*)?\}/)
                if (match) {
                    results.push({ from: start, to: start + match[0].length, type: 'quantifier' })
                    i += match[0].length
                    continue
                }
            }

            // Anchors: ^, $
            if (text[i] === '^' || text[i] === '$') {
                results.push({ from: i, to: i + 1, type: 'anchor' })
                i++
                continue
            }

            // Alternation: |
            if (text[i] === '|') {
                results.push({ from: i, to: i + 1, type: 'alternation' })
                i++
                continue
            }

            // Dot (any char)
            if (text[i] === '.') {
                results.push({ from: i, to: i + 1, type: 'escape' })
                i++
                continue
            }

            i++
        }

        return results
    }

    // CBS autocompletion
    const cbsCompletions = [
        // Basic variables
        { label: 'char', detail: 'Character name' },
        { label: 'user', detail: 'User name' },
        { label: 'role', detail: 'Current message role' },
        { label: 'trigger_id', detail: 'Clicked element risu-id' },
        { label: 'blank', detail: 'Empty string' },
        { label: 'br', detail: 'Line break (\\n)' },

        // Character data
        { label: 'personality', detail: 'Character personality' },
        { label: 'description', detail: 'Character description' },
        { label: 'scenario', detail: 'Character scenario' },
        { label: 'exampledialogue', detail: 'Example dialogue' },
        { label: 'emotionlist', detail: 'Emotion image names (JSON)' },
        { label: 'assetlist', detail: 'Asset names (JSON)' },

        // Prompt & System
        { label: 'persona', detail: 'User persona prompt' },
        { label: 'mainprompt', detail: 'Main system prompt' },
        { label: 'jb', detail: 'Jailbreak prompt' },
        { label: 'globalnote', detail: 'Global note / UJB' },
        { label: 'lorebook', detail: 'Active lorebook entries (JSON)' },
        { label: 'model', detail: 'Current AI model ID' },
        { label: 'maxcontext', detail: 'Max context length' },
        { label: 'jbtoggled', detail: 'JB enabled (1/0)' },
        { label: 'prefillsupported', detail: 'Model supports prefill (1/0)' },

        // Chat history
        { label: 'previouscharchat', detail: 'Last char message' },
        { label: 'previoususerchat', detail: 'Last user message' },
        { label: 'lastmessage', detail: 'Last message content' },
        { label: 'lastmessageid', detail: 'Last message index' },
        { label: 'chatindex', detail: 'Current message index' },
        { label: 'firstmsgindex', detail: 'First message index' },
        { label: 'isfirstmsg', detail: 'Is first message (1/0)' },
        { label: 'history', detail: 'Chat history (JSON)' },
        { label: 'userhistory', detail: 'User messages (JSON)' },
        { label: 'charhistory', detail: 'Char messages (JSON)' },
        { label: 'previouschatlog::', detail: 'Message at index' },

        // Time & Date
        { label: 'time', detail: 'Current time (H:M:S)' },
        { label: 'date', detail: 'Current date (YYYY-M-D)' },
        { label: 'isotime', detail: 'UTC time (HH:MM:SS)' },
        { label: 'isodate', detail: 'UTC date (YYYY-MM-DD)' },
        { label: 'unixtime', detail: 'Unix timestamp (seconds)' },
        { label: 'messagetime', detail: 'Message sent time' },
        { label: 'messagedate', detail: 'Message sent date' },
        { label: 'idleduration', detail: 'Time since last message' },
        { label: 'messageidleduration', detail: 'Time between user messages' },

        // Variables
        { label: 'getvar::', detail: 'Get chat variable' },
        { label: 'setvar::', detail: 'Set chat variable' },
        { label: 'addvar::', detail: 'Add to variable' },
        { label: 'setdefaultvar::', detail: 'Set if not exists' },
        { label: 'getglobalvar::', detail: 'Get global variable' },
        { label: 'tempvar::', detail: 'Get temp variable' },
        { label: 'settempvar::', detail: 'Set temp variable' },
        { label: 'return::', detail: 'Return value and exit' },
        { label: 'calc::', detail: 'Calculate expression' },

        // Comparison operators
        { label: 'equal::', detail: 'A equals B (1/0)' },
        { label: 'notequal::', detail: 'A not equals B (1/0)' },
        { label: 'greater::', detail: 'A > B (1/0)' },
        { label: 'less::', detail: 'A < B (1/0)' },
        { label: 'greaterequal::', detail: 'A >= B (1/0)' },
        { label: 'lessequal::', detail: 'A <= B (1/0)' },

        // Logical operators
        { label: 'and::', detail: 'Logical AND' },
        { label: 'or::', detail: 'Logical OR' },
        { label: 'not::', detail: 'Logical NOT' },
        { label: 'all::', detail: 'All values are 1' },
        { label: 'any::', detail: 'Any value is 1' },

        // String manipulation
        { label: 'startswith::', detail: 'String starts with' },
        { label: 'endswith::', detail: 'String ends with' },
        { label: 'contains::', detail: 'String contains' },
        { label: 'replace::', detail: 'Replace all occurrences' },
        { label: 'split::', detail: 'Split string to array' },
        { label: 'join::', detail: 'Join array to string' },
        { label: 'spread::', detail: 'Join with ::' },
        { label: 'trim::', detail: 'Remove whitespace' },
        { label: 'length::', detail: 'String length' },
        { label: 'lower::', detail: 'To lowercase' },
        { label: 'upper::', detail: 'To uppercase' },
        { label: 'capitalize::', detail: 'Capitalize first char' },
        { label: 'reverse::', detail: 'Reverse string' },
        { label: 'tonumber::', detail: 'Extract numbers only' },

        // Array & Object
        { label: 'makearray::', detail: 'Create JSON array' },
        { label: 'makedict::', detail: 'Create JSON object' },
        { label: 'arraylength::', detail: 'Array length' },
        { label: 'arrayelement::', detail: 'Get array element' },
        { label: 'dictelement::', detail: 'Get object value' },
        { label: 'element::', detail: 'Get nested element' },
        { label: 'arrayshift::', detail: 'Remove first element' },
        { label: 'arraypop::', detail: 'Remove last element' },
        { label: 'arraypush::', detail: 'Add element to end' },
        { label: 'arraysplice::', detail: 'Splice array' },
        { label: 'filter::', detail: 'Filter array' },
        { label: 'range::', detail: 'Create number range' },

        // Math functions
        { label: 'round::', detail: 'Round to integer' },
        { label: 'floor::', detail: 'Round down' },
        { label: 'ceil::', detail: 'Round up' },
        { label: 'abs::', detail: 'Absolute value' },
        { label: 'remaind::', detail: 'Modulo operation' },
        { label: 'pow::', detail: 'Power (base^exp)' },
        { label: 'min::', detail: 'Minimum value' },
        { label: 'max::', detail: 'Maximum value' },
        { label: 'sum::', detail: 'Sum of values' },
        { label: 'average::', detail: 'Average of values' },
        { label: 'fixnum::', detail: 'Fix decimal places' },
        { label: '? ', detail: 'Math expression' },

        // Random & Hash
        { label: 'random', detail: 'Random 0-1 or pick' },
        { label: 'random::', detail: 'Random from list' },
        { label: 'pick::', detail: 'Consistent random pick' },
        { label: 'randint::', detail: 'Random integer' },
        { label: 'dice::', detail: 'Roll dice (XdY)' },
        { label: 'roll::', detail: 'Roll dice (default 1d6)' },
        { label: 'rollp::', detail: 'Consistent dice roll' },
        { label: 'hash::', detail: 'Deterministic hash' },

        // Encoding & Crypto
        { label: 'xor::', detail: 'XOR encrypt (base64)' },
        { label: 'xordecrypt::', detail: 'XOR decrypt' },
        { label: 'crypt::', detail: 'Caesar cipher' },
        { label: 'unicodeencode::', detail: 'Char to codepoint' },
        { label: 'unicodedecode::', detail: 'Codepoint to char' },
        { label: 'u::', detail: 'Hex to unicode char' },
        { label: 'fromhex::', detail: 'Hex to decimal' },
        { label: 'tohex::', detail: 'Decimal to hex' },

        // Asset display
        { label: 'asset::', detail: 'Display asset' },
        { label: 'emotion::', detail: 'Display emotion image' },
        { label: 'audio::', detail: 'Display audio player' },
        { label: 'bg::', detail: 'Display background' },
        { label: 'bgm::', detail: 'Background music control' },
        { label: 'video::', detail: 'Display video' },
        { label: 'video-img::', detail: 'Video as image' },
        { label: 'image::', detail: 'Display image' },
        { label: 'img::', detail: 'Unstyled image' },
        { label: 'path::', detail: 'Asset path data' },
        { label: 'inlay::', detail: 'Unstyled inlay' },
        { label: 'inlayed::', detail: 'Styled inlay' },
        { label: 'source::', detail: 'Profile source URL' },

        // Control flow
        { label: '#when::', detail: 'Conditional block' },
        { label: '#when ', detail: 'Conditional (space syntax)' },
        { label: '/when', detail: 'End conditional' },
        { label: ':else', detail: 'Else clause' },
        { label: '#each ', detail: 'Loop over array' },
        { label: '/each', detail: 'End loop' },
        { label: 'slot::', detail: 'Access loop variable' },
        { label: 'slot', detail: 'Current loop item' },

        // Utility
        { label: 'button::', detail: 'Create button' },
        { label: 'risu', detail: 'RisuAI logo' },
        { label: 'risu::', detail: 'RisuAI logo (sized)' },
        { label: 'screenwidth', detail: 'Screen width (px)' },
        { label: 'screenheight', detail: 'Screen height (px)' },
        { label: 'moduleenabled::', detail: 'Module enabled (1/0)' },
        { label: 'hiddenkey::', detail: 'Hidden lore key' },
        { label: 'comment::', detail: 'Visible comment' },
        { label: '//', detail: 'Hidden comment' },
        { label: 'tex::', detail: 'LaTeX math' },
        { label: 'ruby::', detail: 'Ruby text (furigana)' },
        { label: 'codeblock::', detail: 'Code block' },
        { label: 'bkspc', detail: 'Remove last word' },
        { label: 'erase', detail: 'Remove last sentence' },
        { label: 'position::', detail: 'Define position' },
        { label: 'iserror::', detail: 'Check if error' },
        { label: '#puredisplay', detail: 'Raw display start' },
        { label: '/puredisplay', detail: 'Raw display end' },

        // Escape characters
        { label: 'cbr', detail: 'Escaped newline (\\\\n)' },
        { label: 'bo', detail: 'Escaped {{' },
        { label: 'bc', detail: 'Escaped }}' },
        { label: 'decbo', detail: 'Escaped {' },
        { label: 'decbc', detail: 'Escaped }' },
        { label: '(', detail: 'Escaped (' },
        { label: ')', detail: 'Escaped )' },
        { label: '<', detail: 'Escaped <' },
        { label: '>', detail: 'Escaped >' },
        { label: ':', detail: 'Escaped :' },
        { label: ';', detail: 'Escaped ;' },

        // Metadata
        { label: 'metadata::', detail: 'Get system metadata' },
    ]

    function cbsCompletionSource(context: CompletionContext): CompletionResult | null {
        // Find {{ before cursor
        const line = context.state.doc.lineAt(context.pos)
        const textBefore = line.text.slice(0, context.pos - line.from)

        // Check for {{ pattern
        const match = textBefore.match(/\{\{([a-zA-Z_#\/]*)$/)
        if (!match) return null

        const from = context.pos - match[1].length
        const typed = match[1].toLowerCase()

        return {
            from,
            options: cbsCompletions
                .filter(c => c.label.toLowerCase().startsWith(typed))
                .map(c => ({
                    label: c.label,
                    detail: c.detail,
                    type: c.label.startsWith('#') || c.label.startsWith('/') ? 'keyword' : 'variable'
                }))
        }
    }

    // CBS ViewPlugin
    const cbsHighlighter = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view)
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view)
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>()
                const text = view.state.doc.toString()

                // Collect all decorations
                type DecoItem = { from: number; to: number; deco: Decoration; priority: number }
                const decos: DecoItem[] = []

                // CBS decorations (highest priority)
                const cbsParsed = parseCBS(text)
                for (const item of cbsParsed) {
                    const level = item.level % cbsColors.length
                    if (item.type === 'bracket') {
                        decos.push({ from: item.from, to: item.to, deco: cbsBracketDecos[level], priority: 2 })
                    } else {
                        decos.push({ from: item.from, to: item.to, deco: cbsContentDecos[level], priority: 2 })
                    }
                }

                // XML tag decorations (with nesting levels)
                const xmlParsed = parseXmlTags(text)
                for (const item of xmlParsed) {
                    const level = item.level % cbsColors.length
                    decos.push({ from: item.from, to: item.to, deco: xmlTagDecos[level], priority: 1.5 })
                }

                // CSS decorations (inside <style> tags)
                const cssParsed = findStyleTagContents(text)
                for (const item of cssParsed) {
                    let deco: Decoration
                    switch (item.type) {
                        case 'selector': deco = cssSelectorDeco; break
                        case 'property': deco = cssPropertyDeco; break
                        case 'value': deco = cssValueDeco; break
                        case 'bracket': deco = cssBracketDeco; break
                        case 'comment': deco = cssCommentDeco; break
                    }
                    decos.push({ from: item.from, to: item.to, deco, priority: 1.7 })
                }

                // Markdown decorations (lower priority than CBS, XML, and CSS)
                const mdParsed = parseMarkdown(text)
                for (const item of mdParsed) {
                    let deco: Decoration
                    switch (item.type) {
                        case 'h1': deco = mdHeading1Deco; break
                        case 'h2': deco = mdHeading2Deco; break
                        case 'h3': deco = mdHeading3Deco; break
                        case 'heading': deco = mdHeadingDeco; break
                        case 'bold': deco = mdBoldDeco; break
                        case 'italic': deco = mdItalicDeco; break
                        case 'bolditalic': deco = mdBoldItalicDeco; break
                        case 'strike': deco = mdStrikeDeco; break
                        case 'code': deco = mdCodeDeco; break
                    }
                    decos.push({ from: item.from, to: item.to, deco, priority: 1 })
                }

                // Sort by position (required by RangeSetBuilder)
                decos.sort((a, b) => a.from - b.from || b.priority - a.priority)

                for (const item of decos) {
                    builder.add(item.from, item.to, item.deco)
                }

                return builder.finish()
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )

    // Regex ViewPlugin
    const regexHighlighter = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view)
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view)
                }
            }

            buildDecorations(view: EditorView): DecorationSet {
                const builder = new RangeSetBuilder<Decoration>()
                const text = view.state.doc.toString()

                const regexParsed = parseRegex(text)
                const decos: { from: number; to: number; deco: Decoration }[] = []

                for (const item of regexParsed) {
                    let deco: Decoration
                    switch (item.type) {
                        case 'group': deco = regexGroupDeco; break
                        case 'charclass': deco = regexCharClassDeco; break
                        case 'quantifier': deco = regexQuantifierDeco; break
                        case 'anchor': deco = regexAnchorDeco; break
                        case 'escape': deco = regexEscapeDeco; break
                        case 'alternation': deco = regexAlternationDeco; break
                    }
                    decos.push({ from: item.from, to: item.to, deco })
                }

                decos.sort((a, b) => a.from - b.from)

                for (const item of decos) {
                    builder.add(item.from, item.to, item.deco)
                }

                return builder.finish()
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    )

    // Theme
    const customTheme = EditorView.theme({
        '&': {
            backgroundColor: 'var(--risu-darkbg)',
            color: 'var(--risu-textcolor)',
            fontSize: '14px',
            borderRadius: '0.375rem',
            height: '100%',
        },
        '&.cm-focused': {
            outline: 'none',
        },
        '.cm-scroller': {
            overflow: 'auto',
            height: '100%',
        },
        '.cm-content': {
            caretColor: 'var(--risu-textcolor)',
            fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
            padding: '8px',
        },
        '.cm-cursor': {
            borderLeftColor: 'var(--risu-textcolor)',
        },
        '.cm-selectionBackground, ::selection': {
            backgroundColor: 'rgba(255, 255, 255, 0.2) !important',
        },
        '.cm-gutters': {
            display: 'none',
        },
        '.cm-activeLine': {
            backgroundColor: 'transparent',
        },
        '.cm-placeholder': {
            color: 'var(--risu-textcolor2) !important',
            opacity: '0.6',
            fontStyle: 'italic',
        },
        // Autocomplete dropdown styles
        '.cm-tooltip': {
            backgroundColor: '#1e1e2e !important',
            border: '1px solid #45475a !important',
            borderRadius: '0.375rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
        },
        '.cm-tooltip-autocomplete': {
            '& > ul': {
                fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
                fontSize: '13px',
            },
            '& > ul > li': {
                padding: '4px 8px',
                color: 'var(--risu-textcolor)',
            },
            '& > ul > li[aria-selected]': {
                backgroundColor: 'var(--risu-selected)',
                color: 'var(--risu-textcolor)',
            },
        },
        '.cm-completionLabel': {
            color: 'var(--risu-textcolor)',
        },
        '.cm-completionDetail': {
            color: 'var(--risu-textcolor2)',
            marginLeft: '8px',
            fontStyle: 'italic',
        },
        '.cm-completionIcon': {
            opacity: 0.7,
        },
        // CBS styles
        '.cm-cbs-bracket-0': { color: '#8be9fd', fontWeight: 'bold' },
        '.cm-cbs-bracket-1': { color: '#50fa7b', fontWeight: 'bold' },
        '.cm-cbs-bracket-2': { color: '#ffb86c', fontWeight: 'bold' },
        '.cm-cbs-bracket-3': { color: '#ff79c6', fontWeight: 'bold' },
        '.cm-cbs-bracket-4': { color: '#bd93f9', fontWeight: 'bold' },
        '.cm-cbs-content-0': { color: '#8be9fd' },
        '.cm-cbs-content-1': { color: '#50fa7b' },
        '.cm-cbs-content-2': { color: '#ffb86c' },
        '.cm-cbs-content-3': { color: '#ff79c6' },
        '.cm-cbs-content-4': { color: '#bd93f9' },
        // Markdown styles (regex-based)
        '.cm-md-h1': { color: '#ffd700', fontWeight: 'bold', fontSize: '1.4em' },
        '.cm-md-h2': { color: '#ffd700', fontWeight: 'bold', fontSize: '1.2em' },
        '.cm-md-h3': { color: '#ffd700', fontWeight: 'bold', fontSize: '1.1em' },
        '.cm-md-heading': { color: '#ffd700', fontWeight: 'bold' }, // h4-h6
        '.cm-md-bold': { color: '#ffb86c', fontWeight: 'bold' },
        '.cm-md-italic': { color: '#f1fa8c', fontStyle: 'italic' },
        '.cm-md-bold-italic': { color: '#ffb86c', fontWeight: 'bold', fontStyle: 'italic' },
        '.cm-md-strike': { color: '#6272a4', textDecoration: 'line-through' },
        '.cm-md-code': { color: '#50fa7b', backgroundColor: 'rgba(80, 250, 123, 0.1)' },
        // XML tag styles (nesting level colors, same as CBS)
        '.cm-xml-tag-0': { color: '#8be9fd' },
        '.cm-xml-tag-1': { color: '#50fa7b' },
        '.cm-xml-tag-2': { color: '#ffb86c' },
        '.cm-xml-tag-3': { color: '#ff79c6' },
        '.cm-xml-tag-4': { color: '#bd93f9' },
        // CSS styles (inside <style> tags)
        '.cm-css-selector': { color: '#50fa7b' },
        '.cm-css-property': { color: '#8be9fd' },
        '.cm-css-value': { color: '#f1fa8c' },
        '.cm-css-bracket': { color: '#ff79c6', fontWeight: 'bold' },
        '.cm-css-comment': { color: '#6272a4', fontStyle: 'italic' },
        // Regex styles
        '.cm-regex-group': { color: '#ff79c6', fontWeight: 'bold' },
        '.cm-regex-charclass': { color: '#8be9fd' },
        '.cm-regex-quantifier': { color: '#ffb86c', fontWeight: 'bold' },
        '.cm-regex-anchor': { color: '#ff5555', fontWeight: 'bold' },
        '.cm-regex-escape': { color: '#50fa7b' },
        '.cm-regex-alternation': { color: '#f1fa8c', fontWeight: 'bold' },
    })

    // Value change listener
    const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            isInternalUpdate = true
            value = update.state.doc.toString()
            onchange?.(value)
            isInternalUpdate = false
        }
    })

    const createEditor = () => {
        if (!editorEl) return

        if (view) {
            view.destroy()
        }

        const extensions = [
            minimalSetup,
            customTheme,
            EditorView.lineWrapping,
            updateListener,
            placeholder ? cmPlaceholder(placeholder) : [],
        ]

        // Add language-specific extensions
        if (lang === 'regex') {
            extensions.push(regexHighlighter)
        } else if (lang !== 'plain') {
            // CBS highlighting for markdown, html, cbs modes
            extensions.push(
                autocompletion({
                    override: [cbsCompletionSource],
                    activateOnTyping: true,
                }),
                cbsHighlighter
            )
        }

        view = new EditorView({
            state: EditorState.create({
                doc: value ?? '',
                extensions,
            }),
            parent: editorEl,
        })
    }

    // Update editor when value changes externally
    $effect(() => {
        // Track value explicitly
        const newValue = value ?? ''

        if (view && !isInternalUpdate) {
            const currentValue = view.state.doc.toString()
            if (newValue !== currentValue) {
                view.dispatch({
                    changes: { from: 0, to: currentValue.length, insert: newValue }
                })
            }
        }
    })

    onMount(() => {
        createEditor()
    })

    onDestroy(() => {
        if (view) {
            view.destroy()
        }
    })
</script>

<div
    bind:this={editorEl}
    class="w-full border border-selected rounded-md overflow-hidden {className}"
    class:h-20={!hasCustomHeight && (height === '20' || (height === 'default' && $textAreaSize === -5))}
    class:h-24={!hasCustomHeight && (height === '24' || (height === 'default' && $textAreaSize === -4))}
    class:h-28={!hasCustomHeight && (height === '28' || (height === 'default' && $textAreaSize === -3))}
    class:h-32={!hasCustomHeight && (height === '32' || (height === 'default' && $textAreaSize === -2))}
    class:h-36={!hasCustomHeight && (height === '36' || (height === 'default' && $textAreaSize === -1))}
    class:h-40={!hasCustomHeight && (height === '40' || (height === 'default' && $textAreaSize === 0))}
    class:h-44={!hasCustomHeight && height === 'default' && $textAreaSize === 1}
    class:h-48={!hasCustomHeight && height === 'default' && $textAreaSize === 2}
    class:h-52={!hasCustomHeight && height === 'default' && $textAreaSize === 3}
    class:h-56={!hasCustomHeight && height === 'default' && $textAreaSize === 4}
    class:h-60={!hasCustomHeight && height === 'default' && $textAreaSize === 5}
    class:h-full={!hasCustomHeight && height === 'full'}
    class:min-h-20={!hasCustomHeight && (height === '20' || (height === 'default' && $textAreaSize === -5))}
    class:min-h-24={!hasCustomHeight && (height === '24' || (height === 'default' && $textAreaSize === -4))}
    class:min-h-28={!hasCustomHeight && (height === '28' || (height === 'default' && $textAreaSize === -3))}
    class:min-h-32={!hasCustomHeight && (height === '32' || (height === 'default' && $textAreaSize === -2))}
    class:min-h-36={!hasCustomHeight && (height === '36' || (height === 'default' && $textAreaSize === -1))}
    class:min-h-40={!hasCustomHeight && (height === '40' || (height === 'default' && $textAreaSize === 0))}
    class:min-h-48={!hasCustomHeight && height === 'default' && $textAreaSize === 1}
    class:min-h-56={!hasCustomHeight && height === 'default' && $textAreaSize === 2}
    class:min-h-64={!hasCustomHeight && height === 'default' && $textAreaSize === 3}
    class:min-h-72={!hasCustomHeight && height === 'default' && $textAreaSize === 4}
    class:min-h-80={!hasCustomHeight && height === 'default' && $textAreaSize === 5}
></div>
