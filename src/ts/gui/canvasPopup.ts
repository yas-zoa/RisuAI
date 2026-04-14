export function shouldOpenCanvasPopupTarget(target: HTMLElement, minHeight = 60): boolean {
    if (target.closest('[data-canvas-modal="true"]')) return false
    if (target.closest('.mes, .msg, .message, .chat-message, [data-message-id], [data-message_id], #chat-textarea-container, .chat-form')) return false
    if (target.id === 'chat-textarea' || target.id === 'chat-input' || target.id === 'input-text') return false
    const rect = target.getBoundingClientRect()
    const visualHeight = Math.max(rect.height, target.scrollHeight || 0)
    if (visualHeight < minHeight) return false
    return true
}

// Initialize from the current timestamp so that IDs generated across different
// page-load sessions (each starting from Date.now() ≈ 1.7e12) never collide.
// JS Number safely represents integers up to 2^53 - 1 ≈ 9e15, so this counter
// can increment for thousands of years without overflow or precision loss.
let canvasMemoCounter = Date.now()

export function generateCanvasMemoId(): number {
    return ++canvasMemoCounter
}
