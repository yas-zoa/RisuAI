<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { highlightSpecialChars, drawSelection, EditorView, ViewPlugin, Decoration, type DecorationSet, type ViewUpdate, keymap, placeholder as cmPlaceholder, lineNumbers } from '@codemirror/view'
    import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
    import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
    import { EditorState, RangeSetBuilder } from '@codemirror/state'
    import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
    import { textAreaSize } from 'src/ts/gui/guisize'
    import { shouldOpenCanvasPopupTarget } from 'src/ts/gui/canvasPopup'
    import { cbsHighlighter, cbsTheme, markupHighlighter, docString } from 'src/ts/gui/cbsHighlight'
    import CanvasEditorModal from './CanvasEditorModal.svelte'

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
        onInput?: (value: string) => void
        enableCanvasPopup?: boolean
    }

    let {
        value = $bindable(''),
        lang = 'markdown',
        placeholder = '',
        class: className = '',
        height = 'default',
        onInput,
        enableCanvasPopup = true
    }: Props = $props()

    let editorEl: HTMLDivElement
    let view: EditorView | null = null
    /**
     * Tracks the last value that was set *from inside the editor* (via
     * updateListener).  The external-value $effect compares against this to
     * decide whether an incoming `value` prop change was initiated by the
     * editor itself, without relying on a synchronous boolean flag that resets
     * before the $effect callback runs.
     *
     * Named "pending" because it holds the value only until the next $effect
     * run; it is reset to null once the $effect has confirmed the match.
     */
    let _pendingInternalValue: string | null = null
    let canvasOpen = $state(false)
    let canvasTitle = $state('텍스트 편집')

    const openCanvasEditor = (e: MouseEvent) => {
        const target = e.currentTarget as HTMLElement | null
        if (!target || !enableCanvasPopup || !shouldOpenCanvasPopupTarget(target, 60)) return
        e.preventDefault()
        e.stopPropagation()
        canvasTitle = placeholder || '텍스트 편집'
        canvasOpen = true
    }

    // Check if className contains height classes (h- or min-h-)
    const hasCustomHeight = className.includes('h-') || className.includes('min-h-')

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

    // Regex ViewPlugin — simple single-pass rebuild (see cbsHighlight.ts for
    // the rationale; same principle applies here).  No parse cache / viewport
    // coverage check / binary-search remap: on the 2-20 KB documents this
    // editor typically hosts, the cache bookkeeping cost exceeded the savings.
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
                const text = docString(view.state.doc)
                const decos: { from: number; to: number; deco: Decoration }[] = []

                for (const item of parseRegex(text)) {
                    let deco: Decoration
                    switch (item.type) {
                        case 'group':       deco = regexGroupDeco;       break
                        case 'charclass':   deco = regexCharClassDeco;   break
                        case 'quantifier':  deco = regexQuantifierDeco;  break
                        case 'anchor':      deco = regexAnchorDeco;      break
                        case 'escape':      deco = regexEscapeDeco;      break
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
        // Gutter styling is provided by cbsTheme (Catppuccin Mocha) when lineNumbers()
        // is active.  No display:none here so the gutter renders when lineNumbers() is
        // added for cbs mode.
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
        // Note: CBS bracket/content/keyword, Markdown, XML tag, and CSS-in-style
        // colour rules are provided by cbsTheme (imported from cbsHighlight.ts).
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
            // docString() caches the rope → string conversion so subsequent
            // plugin calls in the same update cycle reuse the same string.
            const text = docString(update.state.doc)
            _pendingInternalValue = text
            value = text
            onInput?.(text)
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
            // CBS + language-specific highlighting for markdown, html, cbs modes.
            // cbsTheme supplies Catppuccin Mocha gutter styles and CBS colour rules.
            // cbsHighlighter handles {{ }} nesting + keyword highlighting (incremental).
            // markupHighlighter handles XML tags, CSS-in-style, and Markdown.
            // lineNumbers() is added only for cbs mode (macro editing context).
            extensions.push(
                cbsTheme,
                cbsHighlighter,
                autocompletion({
                    override: [cbsCompletionSource],
                    activateOnTyping: true,
                }),
                markupHighlighter,
            )
            if (lang === 'cbs') {
                extensions.push(lineNumbers())
            }
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
        const newValue = value ?? ''

        // If this value was just set by the editor itself (via updateListener),
        // skip — there is no external change to apply.  Reset the sentinel so
        // that a subsequent identical value written externally is still applied.
        if (newValue === _pendingInternalValue) {
            _pendingInternalValue = null
            return
        }

        if (view) {
            const currentValue = view.state.doc.toString()
            if (newValue !== currentValue) {
                view.dispatch({
                    changes: { from: 0, to: currentValue.length, insert: newValue }
                })
            }
        }
    })

    // Recreate editor when lang or placeholder changes at runtime
    $effect(() => {
        // Access lang and placeholder so Svelte tracks them as dependencies
        const _lang = lang
        const _placeholder = placeholder
        if (view) {
            createEditor()
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
    oncontextmenu={openCanvasEditor}
    role="presentation"
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

<CanvasEditorModal
    open={canvasOpen}
    value={value ?? ''}
    title={canvasTitle}
    lang={lang}
    onClose={() => {
        canvasOpen = false
    }}
    onSave={(nextValue) => {
        value = nextValue
        onInput?.(nextValue)
    }}
/>
