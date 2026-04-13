<script lang="ts">
    import { onDestroy, tick } from 'svelte'
    import { XIcon } from 'lucide-svelte'
    import { EditorView, keymap, lineNumbers, highlightSpecialChars, drawSelection, placeholder as cmPlaceholder } from '@codemirror/view'
    import { EditorState } from '@codemirror/state'
    import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
    import { markdown } from '@codemirror/lang-markdown'
    import { html } from '@codemirror/lang-html'
    import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
    import CanvasMemoPanel, { type CanvasMemoItem } from './CanvasMemoPanel.svelte'

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
    let opening = $state(false)
    let isInternalUpdate = false

    const loadMemos = (): CanvasMemoItem[] => {
        const fallback: CanvasMemoItem[] = [{ id: Date.now(), name: '', content: '', open: true }]
        if (typeof localStorage === 'undefined') return fallback
        try {
            const parsed = JSON.parse(localStorage.getItem(MEMO_KEY) ?? '[]')
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((memo) => ({
                    id: Number(memo.id ?? Date.now()),
                    name: String(memo.name ?? ''),
                    content: String(memo.content ?? ''),
                    open: memo.open !== false
                }))
            }
            const legacyMemo = localStorage.getItem(LEGACY_MEMO_KEY)
            if (legacyMemo) {
                return [{ id: Date.now(), name: '', content: legacyMemo, open: true }]
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
        view.dispatch({
            changes: { from: 0, to: current.length, insert: draft }
        })
    }

    const cleanMarkdown = () => {
        draft = draft.replace(/\*\*([^*]+)\*\*/g, '$1')
    }

    const insertMemo = (text: string) => {
        if (!text) return
        draft = draft.length > 0 ? `${draft}\n${text}` : text
    }

    const saveAndClose = () => {
        onSave(draft)
        onClose()
    }

    $effect(() => {
        if (!open || opening) return
        opening = true
        draft = value ?? ''
        memos = loadMemos()
        createView().finally(() => {
            opening = false
        })
    })

    $effect(() => {
        const nextDraft = draft
        syncDraftToEditor()
    })

    $effect(() => {
        if (!open) {
            destroyView()
        }
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
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="absolute inset-0 bg-black/70" onclick={onClose}></div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="relative w-[min(1200px,96vw)] h-[min(88vh,900px)] bg-bgcolor border border-darkborderc rounded-xl shadow-2xl flex flex-col overflow-hidden" onclick={(e) => e.stopPropagation()}>
            <header class="px-4 py-3 border-b border-darkborderc flex items-center gap-2">
                <h3 class="font-semibold flex-1 truncate">📝 {title}</h3>
                <button class="p-1 rounded hover:bg-selected" onclick={onClose} aria-label="닫기">
                    <XIcon size={18} />
                </button>
            </header>

            <div class="px-4 py-2 border-b border-darkborderc bg-darkbg flex items-center gap-2">
                <button class="px-2 py-1 rounded border border-selected text-xs hover:bg-selected" onclick={cleanMarkdown}>MD 정리</button>
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
