<script lang="ts">
    import { onDestroy, tick } from 'svelte'
    import { XIcon } from 'lucide-svelte'
    import {
        EditorView, keymap, lineNumbers, highlightSpecialChars, drawSelection,
        placeholder as cmPlaceholder
    } from '@codemirror/view'
    import { EditorState } from '@codemirror/state'
    import { history, defaultKeymap, historyKeymap, undo, redo, selectAll } from '@codemirror/commands'
    import { markdown } from '@codemirror/lang-markdown'
    import { html } from '@codemirror/lang-html'
    import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
    import { search, searchKeymap, openSearchPanel, closeSearchPanel, searchPanelOpen } from '@codemirror/search'
    import { cbsHighlighter, cbsTheme, catppuccinGutterTheme } from 'src/ts/gui/cbsHighlight'
    import { canvasStorage, type CanvasMemo } from 'src/ts/gui/canvasStorage'
    import CanvasMemoPanel from './CanvasMemoPanel.svelte'

    // ── Props ─────────────────────────────────────────────────────────────────
    interface Props {
        open: boolean
        value: string
        title?: string
        lang?: 'markdown' | 'html' | 'plain' | 'regex' | 'cbs'
        /**
         * Stable, semantic identifier for the editing space (e.g.
         * `char:{id}:desc`).  RESERVED for Phase 2 memo scoping — currently has
         * no active consumer (the per-space highlight feature that originally
         * used it was dropped; manual marks are a weak proxy for structural
         * navigation — see docs/canvas-editor-plan.md).  Threaded from call
         * sites now so memo scoping can switch on later without touching them.
         */
        spaceKey?: string
        onSave?: (next: string) => void
        onClose?: () => void
    }

    let {
        open = false,
        value = '',
        title = '텍스트 편집',
        lang = 'markdown',
        spaceKey = undefined,
        onSave = () => {},
        onClose = () => {}
    }: Props = $props()

    // ── CM editor state ───────────────────────────────────────────────────────
    // Isolation model: while the modal is open the CM view is the single source
    // of truth.  There is no `draft` mirror and no value↔draft↔CM sync effect —
    // the document is seeded once on open (from `value`) and read back once on
    // save.  External `value` changes are intentionally ignored while open
    // (the modal is a transactional editing session — H2).
    let editorHost: HTMLDivElement | undefined = $state()
    let view: EditorView | null = null
    let memoOpen = $state(false)
    let memos = $state<CanvasMemo[]>([])
    let wasOpen = $state(false)

    // ── Toast ─────────────────────────────────────────────────────────────────
    let toastMsg = $state('')
    let toastVisible = $state(false)
    let _toastTimer: ReturnType<typeof setTimeout> | null = null

    const showToast = (msg: string) => {
        if (_toastTimer !== null) clearTimeout(_toastTimer)
        toastMsg = msg
        toastVisible = true
        _toastTimer = setTimeout(() => {
            toastVisible = false
            _toastTimer = null
        }, 2000)
    }

    // ── Memo helpers ──────────────────────────────────────────────────────────
    // Load/persist go through the storage service (canvasStorage); the modal
    // only owns the in-memory `memos` state.  persistMemos surfaces a storage
    // failure (quota etc.) as a toast instead of throwing into the handler (M3).
    const persistMemos = (next: CanvasMemo[]) => {
        memos = next
        try {
            canvasStorage.saveMemos(next)
        } catch {
            showToast('메모 저장에 실패했습니다 (저장 공간 부족)')
        }
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
            // cbsTheme: CBS bracket/keyword + markup colour rules (shared with
            // inline editor).  catppuccinGutterTheme: Mocha-palette gutter rules,
            // popup-only — inline editor uses RisuAI's --risu-* theme and must
            // NOT receive this.  Both applied before the component-local theme
            // so local overrides (search-panel, modal chrome)
            // still win downstream.
            cbsTheme,
            catppuccinGutterTheme,
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
            keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
            cmPlaceholder('내용을 입력하세요...')
        ]

        if (lang === 'markdown' || lang === 'cbs') {
            extensions.push(markdown())
        } else if (lang === 'html') {
            extensions.push(html())
        }

        // Single combined ViewPlugin — handles CBS brackets/content/keywords +
        // XML tag nesting + CSS-in-<style> + Markdown in one pass.  See
        // cbsHighlight.ts for the rationale behind the single-plugin design.
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
                // Seed the document once from the incoming value (isolation —
                // the view is the source of truth from here until save).
                doc: value ?? '',
                extensions: getExtensions()
            }),
            parent: editorHost
        })
    }

    // ── Toolbar actions ───────────────────────────────────────────────────────
    // All toolbar actions dispatch directly into the view (the source of
    // truth).  None route through a `draft` mirror — that indirection was the
    // root of the toolbar-not-reflected bug (H1/H3).
    const removeBoldMarkers = () => {
        if (!view) return
        const current = view.state.doc.toString()
        const cleaned = current.replace(/\*\*(.+?)\*\*/gs, '$1')
        if (cleaned === current) return
        view.dispatch({ changes: { from: 0, to: current.length, insert: cleaned } })
    }

    const copyAll = async () => {
        if (!view) return
        try {
            await navigator.clipboard.writeText(view.state.doc.toString())
            showToast('전체 텍스트가 복사되었습니다')
        } catch {
            showToast('클립보드 접근 권한이 필요합니다')
        }
    }

    // thin wrappers over CM-native commands (history/selection already loaded —
    // zero standing cost).  Essential on mobile, which has no Ctrl+Z/A/V.
    const handleUndo = () => { if (view) undo(view) }
    const handleRedo = () => { if (view) redo(view) }
    const handleSelectAll = () => { if (view) selectAll(view) }
    const handlePaste = async () => {
        if (!view) return
        try {
            const text = await navigator.clipboard.readText()
            const { from, to } = view.state.selection.main
            view.dispatch({
                changes: { from, to, insert: text },
                selection: { anchor: from + text.length }
            })
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

    const insertMemo = (text: string) => {
        // Isolation: insert at the cursor via a view dispatch.  No view means
        // the modal isn't open — nothing to insert into (the old `draft`
        // fallback existed only to feed the removed sync effect).
        if (!text || !view) return
        const sel = view.state.selection.main
        const from = Math.min(sel.from, sel.to)
        const to = Math.max(sel.from, sel.to)
        view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length }
        })
    }

    const saveAndClose = () => {
        // Read the document back from the view exactly once, on save.
        onSave(view ? view.state.doc.toString() : (value ?? ''))
        onClose()
    }

    // ── Reactive effects ──────────────────────────────────────────────────────
    $effect(() => {
        if (open && !wasOpen) {
            wasOpen = true
            memos = canvasStorage.loadMemos()
            // createView seeds the document from `value` directly.
            createView()
        } else if (!open && wasOpen) {
            wasOpen = false
            destroyView()
        }
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
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={handleUndo}>실행취소</button>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={handleRedo}>다시실행</button>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={handlePaste}>붙여넣기</button>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={handleSelectAll}>전체선택</button>
                <span class="w-px h-4 bg-selected"></span>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={toggleSearch}>검색 (Ctrl+F)</button>
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
                    <CanvasMemoPanel memos={memos} onChange={persistMemos} onInsert={insertMemo} />
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
