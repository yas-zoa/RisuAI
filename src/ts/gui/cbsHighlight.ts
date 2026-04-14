/**
 * Shared CBS (Curly Brace Syntax) highlighting for CodeMirror 6.
 *
 * Provides:
 *   - parseCBS        — depth-tracking {{ }} bracket parser (full-doc, O(n))
 *   - parseCBSKeywords — 3-tier keyword classifier (control / macro / variable)
 *   - cbsHighlighter  — ViewPlugin with incremental update optimisation
 *   - cbsTheme        — EditorView.theme: Catppuccin Mocha gutter + CBS colours
 *
 * Design constraints
 *   - PR #72 nesting-level colours (level 0–4) MUST NOT be changed.
 *   - Keyword highlights MUST be scoped to {{ }} interior only (no false positives).
 *   - Keyword theme rules are placed AFTER content rules so same-specificity CSS
 *     cascade gives keywords priority over the level colour on the same span.
 *   - Incremental update: if a doc change contains no { or } characters the existing
 *     DecorationSet is mapped through the change (O(change_size)) instead of a full
 *     rebuild (O(doc_size)).  Bracket changes trigger a full rebuild because CBS depth
 *     is a global property of the document.
 */

import {
    EditorView,
    ViewPlugin,
    Decoration,
    type DecorationSet,
    type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

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
    // Stores the position immediately after '{{' for each open brace pair,
    // so we can emit the correct content range when the matching '}}' is found.
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
 *
 * Scope: only `content` tokens from parseCBS() are examined, so brackets and
 * plain text outside {{ }} are never touched.
 */
export function parseCBSKeywords(cbsResults: CbsToken[], text: string): CbsKeywordToken[] {
    const results: CbsKeywordToken[] = []

    for (const item of cbsResults) {
        if (item.type !== 'content') continue

        const content = text.slice(item.from, item.to)
        // Skip leading whitespace / newlines inside {{ }}
        const trimOffset = content.search(/\S/)
        if (trimOffset === -1) continue

        const kw    = content.slice(trimOffset)
        const kwFrom = item.from + trimOffset

        if (kw.startsWith('#') || kw.startsWith('/') || kw.startsWith(':')) {
            // Control flow: keyword extends to first whitespace
            const end = kw.search(/\s/)
            const kwLen = end === -1 ? kw.length : end
            if (kwLen > 0) results.push({ from: kwFrom, to: kwFrom + kwLen, type: 'control' })
        } else if (kw.startsWith('? ')) {
            // Math expression: only the '?' sigil is highlighted
            results.push({ from: kwFrom, to: kwFrom + 1, type: 'control' })
        } else {
            const colonIdx = kw.indexOf('::')
            if (colonIdx > 0) {
                // Macro function: highlight the name before ::
                results.push({ from: kwFrom, to: kwFrom + colonIdx, type: 'macro' })
            }
            // Simple variable: no extra highlight; level colour from cbsContentDecos remains
        }
    }

    return results
}

// ── ViewPlugin ────────────────────────────────────────────────────────────────
/**
 * cbsHighlighter applies CBS bracket/content nesting colours plus keyword
 * colours.  Updates are incremental: if a doc change does not modify any
 * { or } characters the existing DecorationSet is mapped through the change
 * rather than rebuilding the full set.
 */
export const cbsHighlighter = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view)
        }

        update(update: ViewUpdate) {
            if (!update.docChanged && !update.viewportChanged) return

            if (update.docChanged) {
                // Check whether any inserted or removed text contains { or }.
                // If not, the bracket structure (and therefore all CBS token
                // positions relative to each other) is unchanged.  We only need
                // to shift existing decoration positions through the change.
                let hasBracketChange = false
                update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
                    if (hasBracketChange) return
                    const removed   = update.startState.doc.sliceString(fromA, toA)
                    const inserted  = update.state.doc.sliceString(fromB, toB)
                    if (
                        removed.includes('{') || removed.includes('}') ||
                        inserted.includes('{') || inserted.includes('}')
                    ) {
                        hasBracketChange = true
                    }
                })

                this.decorations = hasBracketChange
                    ? this.buildDecorations(update.view)
                    : this.decorations.map(update.changes)
            } else {
                // viewportChanged only: rebuild so newly-visible ranges get decorated.
                this.decorations = this.buildDecorations(update.view)
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>()
            const text = view.state.doc.toString()

            interface DecoItem { from: number; to: number; deco: Decoration; priority: number }
            const decos: DecoItem[] = []

            const cbsParsed = parseCBS(text)

            // Bracket and content level colours (PR #72 — unchanged)
            for (const item of cbsParsed) {
                const level = item.level % cbsColors.length
                if (item.type === 'bracket') {
                    decos.push({ from: item.from, to: item.to, deco: cbsBracketDecos[level], priority: 2 })
                } else {
                    decos.push({ from: item.from, to: item.to, deco: cbsContentDecos[level], priority: 2 })
                }
            }

            // Keyword highlights — priority 3 ensures they sort before content decos
            // at the same `from` position (so they're the inner span in CM's span tree,
            // and their CSS colour wins over the outer content-level colour).
            const keywords = parseCBSKeywords(cbsParsed, text)
            for (const kw of keywords) {
                const deco = kw.type === 'control' ? cbsKwControlDeco : cbsKwMacroDeco
                decos.push({ from: kw.from, to: kw.to, deco, priority: 3 })
            }

            // RangeSetBuilder requires non-decreasing `from`; for same `from`,
            // higher priority (inner / smaller range) goes first.
            decos.sort((a, b) => a.from - b.from || b.priority - a.priority)

            for (const item of decos) {
                builder.add(item.from, item.to, item.deco)
            }

            return builder.finish()
        }
    },
    { decorations: v => v.decorations }
)

// ── Shared theme ──────────────────────────────────────────────────────────────
/**
 * Catppuccin Mocha gutter styling + CBS colour rules.
 *
 * Apply this as an extension alongside cbsHighlighter in both editor components.
 *
 * Palette reference (Catppuccin Mocha):
 *   Base     #1e1e2e   Surface0 #313244
 *   Text     #cdd6f4   Subtext0 #a6adc8
 *   Red      #f38ba8   Sapphire #89b4fa
 *
 * IMPORTANT: keyword rules (.cm-cbs-kw-*) are placed AFTER the content rules
 * (.cm-cbs-content-*).  Both selectors have equal specificity (single class),
 * so the later rule wins in the CSS cascade for text that carries both classes,
 * giving keyword colours priority over level colours.
 */
export const cbsTheme = EditorView.theme({
    // ── Gutter ──────────────────────────────────────────────────────────────
    '.cm-gutters': {
        backgroundColor: '#1e1e2e', // Mocha Base — same as editor background
        borderRight: 'none',        // remove the default CM gutter border
        color: '#a6adc8',           // Subtext0
    },
    '.cm-lineNumbers .cm-gutterElement': {
        color: '#a6adc8',           // Subtext0
        padding: '0 8px 0 4px',
        fontSize: '12px',
        minWidth: '2.5ch',
    },
    '.cm-activeLineGutter': {
        backgroundColor: '#313244', // Surface0 — subtle active-line accent
        color: '#cdd6f4',           // Mocha Text
    },

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
    '.cm-cbs-kw-control': { color: '#f38ba8', fontWeight: 'bold' }, // Mocha Red
    '.cm-cbs-kw-macro':   { color: '#89b4fa' },                     // Mocha Sapphire

    // ── Markdown (regex-based) ────────────────────────────────────────────
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

// ── Markup (XML / CSS-in-style / Markdown) highlighter ────────────────────
//
// Shared ViewPlugin that applies regex-based decorations for:
//   - XML tag nesting (same Catppuccin level colours as CBS)
//   - CSS inside <style> blocks
//   - Markdown headings, emphasis, code
//
// CBS {{ }} highlighting is handled by the separate cbsHighlighter; the two
// plugins coexist without conflict because they target different text ranges
// and maintain independent DecorationSets.
//
// Rebuild strategy: only on docChanged (not viewportChanged) because the full
// document is decorated on every build — no viewport cropping needed.

// Internal type aliases ─────────────────────────────────────────────────────
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

// Internal parsers ──────────────────────────────────────────────────────────
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

    // Comments: /* ... */
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

    // Headings: # at line start (1–6 levels)
    const headingRegex = /^(#{1,6})\s+.+$/gm
    while ((match = headingRegex.exec(text)) !== null) {
        const level = match[1].length
        const type: MarkdownMatch['type'] =
            level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'heading'
        results.push({ from: match.index, to: match.index + match[0].length, type })
    }

    // Bold+Italic: ***text*** (no underscore style, no newlines)
    const boldItalicRegex = /(\*\*\*)(?!\s)([^\*\n]+?)(?<!\s)\1/g
    while ((match = boldItalicRegex.exec(text)) !== null) {
        results.push({ from: match.index, to: match.index + match[0].length, type: 'bolditalic' })
    }

    // Bold: **text** (not *** or underscore, no newlines)
    const boldRegex = /(?<!\*)(\*\*)(?!\*)(?!\s)([^\*\n]+?)(?<!\s)(?<!\*)\1(?!\*)/g
    while ((match = boldRegex.exec(text)) !== null) {
        results.push({ from: match.index, to: match.index + match[0].length, type: 'bold' })
    }

    // Italic: *text* (not ** or underscore, no newlines)
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

// Decoration singletons — created once, shared across all EditorView instances
const _mdH1Deco         = Decoration.mark({ class: 'cm-md-h1' })
const _mdH2Deco         = Decoration.mark({ class: 'cm-md-h2' })
const _mdH3Deco         = Decoration.mark({ class: 'cm-md-h3' })
const _mdHeadingDeco    = Decoration.mark({ class: 'cm-md-heading' })
const _mdBoldDeco       = Decoration.mark({ class: 'cm-md-bold' })
const _mdItalicDeco     = Decoration.mark({ class: 'cm-md-italic' })
const _mdBoldItalicDeco = Decoration.mark({ class: 'cm-md-bold-italic' })
const _mdStrikeDeco     = Decoration.mark({ class: 'cm-md-strike' })
const _mdCodeDeco       = Decoration.mark({ class: 'cm-md-code' })

const _xmlTagDecos      = cbsColors.map((_, i) => Decoration.mark({ class: `cm-xml-tag-${i}` }))

const _cssSelectorDeco  = Decoration.mark({ class: 'cm-css-selector' })
const _cssPropertyDeco  = Decoration.mark({ class: 'cm-css-property' })
const _cssValueDeco     = Decoration.mark({ class: 'cm-css-value' })
const _cssBracketDeco   = Decoration.mark({ class: 'cm-css-bracket' })
const _cssCommentDeco   = Decoration.mark({ class: 'cm-css-comment' })

/**
 * markupHighlighter — shared ViewPlugin for XML tag nesting, CSS-in-<style>,
 * and Markdown (regex-based) decorations.
 *
 * Apply alongside cbsHighlighter; they coexist safely because they target
 * different text ranges ({{ }} content vs. markup elements) and maintain
 * independent DecorationSets.
 *
 * CSS colour rules are provided by cbsTheme (same file), so both plugins
 * and their styles can be injected with a single shared import.
 */
export const markupHighlighter = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view)
        }

        update(update: ViewUpdate) {
            if (update.docChanged) {
                this.decorations = this.buildDecorations(update.view)
            }
        }

        buildDecorations(view: EditorView): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>()
            const text = view.state.doc.toString()

            type DecoItem = { from: number; to: number; deco: Decoration; priority: number }
            const decos: DecoItem[] = []

            for (const item of parseXmlTags(text)) {
                const level = item.level % cbsColors.length
                decos.push({ from: item.from, to: item.to, deco: _xmlTagDecos[level], priority: 1.5 })
            }

            for (const item of findStyleTagContents(text)) {
                const deco =
                    item.type === 'selector' ? _cssSelectorDeco :
                    item.type === 'property' ? _cssPropertyDeco :
                    item.type === 'value'    ? _cssValueDeco    :
                    item.type === 'bracket'  ? _cssBracketDeco  :
                                               _cssCommentDeco
                decos.push({ from: item.from, to: item.to, deco, priority: 1.7 })
            }

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

            decos.sort((a, b) => a.from - b.from || b.priority - a.priority)
            for (const { from, to, deco } of decos) {
                builder.add(from, to, deco)
            }

            return builder.finish()
        }
    },
    { decorations: v => v.decorations }
)
