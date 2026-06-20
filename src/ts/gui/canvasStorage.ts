/**
 * Canvas editor storage service layer.
 *
 * Purpose
 *   New canvas-editor code (memos) MUST NOT touch
 *   localStorage directly.  All persistence goes through the `CanvasStorage`
 *   interface so that, when the app is later split into backend/core/frontend
 *   layers, only the implementation object swaps — every component keeps
 *   calling the same interface (see docs/canvas-editor-plan.md §3.6, §8.1).
 *
 * Coupling boundary
 *   - Data shapes here are plain objects (no Svelte runes / framework types),
 *     so they can move into a core layer unchanged.
 *   - The current implementation (`localCanvasStorage`) is synchronous because
 *     localStorage is synchronous.  The interface is intentionally NOT
 *     Promise-based yet; switching to async storage (IndexedDB / server) is a
 *     rewrite-time concern and the interface is small enough to revise then.
 *
 * Migrated from CanvasEditorModal.svelte (loadMemos / saveMemos), with one
 * behavioural change: saveMemos now throws on a storage failure (e.g. quota)
 * instead of being a silent setItem — callers surface it as a toast (M3).
 */

import { generateCanvasMemoId } from './canvasPopup'

// ── Data model (plain objects — framework-agnostic) ──────────────────────────
export interface CanvasMemo {
    id: number
    name: string
    content: string
    open: boolean
}

/** Shape of an unvalidated memo object read from localStorage. */
interface RawMemo {
    id?: unknown
    name?: unknown
    content?: unknown
    open?: unknown
}

export interface CanvasStorage {
    /** Load all memos.  Always returns at least one (a blank fallback slot). */
    loadMemos(): CanvasMemo[]
    /** Persist memos.  Throws on storage failure (quota etc.) — callers toast. */
    saveMemos(memos: CanvasMemo[]): void
}

// ── localStorage-backed implementation ───────────────────────────────────────
const MEMO_KEY = 'te-memos'
const LEGACY_MEMO_KEY = 'te-shared-memo'

export const localCanvasStorage: CanvasStorage = {
    loadMemos(): CanvasMemo[] {
        const fallback: CanvasMemo[] = [{ id: generateCanvasMemoId(), name: '', content: '', open: true }]
        if (typeof localStorage === 'undefined') return fallback
        try {
            const parsed = JSON.parse(localStorage.getItem(MEMO_KEY) ?? '[]')
            if (Array.isArray(parsed) && parsed.length > 0) {
                const sanitized = parsed
                    .map((memo): CanvasMemo | null => {
                        if (!memo || typeof memo !== 'object') return null
                        const r = memo as RawMemo
                        const maybeId = Number(r.id)
                        const id = Number.isFinite(maybeId)
                            ? maybeId
                            : (console.warn('[canvasStorage] Invalid memo ID in storage, regenerating:', r.id), generateCanvasMemoId())
                        const name = typeof r.name === 'string' ? r.name : ''
                        const content = typeof r.content === 'string' ? r.content : ''
                        const open = r.open !== false
                        return { id, name, content, open }
                    })
                    .filter((memo): memo is CanvasMemo => memo !== null)
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
    },

    saveMemos(memos: CanvasMemo[]): void {
        if (typeof localStorage === 'undefined') return
        // Let the failure propagate (quota exceeded etc.) — the caller decides
        // how to surface it.  This is the M3 fix: the old direct setItem could
        // throw uncaught into the toolbar handler.
        localStorage.setItem(MEMO_KEY, JSON.stringify(memos))
    },
}

/**
 * The active storage implementation.  Swap this single binding at rewrite time
 * to move memos to a backend/DB (§8.1).
 */
export const canvasStorage: CanvasStorage = localCanvasStorage
