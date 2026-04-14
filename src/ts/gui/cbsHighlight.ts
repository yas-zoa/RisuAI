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
    '.cm-cbs-kw-macro':   { color: '#89b4fa' }                      // Mocha Sapphire
    })
