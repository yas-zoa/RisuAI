/**
 * Shared CBS (Curly Brace Syntax) + markup highlighting for CodeMirror 6.
 *
 * Design principle
 *   A SINGLE ViewPlugin (`cbsHighlighter`) runs all parsers in one pass and
 *   produces one DecorationSet.  Earlier versions split CBS / markup / regex
 *   into three separate ViewPlugin classes, each with its own parse cache,
 *   viewport-coverage check, and binary-search token lookup.  The per-plugin
 *   optimisations added constant-factor overhead (multiple ViewPlugin
 *   instances per EditorView, separate DecorationSet provides, redundant
 *   transaction traversals) that exceeded the savings on the common 2-20 KB
 *   document sizes used in this app.  Reverting to a single plugin with a
 *   straightforward "rebuild on docChanged or viewportChanged" update —
 *   closer to the pre-refactor design — measurably improves mobile
 *   momentum-scroll smoothness.  The only retained cache is `docString()`,
 *   which is cheap and avoids duplicating `Text.toString()` within a single
 *   transaction.
 *
 * Provides:
 *   - parseCBS         — depth-tracking {{ }} bracket parser (O(n))
 *   - parseCBSKeywords — 3-tier keyword classifier (control / macro / variable)
 *   - cbsHighlighter   — combined CBS + XML + CSS + Markdown ViewPlugin
 *   - cbsTheme         — EditorView.theme: Catppuccin Mocha gutter + colours
 *
 * Design constraints
 *   - PR #72 nesting-level colours (level 0–4) MUST NOT be changed.
 *   - Keyword highlights MUST be scoped to {{ }} interior only.
 *   - Keyword theme rules are placed AFTER content rules so same-specificity
 *     CSS cascade gives keywords priority over the level colour on the same
 *     span.
 */

import {
    EditorView,
    ViewPlugin,
    Decoration,
    type DecorationSet,
    type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder, type Text } from '@codemirror/state'

// ── Per-update doc.toString() cache ───────────────────────────────────────────
// CM6 creates a new Text object per transaction, so reference equality is a
// sound cache key.  Shared across any plugin/effect that may call
// `docString(doc)` within one update cycle; ensures we flatten the rope at
// most once per transaction.
let _cachedDocRef: Text | null = null
let _cachedDocStr = ''

export function docString(doc: Text): string {
    if (doc === _cachedDocRef) return _cachedDocStr
    _cachedDocStr = doc.toString()
    _cachedDocRef = doc
    return _cachedDocStr
}

// ── CBS nesting-level colours (PR #72 — DO NOT CHANGE) ───────────────────────
export const cbsColors: string[] = [
    '#8be9fd', // level 0 – cyan
    '#50fa7b', // level 1 – green
    '#ffb86c', // level 2 – orange
    '#ff79c6', // level 3 – pink
    '#bd93f9', // level 4 – purple
]

// ── Decoration singletons ─────────────────────────────────────────────────────
export const cbsBracketDecos = cbsColors.map((_, i) =>
    Decoration.mark({ class: `cm-cbs-bracket-${i}` })
)
export const cbsContentDecos = cbsColors.map((_, i) =>
    Decoration.mark({ class: `cm-cbs-content-${i}` })
)

// Keyword decorations — applied INSIDE content ranges; cascade order in
// cbsTheme ensures these win over the level colour for the keyword text.
export const cbsKwControlDeco = Decoration.mark({ class: 'cm-cbs-kw-control' })
export const cbsKwMacroDeco   = Decoration.mark({ class: 'cm-cbs-kw-macro' })

// Markdown decoration singletons
const _mdH1Deco         = Decoration.mark({ class: 'cm-md-h1' })
const _mdH2Deco         = Decoration.mark({ class: 'cm-md-h2' })
const _mdH3Deco         = Decoration.mark({ class: 'cm-md-h3' })
const _mdHeadingDeco    = Decoration.mark({ class: 'cm-md-heading' })
const _mdBoldDeco       = Decoration.mark({ class: 'cm-md-bold' })
const _mdItalicDeco     = Decoration.mark({ class: 'cm-md-italic' })
const _mdBoldItalicDeco = Decoration.mark({ class: 'cm-md-bold-italic' })
const _mdStrikeDeco     = Decoration.mark({ class: 'cm-md-strike' })
const _mdCodeDeco       = Decoration.mark({ class: 'cm-md-code' })

// XML tag level decorations (same palette as CBS)
const _xmlTagDecos = cbsColors.map((_, i) => Decoration.mark({ class: `cm-xml-tag-${i}` }))

// CSS decoration singletons
const _cssSelectorDeco = Decoration.mark({ class: 'cm-css-selector' })
const _cssPropertyDeco = Decoration.mark({ class: 'cm-css-property' })
const _cssValueDeco    = Decoration.mark({ class: 'cm-css-value' })
const _cssBracketDeco  = Decoration.mark({ class: 'cm-css-bracket' })
const _cssCommentDeco  = Decoration.mark({ class: 'cm-css-comment' })

// ── Parsers ───────────────────────────────────────────────────────────────────
export interface CbsToken {
    from: number
    to: number
    type: 'bracket' | 'content'
    level: number
}

/**
 * Walk the document once, tracking {{ }} nesting depth.
 * Returns bracket positions and content spans at the correct depth level.
 */
export function parseCBS(text: string): CbsToken[] {
    const results: CbsToken[] = []
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

export interface CbsKeywordToken {
    from: number
    to: number
    type: 'control' | 'macro'
}

/**
 * 3-tier CBS keyword classifier (operates only on content tokens — never outside {{ }}).
 *
 * Classification rules (applied to the trimmed content string):
 *   1. Starts with #, / or :  → control  (e.g. #if, /each, :else, //)
 *   2. Starts with "? "       → control  (inline math expression shorthand)
 *   3. Contains ::            → macro    (e.g. settempvar::, getvar::)
 *   4. Otherwise              → variable (no extra highlight; level colour remains)
 */
export function parseCBSKeywords(cbsResults: CbsToken[], text: string): CbsKeywordToken[] {
    const results: CbsKeywordToken[] = []

    for (const item of cbsResults) {
        if (item.type !== 'content') continue

        const content = text.slice(item.from, item.to)
        const trimOffset = content.search(/\S/)
        if (trimOffset === -1) continue

        const kw     = content.slice(trimOffset)
        const kwFrom = item.from + trimOffset

        if (kw.startsWith('#') || kw.startsWith('/') || kw.startsWith(':')) {
            const end   = kw.search(/\s/)
            const kwLen = end === -1 ? kw.length : end
            if (kwLen > 0) results.push({ from: kwFrom, to: kwFrom + kwLen, type: 'control' })
        } else if (kw.startsWith('? ')) {
            results.push({ from: kwFrom, to: kwFrom + 1, type: 'control' })
        } else {
            const colonIdx = kw.indexOf('::')
            if (colonIdx > 0) {
                results.push({ from: kwFrom, to: kwFrom + colonIdx, type: 'macro' })
            }
        }
    }

    return results
}

// ── Markup parsers (XML / CSS-in-<style> / Markdown) ─────────────────────────
type XmlTagMatch = { from: number; to: number; level: number }
type CssMatch = {
    from: number
    to: number
    type: 'selector' | 'property' | 'value' | 'bracket' | 'comment'
}
type MarkdownMatch = {
    from: number
    to: number
    type: 'h1' | 'h2' | 'h3' | 'heading' | 'bold' | 'italic' | 'bolditalic' | 'strike' | 'code'
}

function parseXmlTags(text: string): XmlTagMatch[] {
    const results: XmlTagMatch[] = []
    const tagStack: string[] = []
    const tagRegex = /<(\/?)\s*([a-zA-Z_][\w\-]*)[^>]*?(\/?)>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(text)) !== null) {
        const isClosing   = match[1] === '/'
        const tagName     = match[2].toLowerCase()
        const isSelfClose = match[3] === '/'

        if (isSelfClose) {
            results.push({ from: match.index, to: match.index + match[0].length, level: tagStack.length })
        } else if (isClosing) {
            const lastIdx = tagStack.lastIndexOf(tagName)
            if (lastIdx !== -1) tagStack.splice(lastIdx, 1)
            results.push({ from: match.index, to: match.index + match[0].length, level: tagStack.length })
        } else {
            results.push({ from: match.index, to: match.index + match[0].length, level: tagStack.length })
            tagStack.push(tagName)
        }
    }

    return results
}

function parseCSS(text: string, offset: number): CssMatch[] {
    const results: CssMatch[] = []
    let match: RegExpExecArray | null

    const commentRegex = /\/\*[\s\S]*?\*\//g
    while ((match = commentRegex.exec(text)) !== null) {
        results.push({ from: offset + match.index, to: offset + match.index + match[0].length, type: 'comment' })
    }

    const textNoComments = text.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

    const braceRegex = /[{}]/g
    while ((match = braceRegex.exec(textNoComments)) !== null) {
        results.push({ from: offset + match.index, to: offset + match.index + 1, type: 'bracket' })
    }

    const selectorRegex = /([^{}]+?)(\s*\{)/g
    while ((match = selectorRegex.exec(textNoComments)) !== null) {
        const selector = match[1].trim()
        if (selector.length > 0) {
            const selectorPos = textNoComments.indexOf(selector, match.index)
            if (selectorPos !== -1) {
                results.push({ from: offset + selectorPos, to: offset + selectorPos + selector.length, type: 'selector' })
            }
        }
    }

    const declRegex = /([\w-]+)(\s*:\s*)([^;{}]+)/g
    while ((match = declRegex.exec(textNoComments)) !== null) {
        const propName  = match[1]
        const colonPart = match[2]
        const propValue = match[3].trimEnd()
        const propStart = match.index
        results.push({ from: offset + propStart, to: offset + propStart + propName.length, type: 'property' })
        const valueStart = propStart + propName.length + colonPart.length
        results.push({ from: offset + valueStart, to: offset + valueStart + propValue.length, type: 'value' })
    }

    return results
}

function findStyleTagContents(text: string): CssMatch[] {
    const results: CssMatch[] = []
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
    let match: RegExpExecArray | null

    while ((match = styleRegex.exec(text)) !== null) {
        const cssContent = match[1]
        const cssStart   = match.index + match[0].indexOf(cssContent)
        results.push(...parseCSS(cssContent, cssStart))
    }

    return results
}

function parseMarkdown(text: string): MarkdownMatch[] {
    const results: MarkdownMatch[] = []
    let match: RegExpExecArray | null

    const headingRegex = /^(#{1,6})\s+.+$/gm
    while ((match = headingRegex.exec(text)) !== null) {
        const level = match[1].length
        const type: MarkdownMatch['type'] =
            level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'heading'
        results.push({ from: match.index, to: match.index + match[0].length, type })
    }

    const boldItalicRegex = /(\*\*\*)(?!\s)([^\*\n]+?)(?<!\s)\1/g
    while ((match = boldItalicRegex.exec(text)) !== null) {
        results.push({ from: match.index, to: match.index + match[0].length, type: 'bolditalic' })
    }

    const boldRegex = /(?<!\*)(\*\*)(?!\*)(?!\s)([^\*\n]+?)(?<!\s)(?<!\*)\1(?!\*)/g
    while ((match = boldRegex.exec(text)) !== null) {
        results.push({ from: match.index, to: match.index + match[0].length, type: 'bold' })
    }

    const italicRegex = /(?<!\*)(\*)(?!\*)(?!\s)([^\*\n]+?)(?<!\s)(?<!\*)\1(?!\*)/g
    while ((match = italicRegex.exec(text)) !== null) {
        results.push({ from: match.index, to: match.index + match[0].length, type: 'italic' })
    }

    const strikeRegex = /~~(?!\s)([^\n]+?)(?<!\s)~~/g
    while ((match = strikeRegex.exec(text)) !== null) {
        results.push({ from: match.index, to: match.index + match[0].length, type: 'strike' })
    }

    const codeRegex = /`([^`\n]+)`/g
    while ((match = codeRegex.exec(text)) !== null) {
        results.push({ from: match.index, to: match.index + match[0].length, type: 'code' })
    }

    return results
}

// ── Combined ViewPlugin ──────────────────────────────────────────────────────
/**
 * cbsHighlighter — single ViewPlugin that runs all parsers (CBS + CBS keywords
 * + XML + CSS-in-<style> + Markdown) in one pass per update and emits one
 * combined DecorationSet.
 *
 * Why one plugin and not four:
 *   Multiple ViewPlugin instances multiply CM6's transaction-walking cost
 *   (each plugin's `update()` runs on every ViewUpdate, each emits its own
 *   DecorationSet which CM6 then merges and hands to decorators).  A single
 *   plugin traverses once, sorts once, builds one RangeSet.  On 2-20 KB docs
 *   with mobile CPUs, the single-plugin path fits comfortably inside a 16 ms
 *   frame; the four-plugin path did not.
 *
 * Why rebuild on every viewportChanged and not just docChanged:
 *   CM6's viewport is already slightly larger than visibleRanges, so a rebuild
 *   on viewport shift decorates newly scrolled-in lines.  Per-token caching
 *   with viewport-coverage checks (the earlier approach) saves parse work but
 *   adds per-update conditional overhead that exceeds the savings for our doc
 *   sizes.  Keep it simple.
 */
export const cbsHighlighter = ViewPlugin.fromClass(
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
            const text = docString(view.state.doc)
            const builder = new RangeSetBuilder<Decoration>()

            interface DecoItem { from: number; to: number; deco: Decoration; priority: number }
            const decos: DecoItem[] = []

            // CBS bracket + content (PR #72)
            const cbsParsed = parseCBS(text)
            for (const item of cbsParsed) {
                const level = item.level % cbsColors.length
                if (item.type === 'bracket') {
                    decos.push({ from: item.from, to: item.to, deco: cbsBracketDecos[level], priority: 2 })
                } else {
                    decos.push({ from: item.from, to: item.to, deco: cbsContentDecos[level], priority: 2 })
                }
            }

            // CBS keyword highlights — priority 3 so they sort inside content spans.
            for (const kw of parseCBSKeywords(cbsParsed, text)) {
                const deco = kw.type === 'control' ? cbsKwControlDeco : cbsKwMacroDeco
                decos.push({ from: kw.from, to: kw.to, deco, priority: 3 })
            }

            // XML tag nesting
            for (const item of parseXmlTags(text)) {
                const level = item.level % cbsColors.length
                decos.push({ from: item.from, to: item.to, deco: _xmlTagDecos[level], priority: 1.5 })
            }

            // CSS inside <style>
            for (const item of findStyleTagContents(text)) {
                const deco =
                    item.type === 'selector' ? _cssSelectorDeco :
                    item.type === 'property' ? _cssPropertyDeco :
                    item.type === 'value'    ? _cssValueDeco    :
                    item.type === 'bracket'  ? _cssBracketDeco  :
                                               _cssCommentDeco
                decos.push({ from: item.from, to: item.to, deco, priority: 1.7 })
            }

            // Markdown
            for (const item of parseMarkdown(text)) {
                const deco =
                    item.type === 'h1'         ? _mdH1Deco         :
                    item.type === 'h2'         ? _mdH2Deco         :
                    item.type === 'h3'         ? _mdH3Deco         :
                    item.type === 'heading'    ? _mdHeadingDeco    :
                    item.type === 'bold'       ? _mdBoldDeco       :
                    item.type === 'italic'     ? _mdItalicDeco     :
                    item.type === 'bolditalic' ? _mdBoldItalicDeco :
                    item.type === 'strike'     ? _mdStrikeDeco     :
                                                 _mdCodeDeco
                decos.push({ from: item.from, to: item.to, deco, priority: 1 })
            }

            // RangeSetBuilder requires non-decreasing `from`; for same `from`,
            // higher priority (inner span) goes first so its CSS class wins.
            decos.sort((a, b) => a.from - b.from || b.priority - a.priority)
            for (const item of decos) {
                builder.add(item.from, item.to, item.deco)
            }

            return builder.finish()
        }
    },
    { decorations: v => v.decorations }
)

// ── Shared theme (colours) ─────────────────────────────────────────────────
/**
 * CBS + markup colour rules.  Safe for any editor host: contains no
 * Catppuccin-specific gutter styling, so inline editors using RisuAI's own
 * `--risu-*` CSS variable palette can apply this without conflicting with the
 * app-level theme.
 *
 * IMPORTANT: keyword rules (.cm-cbs-kw-*) are placed AFTER the content rules
 * (.cm-cbs-content-*).  Both selectors have equal specificity (single class),
 * so the later rule wins for text that carries both classes, giving keyword
 * colours priority over level colours.
 */
export const cbsTheme = EditorView.theme({
    // ── CBS bracket colours (PR #72 — DO NOT CHANGE) ─────────────────────
    '.cm-cbs-bracket-0': { color: '#8be9fd', fontWeight: 'bold' },
    '.cm-cbs-bracket-1': { color: '#50fa7b', fontWeight: 'bold' },
    '.cm-cbs-bracket-2': { color: '#ffb86c', fontWeight: 'bold' },
    '.cm-cbs-bracket-3': { color: '#ff79c6', fontWeight: 'bold' },
    '.cm-cbs-bracket-4': { color: '#bd93f9', fontWeight: 'bold' },

    // ── CBS content colours (PR #72 — DO NOT CHANGE) ─────────────────────
    '.cm-cbs-content-0': { color: '#8be9fd' },
    '.cm-cbs-content-1': { color: '#50fa7b' },
    '.cm-cbs-content-2': { color: '#ffb86c' },
    '.cm-cbs-content-3': { color: '#ff79c6' },
    '.cm-cbs-content-4': { color: '#bd93f9' },

    // ── CBS keyword overrides (MUST stay after content rules — cascade order)
    '.cm-cbs-kw-control': { color: '#f38ba8', fontWeight: 'bold' },
    '.cm-cbs-kw-macro':   { color: '#89b4fa' },

    // ── Markdown (regex-based) ──────────────────────────────────────────
    '.cm-md-h1':          { color: '#ffd700', fontWeight: 'bold', fontSize: '1.4em' },
    '.cm-md-h2':          { color: '#ffd700', fontWeight: 'bold', fontSize: '1.2em' },
    '.cm-md-h3':          { color: '#ffd700', fontWeight: 'bold', fontSize: '1.1em' },
    '.cm-md-heading':     { color: '#ffd700', fontWeight: 'bold' },
    '.cm-md-bold':        { color: '#ffb86c', fontWeight: 'bold' },
    '.cm-md-italic':      { color: '#f1fa8c', fontStyle: 'italic' },
    '.cm-md-bold-italic': { color: '#ffb86c', fontWeight: 'bold', fontStyle: 'italic' },
    '.cm-md-strike':      { color: '#6272a4', textDecoration: 'line-through' },
    '.cm-md-code':        { color: '#50fa7b', backgroundColor: 'rgba(80, 250, 123, 0.1)' },

    // ── XML tag styles (nesting level colours, same palette as CBS) ───────
    '.cm-xml-tag-0': { color: '#8be9fd' },
    '.cm-xml-tag-1': { color: '#50fa7b' },
    '.cm-xml-tag-2': { color: '#ffb86c' },
    '.cm-xml-tag-3': { color: '#ff79c6' },
    '.cm-xml-tag-4': { color: '#bd93f9' },

    // ── CSS styles (inside <style> tags) ──────────────────────────────────
    '.cm-css-selector': { color: '#50fa7b' },
    '.cm-css-property': { color: '#8be9fd' },
    '.cm-css-value':    { color: '#f1fa8c' },
    '.cm-css-bracket':  { color: '#ff79c6', fontWeight: 'bold' },
    '.cm-css-comment':  { color: '#6272a4', fontStyle: 'italic' },
})

// ── Catppuccin Mocha gutter theme (opt-in) ──────────────────────────────
/**
 * Gutter-only Catppuccin Mocha palette.  Applied in editors that *do* show a
 * gutter and want the Mocha look — primarily the canvas popup (long-form
 * editor, visually distinct from the main app chrome).
 *
 * Inline editors (e.g. CodeMirrorEditor embedded in settings / sidebars)
 * follow RisuAI's app-wide theme via the `--risu-*` CSS variables and should
 * NOT import this; their gutter (when a rare `lang='cbs'` mode turns
 * `lineNumbers()` on) inherits the browser default or the host component's
 * `customTheme`.
 */
export const catppuccinGutterTheme = EditorView.theme({
    '.cm-gutters': {
        backgroundColor: '#1e1e2e', // Mocha Base
        borderRight: 'none',
        color: '#a6adc8',           // Subtext0
    },
    '.cm-lineNumbers .cm-gutterElement': {
        color: '#a6adc8',
        padding: '0 8px 0 4px',
        fontSize: '12px',
        minWidth: '2.5ch',
    },
    '.cm-activeLineGutter': {
        backgroundColor: '#313244', // Surface0
        color: '#cdd6f4',           // Mocha Text
    },
})
