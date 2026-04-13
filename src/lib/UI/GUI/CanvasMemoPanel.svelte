<script lang="ts">
    import { generateCanvasMemoId } from 'src/ts/gui/canvasPopup'

    interface CanvasMemoItem {
        id: number
        name: string
        content: string
        open: boolean
    }

    interface Props {
        memos: CanvasMemoItem[]
        onChange?: (next: CanvasMemoItem[]) => void
        onInsert?: (text: string) => void
    }

    let {
        memos = [],
        onChange = () => {},
        onInsert = () => {}
    }: Props = $props()

    const update = (next: CanvasMemoItem[]) => {
        onChange(next)
    }

    const addMemo = () => {
        update([
            ...memos,
            {
                id: generateCanvasMemoId(),
                name: '',
                content: '',
                open: true
            }
        ])
    }

    const deleteMemo = (id: number) => {
        // Keep one memo slot so the memo panel always remains immediately writable.
        if (memos.length <= 1) return
        update(memos.filter((memo) => memo.id !== id))
    }

    const patchMemo = (id: number, patch: Partial<CanvasMemoItem>) => {
        update(memos.map((memo) => memo.id === id ? { ...memo, ...patch } : memo))
    }

    const toggleMemo = (id: number) => {
        const memo = memos.find((item) => item.id === id)
        if (!memo) return
        patchMemo(id, { open: !memo.open })
    }
</script>

<aside class="w-80 border-l border-darkborderc bg-darkbg flex flex-col min-w-0">
    <div class="px-3 py-2 border-b border-darkborderc flex items-center justify-between">
        <span class="text-sm font-semibold text-textcolor">메모</span>
        <button class="px-2 py-1 text-xs rounded border border-selected hover:bg-selected" onclick={addMemo}>+ 추가</button>
    </div>
    <div class="p-2 overflow-y-auto flex-1 space-y-2">
        {#each memos as memo}
            <div class="border border-darkborderc rounded-md">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="px-2 py-2 flex items-center gap-2 cursor-pointer hover:bg-selected/30" role="button" tabindex="0" onclick={() => {
                    toggleMemo(memo.id)
                }} onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleMemo(memo.id)
                    }
                }}>
                    <span class="text-xs text-textcolor2">{memo.open ? '▾' : '▸'}</span>
                    <span class="text-sm flex-1 truncate text-textcolor">{memo.name || (memo.content ? memo.content.split('\n')[0] : '빈 메모')}</span>
                    <button class="text-xs px-2 py-1 rounded border border-selected hover:bg-selected" onclick={(e) => {
                        e.stopPropagation()
                        onInsert(memo.content || '')
                    }}>삽입</button>
                    <button class="text-xs px-2 py-1 rounded border border-red-500/50 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent" disabled={memos.length <= 1} title={memos.length <= 1 ? '마지막 메모는 삭제할 수 없습니다' : '삭제'} onclick={(e) => {
                        e.stopPropagation()
                        deleteMemo(memo.id)
                    }}>삭제</button>
                </div>
                {#if memo.open}
                    <div class="p-2 border-t border-darkborderc flex flex-col gap-2">
                        <input
                            class="w-full bg-transparent border border-darkborderc rounded px-2 py-1 text-sm"
                            placeholder="메모 이름"
                            value={memo.name}
                            oninput={(e) => patchMemo(memo.id, { name: e.currentTarget.value })}
                        />
                        <textarea
                            class="w-full min-h-20 bg-transparent border border-darkborderc rounded px-2 py-1 text-sm resize-y"
                            placeholder="메모 내용"
                            value={memo.content}
                            oninput={(e) => patchMemo(memo.id, { content: e.currentTarget.value })}
                        ></textarea>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</aside>
