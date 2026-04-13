<script lang="ts">
    import { onDestroy, tick } from 'svelte'
    import { XIcon } from 'lucide-svelte'
    import { EditorView, keymap, lineNumbers, highlightSpecialChars, drawSelection, placeholder as cmPlaceholder } from '@codemirror/view'
    import { EditorState } from '@codemirror/state'
    import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
    import { markdown } from '@codemirror/lang-markdown'
    import { html } from '@codemirror/lang-html'
    import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
    import { generateCanvasMemoId } from 'src/ts/gui/canvasPopup'
    import CanvasMemoPanel from './CanvasMemoPanel.svelte'

    interface CanvasMemoItem {
        id: number
        name: string
        content: string
        open: boolean
    }

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

    const MEMO_KEY = 'te-memos'
    const LEGACY_MEMO_KEY = 'te-shared-memo'

    let editorHost: HTMLDivElement | undefined = $state()
    let view: EditorView | null = null
    let draft = $state('')
    let memoOpen = $state(false)
    let memos = $state<CanvasMemoItem[]>([])
    let wasOpen = $state(false)
    let isInternalUpdate = false

    const loadMemos = (): CanvasMemoItem[] => {
        const fallback: CanvasMemoItem[] = [{ id: generateCanvasMemoId(), name: '', content: '', open: true }]
        if (typeof localStorage === 'undefined') return fallback
        try {
            const parsed = JSON.parse(localStorage.getItem(MEMO_KEY) ?? '[]')
            if (Array.isArray(parsed) && parsed.length > 0) {
                const sanitized = parsed
                    .map((memo): CanvasMemoItem | null => {
                        if (!memo || typeof memo !== 'object') return null
                        const maybeId = Number((memo as { id?: unknown }).id)
                        const id = Number.isFinite(maybeId) ? maybeId : generateCanvasMemoId()
                        const name = typeof (memo as { name?: unknown }).name === 'string' ? (memo as { name: string }).name : ''
                        const content = typeof (memo as { content?: unknown }).content === 'string' ? (memo as { content: string }).content : ''
                        const open = (memo as { open?: unknown }).open !== false
                        return { id, name, content, open }
                    })
                    .filter((memo): memo is CanvasMemoItem => memo !== null)
                if (sanitized.length > 0) {
                    return sanitized
                }
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

    const getExtensions = () => {
        const extensions = [
            lineNumbers(),
            history(),
            highlightSpecialChars(),
            drawSelection(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            EditorView.lineWrapping,
            keymap.of([...defaultKeymap, ...historyKeymap]),
            EditorView.updateListener.of((update) => {
                if (!update.docChanged) return
                isInternalUpdate = true
                draft = update.state.doc.toString()
                isInternalUpdate = false
            }),
            cmPlaceholder('내용을 입력하세요...')
        ]

        if (lang === 'markdown' || lang === 'cbs') {
            extensions.push(markdown())
        } else if (lang === 'html') {
            extensions.push(html())
        }

        return extensions
    }

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

    const removeBoldMarkers = () => {
        draft = draft.replace(/\*\*(.+?)\*\*/gs, '$1')
    }

    const insertMemo = (text: string) => {
        if (!text) return
        if (view) {
            const selection = view.state.selection.main
            const from = Math.min(selection.from, selection.to)
            const to = Math.max(selection.from, selection.to)
            const insert = text
            view.dispatch({
                changes: { from, to, insert },
                selection: {
                    anchor: from + insert.length
                }
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
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
                return
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                saveAndClose()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
        }
    })

    onDestroy(() => {
        destroyView()
    })
</script>

{#if open}
    <div class="fixed inset-0 z-[1200] flex items-center justify-center" data-canvas-modal="true">
        <button class="absolute inset-0 bg-black/70 cursor-default" onclick={onClose} aria-label="닫기 오버레이"></button>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="relative w-[min(1200px,96vw)] h-[min(88vh,900px)] bg-bgcolor border border-darkborderc rounded-xl shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true" onmousedown={(e) => e.stopPropagation()}>
            <header class="px-4 py-3 border-b border-darkborderc flex items-center gap-2">
                <h3 class="font-semibold flex-1 truncate">📝 {title}</h3>
                <button class="p-1 rounded hover:bg-selected" onclick={onClose} aria-label="닫기">
                    <XIcon size={18} />
                </button>
            </header>

            <div class="px-4 py-2 border-b border-darkborderc bg-darkbg flex items-center gap-2">
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={removeBoldMarkers}>MD 정리</button>
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" class:bg-selected={memoOpen} onclick={() => {
                    memoOpen = !memoOpen
                }}>메모</button>
            </div>

            <div class="flex-1 min-h-0 flex">
                <div class="flex-1 min-h-0 p-4">
                    <div bind:this={editorHost} class="w-full h-full border border-selected rounded-md overflow-hidden"></div>
                </div>
                {#if memoOpen}
                    <CanvasMemoPanel memos={memos} onChange={saveMemos} onInsert={insertMemo} />
                {/if}
            </div>

            <footer class="px-4 py-3 border-t border-darkborderc flex items-center justify-between">
                <span class="text-xs text-textcolor2">Ctrl+Enter 저장 · Esc 닫기</span>
                <div class="flex items-center gap-2">
                    <button class="px-3 py-2 rounded border border-selected text-sm hover:bg-selected" onclick={onClose}>취소</button>
                    <button class="px-3 py-2 rounded border border-blue-500 bg-blue-600 text-white text-sm hover:bg-blue-700" onclick={saveAndClose}>적용</button>
                </div>
            </footer>
        </div>
    </div>
{/if}
