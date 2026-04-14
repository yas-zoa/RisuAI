<script lang="ts">
    import { onDestroy, tick } from 'svelte'
    import { XIcon } from 'lucide-svelte'
    import {
        EditorView, keymap, lineNumbers, highlightSpecialChars, drawSelection,
        placeholder as cmPlaceholder, Decoration, type DecorationSet
    } from '@codemirror/view'
    import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'
    import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
    import { markdown } from '@codemirror/lang-markdown'
    import { html } from '@codemirror/lang-html'
    import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
    import { search, searchKeymap, openSearchPanel, closeSearchPanel, searchPanelOpen } from '@codemirror/search'
    import { generateCanvasMemoId } from 'src/ts/gui/canvasPopup'
    import { cbsHighlighter, cbsTheme } from 'src/ts/gui/cbsHighlight'
    import CanvasMemoPanel from './CanvasMemoPanel.svelte'

    // ── Types ────────────────────────────────────────────────────────────────
    interface CanvasMemoItem {
        id: number
        name: string
        content: string
        open: boolean
    }

    interface HighlightRange {
        from: number
        to: number
    }

    /** Shape of an unvalidated memo object read from localStorage. */
    interface RawMemo {
        id?: unknown
        name?: unknown
        content?: unknown
        open?: unknown
    }

    // ── Props ─────────────────────────────────────────────────────────────────
    interface Props {
        open: boolean
        value: string
        title?: string
        lang?: 'markdown' | 'html' | 'plain' | 'regex' | 'cbs'
        onSave?: (next: string) => void
        onClose?: () => void
    }

    let {
        open = false,
        value = '',
        title = '텍스트 편집',
        lang = 'markdown',
        onSave = () => {},
        onClose = () => {}
    }: Props = $props()

    // ── Memo storage ──────────────────────────────────────────────────────────
    const MEMO_KEY = 'te-memos'
    const LEGACY_MEMO_KEY = 'te-shared-memo'

    // ── CM editor state ───────────────────────────────────────────────────────
    let editorHost: HTMLDivElement | undefined = $state()
    let view: EditorView | null = null
    let draft = $state('')
    let memoOpen = $state(false)
    let memos = $state<CanvasMemoItem[]>([])
    let wasOpen = $state(false)
    /** Prevents the external $effect from re-dispatching CM-initiated changes */
    let isInternalUpdate = false

    // ── Toast ─────────────────────────────────────────────────────────────────
    let toastMsg = $state('')
    let toastVisible = $state(false)
    let _toastTimer: ReturnType<typeof setTimeout> | null = null
    /** Debounce timer for persisting highlights to localStorage on each doc change */
    let _highlightSaveTimer: ReturnType<typeof setTimeout> | null = null

    const showToast = (msg: string) => {
        if (_toastTimer !== null) clearTimeout(_toastTimer)
        toastMsg = msg
        toastVisible = true
        _toastTimer = setTimeout(() => {
            toastVisible = false
            _toastTimer = null
        }, 2000)
    }

    // ── User highlight (persisted per title) ──────────────────────────────────
    const HIGHLIGHT_STORE_KEY = 'te-highlights-store'

    const loadHighlights = (titleKey: string): HighlightRange[] => {
        if (typeof localStorage === 'undefined') return []
        try {
            const raw = localStorage.getItem(HIGHLIGHT_STORE_KEY)
            if (!raw) return []
            const store = JSON.parse(raw) as Record<string, unknown>
            const arr = store[titleKey]
            if (!Array.isArray(arr)) return []
            return arr
                .filter((r): r is HighlightRange => r && typeof r.from === 'number' && typeof r.to === 'number')
        } catch { return [] }
    }

    const saveHighlights = (titleKey: string, ranges: HighlightRange[]) => {
        if (typeof localStorage === 'undefined') return
        try {
            const raw = localStorage.getItem(HIGHLIGHT_STORE_KEY)
            const store: Record<string, HighlightRange[]> = raw ? JSON.parse(raw) : {}
            store[titleKey] = ranges
            localStorage.setItem(HIGHLIGHT_STORE_KEY, JSON.stringify(store))
        } catch { /* ignore */ }
    }

    // StateEffect / StateField for user highlights
    const addHighlightEffect = StateEffect.define<HighlightRange>()
    const clearHighlightsEffect = StateEffect.define<null>()

    const highlightMark = Decoration.mark({ class: 'cm-user-highlight' })

    const highlightField = StateField.define<DecorationSet>({
        create: () => Decoration.none,
        update(deco, tr) {
            // Map existing decorations through document changes
            deco = deco.map(tr.changes)
            for (const e of tr.effects) {
                if (e.is(addHighlightEffect)) {
                    const from = Math.min(e.value.from, e.value.to)
                    const to = Math.max(e.value.from, e.value.to)
                    if (from < to) {
                        // Merge the new range into existing ones, then rebuild sorted.
                        const existing: HighlightRange[] = []
                        deco.between(0, tr.newDoc.length, (f, t) => { existing.push({ from: f, to: t }) })
                        existing.push({ from, to })
                        // Sort & merge overlapping
                        const merged = mergeRanges(existing)
                        const b2 = new RangeSetBuilder<Decoration>()
                        for (const r of merged) b2.add(r.from, r.to, highlightMark)
                        deco = b2.finish()
                    }
                } else if (e.is(clearHighlightsEffect)) {
                    deco = Decoration.none
                }
            }
            return deco
        },
        provide: f => EditorView.decorations.from(f)
    })

    function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
        if (!ranges.length) return []
        const sorted = [...ranges].sort((a, b) => a.from - b.from)
        const merged: HighlightRange[] = [sorted[0]]
        for (let i = 1; i < sorted.length; i++) {
            const last = merged[merged.length - 1]
            if (sorted[i].from <= last.to) {
                last.to = Math.max(last.to, sorted[i].to)
            } else {
                merged.push(sorted[i])
            }
        }
        return merged
    }

    /** Collect current highlight ranges from the StateField */
    const getHighlights = (): HighlightRange[] => {
        if (!view) return []
        const ranges: HighlightRange[] = []
        view.state.field(highlightField).between(0, view.state.doc.length, (from, to) => {
            ranges.push({ from, to })
        })
        return ranges
    }

    // ── Memo helpers ──────────────────────────────────────────────────────────
    const loadMemos = (): CanvasMemoItem[] => {
        const fallback: CanvasMemoItem[] = [{ id: generateCanvasMemoId(), name: '', content: '', open: true }]
        if (typeof localStorage === 'undefined') return fallback
        try {
            const parsed = JSON.parse(localStorage.getItem(MEMO_KEY) ?? '[]')
            if (Array.isArray(parsed) && parsed.length > 0) {
                const sanitized = parsed
                    .map((memo): CanvasMemoItem | null => {
                        if (!memo || typeof memo !== 'object') return null
                        const r = memo as RawMemo
                        const maybeId = Number(r.id)
                        const id = Number.isFinite(maybeId)
                            ? maybeId
                            : (console.warn('[CanvasEditorModal] Invalid memo ID in storage, regenerating:', r.id), generateCanvasMemoId())
                        const name = typeof r.name === 'string' ? r.name : ''
                        const content = typeof r.content === 'string' ? r.content : ''
                        const open = r.open !== false
                        return { id, name, content, open }
                    })
                    .filter((memo): memo is CanvasMemoItem => memo !== null)
                if (sanitized.length > 0) return sanitized
            }
            const legacyMemo = localStorage.getItem(LEGACY_MEMO_KEY)
            if (legacyMemo) {
                return [{ id: generateCanvasMemoId(), name: '', content: legacyMemo, open: true }]
            }
        } catch (error) {
            console.error(error)
        }
        return fallback
    }

    const saveMemos = (next: CanvasMemoItem[]) => {
        memos = next
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(MEMO_KEY, JSON.stringify(next))
    }

    // ── CM extensions ─────────────────────────────────────────────────────────
    const getExtensions = () => {
        const extensions = [
            lineNumbers(),
            history(),
            highlightSpecialChars(),
            drawSelection(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            EditorView.lineWrapping,
            // cbsTheme: Catppuccin Mocha gutter styling + CBS bracket/keyword colours.
            // Applied before the component-local theme so local overrides win for
            // search-panel, user-highlight, etc.
            cbsTheme,
            // Fix: fill fixed-height flex container and let CM scroll internally
            EditorView.theme({
                '&': { height: '100%' },
                '.cm-scroller': { overflow: 'auto' },
                // Search panel dark theme
                '.cm-search': {
                    background: 'var(--darkbg)',
                    borderTop: '1px solid var(--borderc)',
                    padding: '6px 12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center',
                },
                '.cm-search input, .cm-search button, .cm-search label': {
                    color: 'var(--textcolor)',
                    background: 'var(--bgcolor)',
                    border: '1px solid var(--borderc)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    padding: '2px 6px',
                },
                '.cm-search button:hover': {
                    background: 'var(--selected)',
                },
                '.cm-button': {
                    backgroundImage: 'none',
                    color: 'var(--textcolor)',
                    background: 'var(--bgcolor)',
                    border: '1px solid var(--borderc)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                },
                '.cm-button:hover': { background: 'var(--selected)' },
                '.cm-textfield': {
                    color: 'var(--textcolor)',
                    background: 'var(--bgcolor)',
                    border: '1px solid var(--borderc)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '12px',
                },
                // User highlight mark
                '.cm-user-highlight': {
                    background: 'rgba(255, 200, 0, 0.45)',
                    borderRadius: '2px',
                    boxShadow: '0 0 0 1px rgba(255, 200, 0, 0.4)',
                },
                // Search match highlight
                '.cm-searchMatch': {
                    background: 'rgba(255, 200, 0, 0.3)',
                    borderRadius: '2px',
                },
                '.cm-searchMatch-selected': {
                    background: 'rgba(255, 140, 0, 0.6)',
                },
            }),
            search({ top: false }),  // panel appears at bottom
            highlightField,
            keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
            EditorView.updateListener.of((update) => {
                if (!update.docChanged) return
                isInternalUpdate = true
                draft = update.state.doc.toString()
                isInternalUpdate = false
                // Debounce highlight persistence so rapid typing doesn't
                // hammer localStorage on every keystroke.
                if (_highlightSaveTimer !== null) clearTimeout(_highlightSaveTimer)
                _highlightSaveTimer = setTimeout(() => {
                    // Clear before saving so onDestroy can detect outstanding work correctly.
                    _highlightSaveTimer = null
                    if (view) saveHighlights(title, getHighlights())
                }, 500)
            }),
            cmPlaceholder('내용을 입력하세요...')
        ]

        if (lang === 'markdown' || lang === 'cbs') {
            extensions.push(markdown())
        } else if (lang === 'html') {
            extensions.push(html())
        }

        // CBS bracket/content/keyword highlighting for all non-plain, non-regex modes.
        // cbsHighlighter is stateless as a ViewPlugin spec; each EditorView instance
        // maintains its own plugin state (DecorationSet + incremental cache).
        if (lang !== 'plain' && lang !== 'regex') {
            extensions.push(cbsHighlighter)
        }

        return extensions
    }

    // ── View lifecycle ────────────────────────────────────────────────────────
    const destroyView = () => {
        if (!view) return
        view.destroy()
        view = null
    }

    const createView = async () => {
        await tick()
        if (!open || !editorHost) return
        destroyView()
        view = new EditorView({
            state: EditorState.create({
                doc: draft,
                extensions: getExtensions()
            }),
            parent: editorHost
        })

        // Restore persisted highlights
        const saved = loadHighlights(title)
        if (saved.length > 0 && view) {
            const docLen = view.state.doc.length
            const effects = saved
                .filter(r => r.from < docLen && r.to <= docLen)
                .map(r => addHighlightEffect.of(r))
            if (effects.length) {
                view.dispatch({ effects })
                showToast(`저장된 하이라이트 ${effects.length}개 복원`)
            }
        }
    }

    const syncDraftToEditor = () => {
        if (!view || isInternalUpdate) return
        const current = view.state.doc.toString()
        if (current === draft) return
        const selection = view.state.selection.main
        const nextLength = draft.length
        view.dispatch({
            changes: { from: 0, to: current.length, insert: draft },
            selection: {
                anchor: Math.min(selection.anchor, nextLength),
                head: Math.min(selection.head, nextLength)
            }
        })
    }

    // ── Toolbar actions ───────────────────────────────────────────────────────
    const removeBoldMarkers = () => {
        draft = draft.replace(/\*\*(.+?)\*\*/gs, '$1')
    }

    const copyAll = async () => {
        try {
            await navigator.clipboard.writeText(draft)
            showToast('전체 텍스트가 복사되었습니다')
        } catch {
            showToast('클립보드 접근 권한이 필요합니다')
        }
    }

    const toggleSearch = () => {
        if (!view) return
        if (searchPanelOpen(view.state)) {
            closeSearchPanel(view)
        } else {
            openSearchPanel(view)
        }
    }

    const addHighlight = () => {
        if (!view) return
        const sel = view.state.selection.main
        if (sel.from === sel.to) {
            showToast('하이라이트할 텍스트를 선택해주세요')
            return
        }
        view.dispatch({ effects: [addHighlightEffect.of({ from: sel.from, to: sel.to })] })
        saveHighlights(title, getHighlights())
        showToast('하이라이트가 추가되었습니다')
    }

    const gotoHighlight = () => {
        if (!view) return
        const ranges = getHighlights()
        if (ranges.length === 0) {
            showToast('하이라이트가 없습니다')
            return
        }
        const currentPos = view.state.selection.main.from
        // Find the next highlight after current cursor, wrapping around
        const sorted = [...ranges].sort((a, b) => a.from - b.from)
        const next = sorted.find(r => r.from > currentPos) ?? sorted[0]
        view.dispatch({
            selection: { anchor: next.from, head: next.to },
            scrollIntoView: true
        })
        const idx = sorted.indexOf(next)
        showToast(`하이라이트 ${idx + 1}/${sorted.length}로 이동`)
    }

    const clearHighlights = () => {
        if (!view) return
        view.dispatch({ effects: [clearHighlightsEffect.of(null)] })
        saveHighlights(title, [])
        showToast('하이라이트가 초기화되었습니다')
    }

    const insertMemo = (text: string) => {
        if (!text) return
        if (view) {
            const sel = view.state.selection.main
            const from = Math.min(sel.from, sel.to)
            const to = Math.max(sel.from, sel.to)
            view.dispatch({
                changes: { from, to, insert: text },
                selection: { anchor: from + text.length }
            })
            draft = view.state.doc.toString()
            return
        }
        draft = draft.length > 0 ? `${draft}\n${text}` : text
    }

    const saveAndClose = () => {
        onSave(draft)
        onClose()
    }

    // ── Reactive effects ──────────────────────────────────────────────────────
    $effect(() => {
        if (open && !wasOpen) {
            wasOpen = true
            draft = value ?? ''
            memos = loadMemos()
            createView()
        } else if (!open && wasOpen) {
            wasOpen = false
            destroyView()
        }
    })

    $effect(() => {
        syncDraftToEditor()
    })

    $effect(() => {
        if (!open) return
        const onKeyDown = (e: KeyboardEvent) => {
            // If CM search panel is open, close it explicitly and stop propagation
            // to prevent the modal from closing too. CM's contentDOM listener runs
            // before this window-level listener, updating view.state synchronously,
            // so we cannot rely on searchPanelOpen() being true here — we close
            // the panel ourselves and guard against the CM-fired ESC arriving first.
            if (e.key === 'Escape') {
                if (view && searchPanelOpen(view.state)) {
                    e.preventDefault()
                    e.stopPropagation()
                    closeSearchPanel(view)
                    return
                }
                e.preventDefault()
                onClose()
                return
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                saveAndClose()
            }
        }
        // Use capture phase so this listener runs *before* CM's contentDOM
        // bubble listener. CM processes ESC synchronously (updating view.state),
        // so without capture we'd see an already-closed search panel here.
        window.addEventListener('keydown', onKeyDown, { capture: true })
        return () => {
            window.removeEventListener('keydown', onKeyDown, { capture: true })
        }
    })

    onDestroy(() => {
        // Flush any pending highlight save before the view is destroyed.
        if (_highlightSaveTimer !== null) {
            clearTimeout(_highlightSaveTimer)
            _highlightSaveTimer = null
            if (view) saveHighlights(title, getHighlights())
        }
        destroyView()
        if (_toastTimer !== null) clearTimeout(_toastTimer)
    })
</script>

{#if open}
    <div class="fixed inset-0 z-[1200] flex items-center justify-center" data-canvas-modal="true">
        <button class="absolute inset-0 bg-black/70 cursor-default" onclick={onClose} aria-label="닫기 오버레이"></button>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="relative w-[min(1200px,96vw)] h-[min(88vh,900px)] bg-bgcolor border border-darkborderc rounded-xl shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            onmousedown={(e) => e.stopPropagation()}
            oncontextmenu={(e) => e.preventDefault()}
        >
            <header class="px-4 py-3 border-b border-darkborderc flex items-center gap-2 flex-shrink-0">
                <h3 class="font-semibold flex-1 truncate">📝 {title}</h3>
                <button class="p-1 rounded hover:bg-selected" onclick={onClose} aria-label="닫기">
                    <XIcon size={18} />
                </button>
            </header>

            <div class="px-4 py-2 border-b border-darkborderc bg-darkbg flex items-center gap-2 flex-wrap flex-shrink-0">
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={copyAll}>전체 복사</button>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={removeBoldMarkers}>MD 정리</button>
                <span class="w-px h-4 bg-selected"></span>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={toggleSearch}>검색 (Ctrl+F)</button>
                <span class="w-px h-4 bg-selected"></span>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={addHighlight}>하이라이트</button>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={gotoHighlight}>이동</button>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={clearHighlights}>초기화</button>
                <span class="w-px h-4 bg-selected"></span>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" class:bg-selected={memoOpen} onclick={() => {
                    memoOpen = !memoOpen
                }}>메모</button>
            </div>

            <div class="flex flex-1 min-h-0">
                <div class="flex-1 min-h-0 p-4 flex flex-col">
                    <div bind:this={editorHost} class="flex-1 min-h-0 border border-selected rounded-md overflow-hidden"></div>
                </div>
                {#if memoOpen}
                    <CanvasMemoPanel memos={memos} onChange={saveMemos} onInsert={insertMemo} />
                {/if}
            </div>

            <footer class="px-4 py-3 border-t border-darkborderc flex items-center justify-between flex-shrink-0">
                <span class="text-xs text-textcolor2">Ctrl+Enter 저장 · Esc 닫기 · Ctrl+F 검색</span>
                <div class="flex items-center gap-2">
                    <button class="px-3 py-2 rounded border border-selected text-sm hover:bg-selected" onclick={onClose}>취소</button>
                    <button class="px-3 py-2 rounded border border-blue-500 bg-blue-600 text-white text-sm hover:bg-blue-700" onclick={saveAndClose}>적용</button>
                </div>
            </footer>
        </div>
    </div>
{/if}

{#if toastVisible}
    <div class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10002] bg-selected border border-darkborderc text-textcolor px-5 py-2.5 rounded-lg text-sm shadow-lg pointer-events-none">
        {toastMsg}
    </div>
{/if}
