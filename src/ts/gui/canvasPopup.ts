export function shouldOpenCanvasPopupTarget(target: HTMLElement, minHeight = 60): boolean {
    if (target.closest('[data-canvas-modal="true"]')) return false
    if (target.closest('.mes, .msg, .message, .chat-message, [data-message-id], [data-message_id], #chat-textarea-container, .chat-form')) return false
    if (target.id === 'chat-textarea' || target.id === 'chat-input' || target.id === 'input-text') return false
    const rect = target.getBoundingClientRect()
    const visualHeight = Math.max(rect.height, target.scrollHeight || 0)
    if (visualHeight < minHeight) return false
    return true
}

let canvasMemoCounter = 0

export function generateCanvasMemoId(): number {
    canvasMemoCounter = (canvasMemoCounter + 1) % 1000
    return Date.now() * 1000 + canvasMemoCounter
}
