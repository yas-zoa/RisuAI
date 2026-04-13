//@name canvas
//@display-name 🎨 Canvas
//@link https://github.com/kwaroran/RisuAI 텍스트 확대 편집 플러그인

// ============================================
// 🎨 Canvas Plugin v1.0
// 입력창을 확대하여 편하게 편집
// - 디스크립션, 정규식, 임베딩, 퍼스트메시지 등
// - 확인 버튼 눌러야 적용 (실시간 렉 방지)
// ============================================

const TE_STYLE = document.createElement('style');
TE_STYLE.id = 'te-style';
TE_STYLE.textContent = `
/* 확대 버튼 - textarea 오른쪽 상단에 고정 */
.te-expand-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    background: var(--bgcolor, #1e1e2e);
    border: 1px solid var(--borderc, #3d3d5c);
    border-radius: 6px;
    color: var(--textcolor2, #888);
    cursor: pointer;
    transition: all 0.15s;
    z-index: 100;
    opacity: 0.3; /* 평소엔 흐리게 */
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    pointer-events: auto !important;
}
.te-expand-btn:hover,
.te-expand-btn:active {
    background: var(--selected, #2d2d44);
    color: var(--textcolor, #fff);
    opacity: 1; /* 호버 시 선명하게 */
}
.te-expand-btn svg {
    width: 18px;
    height: 18px;
    pointer-events: none;
}

/* 오버레이 */
.te-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
}
.te-overlay.open { opacity: 1; pointer-events: auto; }

/* 모달 */
.te-modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.95);
    width: 800px;
    max-width: 95vw;
    height: 80vh;
    max-height: 90vh;
    background: var(--bgcolor, #1e1e2e);
    border: 1px solid var(--borderc, #333);
    border-radius: 12px;
    z-index: 10001;
    display: flex;
    flex-direction: column;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s;
    box-shadow: 0 25px 60px rgba(0,0,0,0.6);
}
.te-modal.open { 
    opacity: 1; 
    pointer-events: auto; 
    transform: translate(-50%, -50%) scale(1);
}

/* 헤더 */
.te-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--borderc, #333);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}
.te-header h3 {
    margin: 0;
    flex: 1;
    color: var(--textcolor, #fff);
    font-size: 16px;
    font-weight: 600;
}
.te-header-btn {
    background: none;
    border: none;
    color: var(--textcolor2, #888);
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
}
.te-header-btn:hover { 
    color: var(--textcolor, #fff); 
    background: var(--selected, #2d2d44); 
}

/* 바디 */
.te-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow: hidden;
}
.te-textarea {
    flex: 1;
    width: 100%;
    background: var(--darkbg, #1a1a2e);
    border: 1px solid var(--borderc, #444);
    border-radius: 8px;
    color: var(--textcolor, #fff);
    font-size: 15px;
    padding: 16px;
    resize: none;
    font-family: inherit;
    line-height: 1.7;
}
.te-textarea:focus { 
    outline: 2px solid var(--borderc, #666);
}
.te-textarea::placeholder {
    color: var(--textcolor2, #666);
}

/* 푸터 */
.te-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--borderc, #333);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
.te-info {
    color: var(--textcolor2, #666);
    font-size: 12px;
}
.te-buttons {
    display: flex;
    gap: 10px;
}
.te-btn {
    padding: 10px 20px;
    border: 1px solid var(--borderc, #3d3d5c);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    background: var(--selected, #2d2d44);
    color: var(--textcolor, #fff);
    transition: all 0.15s;
}
.te-btn:hover { 
    background: var(--borderc, #3d3d5c); 
}
.te-btn.primary { 
    background: #2563eb;
    border-color: #2563eb;
}
.te-btn.primary:hover { 
    background: #1d4ed8; 
}

/* 툴바 버튼들 */
.te-toolbar {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--borderc, #333);
    background: var(--darkbg, #1a1a2e);
    flex-wrap: wrap;
    align-items: center;
}
.te-toolbar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--selected, #2d2d44);
    border: 1px solid var(--borderc, #3d3d5c);
    border-radius: 6px;
    color: var(--textcolor2, #888);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
}
.te-toolbar-btn:hover {
    background: var(--borderc, #3d3d5c);
    color: var(--textcolor, #fff);
}
.te-toolbar-btn.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
}
.te-toolbar-btn svg {
    width: 14px;
    height: 14px;
    pointer-events: none;
}
.te-toolbar-divider {
    width: 1px;
    height: 24px;
    background: var(--borderc, #3d3d5c);
    margin: 0 4px;
}

/* 하이라이트 기능 */
.te-editor-container {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--darkbg, #1a1a2e); /* 기본 배경 */
}
.te-line-numbers {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 48px;
    padding-top: 16px;
    padding-bottom: 60px; /* 스크롤 높이 동기화 여백 */
    padding-right: 8px;
    background: var(--bgcolor, #1e1e2e);
    border-right: 1px solid var(--borderc, #333);
    color: #6e7681;
    font-size: 14px; /* 폰트 사이즈 통일 */
    font-family: Consolas, "Courier New", monospace; /* 폰트 통일 */
    line-height: 1.6; /* 줄간격 통일 */
    text-align: right;
    overflow-y: auto; /* 스크롤 가능하게 */
    overflow-x: hidden;
    user-select: none;
    z-index: 2;
    display: none; /* 기본 숨김 */
    box-sizing: border-box;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
}
.te-line-numbers::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
}
.te-line-numbers > div {
    height: calc(14px * 1.6); /* font-size * line-height */
}
.te-highlight-layer {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    padding: 16px 16px 60px 16px; /* 하단 60px 안전 패딩 */
    font-size: 15px;
    font-family: inherit; /* 기본 폰트 상속 */
    line-height: 1.7;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: auto;
    pointer-events: none;
    color: transparent;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    z-index: 1;
}
.te-highlight-layer mark {
    background: rgba(255, 200, 0, 0.5);
    color: transparent;
    border-radius: 2px;
    box-shadow: 0 0 0 2px rgba(255, 200, 0, 0.3);
}
.te-textarea-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    overflow: hidden; /* 스크롤은 textarea가 담당 */
}
.te-textarea-wrapper .te-textarea {
    position: relative;
    background: transparent;
    z-index: 3; /* 줄번호보다 위 */
    caret-color: var(--textcolor, #fff);
    font-size: 15px;
    font-family: inherit; /* 기본 폰트 상속 */
    line-height: 1.7;
    border: none;
    width: 100%;
    height: 100%;
    resize: none;
    outline: none;
    white-space: pre-wrap; /* 줄바꿈 처리 통일 */
    word-wrap: break-word; /* 단어 줄바꿈 통일 */
}
.te-textarea-wrapper .te-highlight-layer {
    background: transparent;
}

/* 메모 패널 */
.te-memo-panel {
    display: none;
    flex-direction: column;
    width: 300px;
    border-left: 1px solid var(--borderc, #333);
    background: var(--darkbg, #1a1a2e);
    overflow: hidden;
}
.te-memo-panel.open {
    display: flex;
}
.te-memo-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--borderc, #333);
    font-size: 13px;
    font-weight: 600;
    color: var(--textcolor, #fff);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.te-memo-add-btn {
    background: var(--selected, #2d2d44);
    border: 1px solid var(--borderc, #3d3d5c);
    border-radius: 4px;
    color: var(--textcolor2, #888);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 11px;
    transition: all 0.15s;
}
.te-memo-add-btn:hover {
    background: var(--borderc, #3d3d5c);
    color: var(--textcolor, #fff);
}
.te-memo-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}
.te-memo-item {
    margin-bottom: 8px;
    border: 1px solid var(--borderc, #333);
    border-radius: 6px;
    background: var(--bgcolor, #1e1e2e);
    overflow: hidden;
}
.te-memo-item-header {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    cursor: pointer;
    gap: 8px;
    transition: background 0.15s;
}
.te-memo-item-header:hover {
    background: var(--selected, #2d2d44);
}
.te-memo-item-toggle {
    width: 16px;
    height: 16px;
    color: var(--textcolor2, #888);
    transition: transform 0.2s;
    flex-shrink: 0;
}
.te-memo-item.open .te-memo-item-toggle {
    transform: rotate(90deg);
}
.te-memo-item-title {
    flex: 1;
    font-size: 12px;
    color: var(--textcolor, #fff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.te-memo-item-title.placeholder {
    color: var(--textcolor2, #666);
    font-style: italic;
}
.te-memo-item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
}
.te-memo-item-header:hover .te-memo-item-actions {
    opacity: 1;
}
.te-memo-item-btn {
    background: none;
    border: none;
    color: var(--textcolor2, #888);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.te-memo-item-btn:hover {
    color: var(--textcolor, #fff);
    background: var(--borderc, #3d3d5c);
}
.te-memo-item-btn svg {
    width: 12px;
    height: 12px;
}
.te-memo-item-body {
    display: none;
    padding: 0 10px 10px 10px;
}
.te-memo-item.open .te-memo-item-body {
    display: block;
}
.te-memo-item-name {
    width: 100%;
    background: var(--darkbg, #1a1a2e);
    border: 1px solid var(--borderc, #444);
    border-radius: 4px;
    color: var(--textcolor, #fff);
    font-size: 11px;
    padding: 6px 8px;
    margin-bottom: 6px;
}
.te-memo-item-name:focus {
    outline: 1px solid var(--borderc, #666);
}
.te-memo-item-name::placeholder {
    color: var(--textcolor2, #666);
}
.te-memo-item-textarea {
    width: 100%;
    min-height: 80px;
    background: var(--darkbg, #1a1a2e);
    border: 1px solid var(--borderc, #444);
    border-radius: 4px;
    color: var(--textcolor, #fff);
    font-size: 12px;
    padding: 8px;
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
}
.te-memo-item-textarea:focus {
    outline: 1px solid var(--borderc, #666);
}
.te-memo-item-textarea::placeholder {
    color: var(--textcolor2, #666);
}

/* 토스트 알림 */
.te-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: var(--selected, #2d2d44);
    border: 1px solid var(--borderc, #3d3d5c);
    color: var(--textcolor, #fff);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 10002;
    opacity: 0;
    transition: all 0.3s ease;
    pointer-events: none;
}
.te-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

/* 바디 레이아웃 조정 */
.te-body {
    flex: 1;
    display: flex;
    flex-direction: row;
    padding: 0;
    overflow: hidden;
}
.te-editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow: hidden;
}

/* 모바일 반응형 */
@media (max-width: 768px) {
    .te-modal {
        width: 100vw;
        height: 100vh;
        max-width: 100vw;
        max-height: 100vh;
        border-radius: 0;
    }
    .te-body {
        flex-direction: column;
    }
    .te-memo-panel {
        width: 100%;
        max-height: 45vh;
        border-left: none;
        border-top: 1px solid var(--borderc, #333);
    }
    .te-editor-area {
        flex: 1;
        min-height: 30vh;
        padding: 12px;
    }
    .te-toolbar {
        padding: 8px 12px;
        gap: 6px;
    }
    .te-toolbar-btn {
        padding: 5px 8px;
        font-size: 11px;
    }
    .te-toolbar-btn svg {
        width: 12px;
        height: 12px;
    }
    .te-header {
        padding: 12px 16px;
    }
    .te-header h3 {
        font-size: 14px;
    }
    .te-footer {
        padding: 12px 16px;
    }
    .te-btn {
        padding: 8px 16px;
        font-size: 13px;
    }
    .te-memo-item-actions {
        opacity: 1;
    }
}

/* Syntax Highlighting (VS Code Dark+) */
.token.comment { color: #6a9955; }
.token.string { color: #ce9178; }
.token.number { color: #b5cea8; }
.token.keyword { color: #569cd6; }
.token.boolean { color: #569cd6; }
.token.function { color: #dcdcaa; }
.token.operator { color: #d4d4d4; }
.token.class-name { color: #4ec9b0; }
.token.regex { color: #d16969; }
.token.variable { color: #9cdcfe; }
.token.punctuation { color: #d4d4d4; }
.token.property { color: #9cdcfe; }
.token.tag { color: #569cd6; }
.token.attr-name { color: #9cdcfe; }
.token.attr-value { color: #ce9178; }
/* CBS 중첩 레벨별 색상 (PR #72 색상 체계 참조) */
.token.cbs-l0 { color: #8be9fd; } /* level 0: cyan */
.token.cbs-l1 { color: #50fa7b; } /* level 1: green */
.token.cbs-l2 { color: #ffb86c; } /* level 2: orange */
.token.cbs-l3 { color: #ff79c6; } /* level 3: pink */
.token.cbs-l4 { color: #bd93f9; } /* level 4: purple (이후 순환) */

/* Markdown specific */
.token.title { color: #569cd6; }
.token.bold { color: #569cd6; }
.token.italic { font-style: italic; }
.token.list { color: #6796e6; }
.token.code-block { color: #ce9178; background: #2d2d2d; }
.token.quote { color: #6a9955; font-style: italic; }

/* Editor adjustments for syntax highlighting */
.te-editor-container.syntax-mode {
    background: #1e1e1e !important; /* VS Code 배경색 */
}
.te-editor-container.syntax-mode .te-line-numbers {
    display: block;
    background: #1e1e1e;
    border-right: 1px solid #333;
    color: #858585;
}
.te-editor-container.syntax-mode .te-textarea-wrapper {
    margin-left: 48px; /* 줄번호 공간 확보 (텍스트 겹침 방지) */
}
.te-editor-container.syntax-mode .te-textarea,
.te-editor-container.syntax-mode .te-highlight-layer,
.te-editor-container.syntax-mode .te-search-layer {
    font-family: Consolas, "Courier New", monospace !important;
    font-size: 14px !important;
    line-height: 21px !important; /* 1.5 * 14px */
    padding-left: 16px !important; 
    padding-top: 16px !important;
    padding-right: 16px !important;
    padding-bottom: 60px !important; /* 하단 60px 패딩 강제 고정 */
    white-space: pre-wrap !important; /* 모바일 가독성을 위해 자동 줄바꿈 허용 */
    word-wrap: break-word !important;
}
.te-editor-container.syntax-mode .te-textarea {
    color: transparent !important;
    caret-color: #fff;
    background: transparent;
    overflow-x: hidden !important;
}
.te-editor-container.syntax-mode .te-highlight-layer {
    opacity: 1;
    z-index: 0;
    color: #d4d4d4;
    overflow-x: hidden !important;
}
.te-editor-container.syntax-mode .te-search-layer {
    overflow-x: hidden !important;
}
.te-editor-container.syntax-mode .te-line-numbers > div {
    /* height는 JS에서 인라인 스타일로 동기화 */
    line-height: 21px !important;
    font-size: 14px !important;
}

/* 높이 계산용 숨김 마커 */
.te-line-marker {
    display: inline-block;
    width: 0;
    height: 0;
    overflow: hidden;
    vertical-align: top;
}

/* 검색 바 */
.te-search-bar {
    display: none;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bgcolor, #1e1e2e);
    border-bottom: 1px solid var(--borderc, #333);
    animation: slideDown 0.2s ease;
}
.te-search-bar.open {
    display: flex;
}
.te-search-input {
    flex: 1;
    background: var(--darkbg, #1a1a2e);
    border: 1px solid var(--borderc, #444);
    border-radius: 4px;
    color: var(--textcolor, #fff);
    padding: 4px 8px;
    font-size: 13px;
    outline: none;
}
.te-search-input:focus {
    border-color: #2563eb;
}
.te-search-info {
    font-size: 12px;
    color: var(--textcolor2, #888);
    min-width: 60px;
    text-align: center;
}
.te-search-btn {
    background: none;
    border: none;
    color: var(--textcolor2, #888);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
}
.te-search-btn:hover {
    color: var(--textcolor, #fff);
    background: var(--selected, #2d2d44);
}
.te-search-btn svg {
    width: 16px;
    height: 16px;
}

/* 검색 하이라이트 레이어 (최상단) */
.te-search-layer {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    padding: 16px 16px 60px 16px;
    font-size: 15px;
    font-family: inherit;
    line-height: 1.7;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: auto;
    pointer-events: none;
    color: transparent;
    background: transparent;
    z-index: 10; /* 구문 강조보다 위 */
}

.te-search-layer mark {
    background: rgba(255, 255, 0, 0.4);
    color: transparent;
    border-radius: 2px;
}
.te-search-layer mark.current {
    background: rgba(255, 165, 0, 0.8);
    box-shadow: 0 0 0 2px orange;
}

@keyframes slideDown {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
`;
document.head.appendChild(TE_STYLE);

// 아이콘
const TE_ICON = {
    expand: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
    close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    paste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    highlight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    memo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    clearHighlight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
    goToHighlight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>`,
    cleanMarkdown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`,
    arrowDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
    undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
    redo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>`,
};

// 상태
let teCurrentTarget = null;
let teCurrentTargetId = null; 
let teModalOpen = false;
let teHighlights =[]; 
let teHighlightsStore = JSON.parse(localStorage.getItem('te-highlights-store') || '{}'); 
let teMemos = JSON.parse(localStorage.getItem('te-memos') || '[]'); 
let teMemoOpen = false;
let teSyntaxMode = false; 
let teSearchQuery = '';
let teSearchResults =[]; 
let teSearchIndex = -1;
let teSearchOpen = false;
let teHistory =[];
let teHistoryIndex = -1;
let teResizeObserver = null;

// 메모 초기화 (기존 단일 메모 마이그레이션)
if (teMemos.length === 0) {
    const oldMemo = localStorage.getItem('te-shared-memo');
    if (oldMemo) {
        teMemos =[{ id: Date.now(), name: '', content: oldMemo, open: true }];
        localStorage.setItem('te-memos', JSON.stringify(teMemos));
    }
}

// ============================================
// 핵심 기능
// ============================================

function openExpandModal(target, title = '텍스트 편집') {
    if (teModalOpen) return;
    
    teCurrentTarget = target;
    teModalOpen = true;
    
    teCurrentTargetId = generateTargetId(target, title);
    teHighlights = teHighlightsStore[teCurrentTargetId] ||[];
    
    document.getElementById('te-overlay')?.remove();
    document.getElementById('te-modal')?.remove();
    
    teSearchQuery = '';
    teSearchResults =[];
    teSearchIndex = -1;
    teSearchOpen = false;
    teHistory =[getTargetValue(target) || ''];
    teHistoryIndex = 0;

    const overlay = document.createElement('div');
    overlay.id = 'te-overlay';
    overlay.className = 'te-overlay';
    overlay.onclick = () => closeExpandModal(false);
    document.body.appendChild(overlay);
    
    const modal = document.createElement('div');
    modal.id = 'te-modal';
    modal.className = 'te-modal';
    modal.innerHTML = `
        <div class="te-header">
            <h3>📝 ${escapeHtml(title)}</h3>
            <button class="te-header-btn" id="te-close" title="닫기">${TE_ICON.close}</button>
        </div>
        <div class="te-toolbar">
            <button class="te-toolbar-btn" id="te-undo" title="실행 취소 (Ctrl+Z)">${TE_ICON.undo}</button>
            <button class="te-toolbar-btn" id="te-redo" title="다시 실행 (Ctrl+Y)">${TE_ICON.redo}</button>
            <span class="te-toolbar-divider"></span>
            <button class="te-toolbar-btn" id="te-select-all" title="전체 선택 (Ctrl+A)">전체 선택</button>
            <button class="te-toolbar-btn" id="te-copy-all" title="전체 복사">${TE_ICON.copy} 복사</button>
            <button class="te-toolbar-btn" id="te-paste" title="붙여넣기 (커서 위치에 삽입)">${TE_ICON.paste} 붙여넣기</button>
            <span class="te-toolbar-divider"></span>
            <button class="te-toolbar-btn" id="te-toggle-search" title="검색 (Ctrl+F)">${TE_ICON.search} 검색</button>
            <span class="te-toolbar-divider"></span>
            <button class="te-toolbar-btn" id="te-add-highlight" title="선택 영역 하이라이트">${TE_ICON.highlight} 하이라이트</button>
            <button class="te-toolbar-btn" id="te-goto-highlight" title="하이라이트 위치로 이동">${TE_ICON.goToHighlight} 이동</button>
            <button class="te-toolbar-btn" id="te-clear-highlight" title="하이라이트 초기화">${TE_ICON.clearHighlight} 초기화</button>
            <span class="te-toolbar-divider"></span>
            <button class="te-toolbar-btn" id="te-clean-markdown" title="** 제거 및 마크다운 정리">${TE_ICON.cleanMarkdown} MD정리</button>
            <span class="te-toolbar-divider"></span>
            <label class="te-toolbar-btn" style="cursor: pointer; user-select: none;">
                <input type="checkbox" id="te-syntax-toggle" style="margin-right: 6px;">
                코드 보기
            </label>
            <span class="te-toolbar-divider"></span>
            <button class="te-toolbar-btn" id="te-toggle-memo" title="메모 패널 열기/닫기">${TE_ICON.memo} 메모</button>
        </div>
        <div class="te-search-bar" id="te-search-bar">
            <input type="text" class="te-search-input" id="te-search-input" placeholder="찾을 내용...">
            <span class="te-search-info" id="te-search-info">0/0</span>
            <button class="te-search-btn" id="te-search-prev" title="이전 (Shift+Enter)">${TE_ICON.arrowUp}</button>
            <button class="te-search-btn" id="te-search-next" title="다음 (Enter)">${TE_ICON.arrowDown}</button>
            <button class="te-search-btn" id="te-search-close" title="닫기 (Esc)">${TE_ICON.close}</button>
        </div>
        <div class="te-body">
            <div class="te-editor-area">
                <div class="te-editor-container">
                    <div class="te-line-numbers" id="te-line-numbers"></div>
                    <div class="te-textarea-wrapper">
                        <div class="te-highlight-layer" id="te-highlight-layer"></div>
                        <div class="te-search-layer" id="te-search-layer"></div>
                        <textarea class="te-textarea" id="te-editor" placeholder="내용을 입력하세요...">${escapeHtml(getTargetValue(target) || '')}</textarea>
                    </div>
                </div>
            </div>
            <div class="te-memo-panel" id="te-memo-panel">
                <div class="te-memo-header">
                    <span>📋 메모</span>
                    <button class="te-memo-add-btn" id="te-memo-add">${TE_ICON.plus} 추가</button>
                </div>
                <div class="te-memo-list" id="te-memo-list"></div>
            </div>
        </div>
        <div class="te-footer">
            <div class="te-info">
                Ctrl+Enter로 저장
            </div>
            <div class="te-buttons">
                <button class="te-btn" id="te-cancel">취소</button>
                <button class="te-btn primary" id="te-save">적용</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    function saveHistory(newText) {
        if (newText === teHistory[teHistoryIndex]) return;
        teHistory = teHistory.slice(0, teHistoryIndex + 1);
        teHistory.push(newText);
        teHistoryIndex++;
        if (teHistory.length > 50) {
            teHistory.shift();
            teHistoryIndex--;
        }
        updateUndoRedoButtons();
    }

    function undo() {
        if (teHistoryIndex > 0) {
            teHistoryIndex--;
            const text = teHistory[teHistoryIndex];
            editor.value = text;
            updateHighlightLayer();
            if (teSyntaxMode) updateLineNumbers();
            updateUndoRedoButtons();
        }
    }

    function redo() {
        if (teHistoryIndex < teHistory.length - 1) {
            teHistoryIndex++;
            const text = teHistory[teHistoryIndex];
            editor.value = text;
            updateHighlightLayer();
            if (teSyntaxMode) updateLineNumbers();
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById('te-undo');
        const redoBtn = document.getElementById('te-redo');
        undoBtn.disabled = teHistoryIndex <= 0;
        redoBtn.disabled = teHistoryIndex >= teHistory.length - 1;
        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    }

    updateUndoRedoButtons();

    const editor = document.getElementById('te-editor');
    const highlightLayer = document.getElementById('te-highlight-layer');
    const searchLayer = document.getElementById('te-search-layer');
    const lineNumbers = document.getElementById('te-line-numbers');
    const memoPanel = document.getElementById('te-memo-panel');
    const searchBar = document.getElementById('te-search-bar');
    const searchInput = document.getElementById('te-search-input');
    const searchInfo = document.getElementById('te-search-info');
    
    editor.onscroll = () => {
        highlightLayer.scrollTop = editor.scrollTop;
        highlightLayer.scrollLeft = editor.scrollLeft;
        searchLayer.scrollTop = editor.scrollTop;
        searchLayer.scrollLeft = editor.scrollLeft;
        if (teSyntaxMode) {
            lineNumbers.scrollTop = editor.scrollTop;
        }
    };
    
    teResizeObserver = new ResizeObserver(() => {
        if (teSyntaxMode) updateLineNumbers();
    });
    teResizeObserver.observe(editor);
    
    let inputTimeout;
    editor.oninput = () => {
        updateHighlightLayer();
        if (teSyntaxMode) updateLineNumbers();
        if (teSearchOpen) performSearch(false);
        
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
            saveHistory(editor.value);
        }, 500);
    };
    editor.onkeydown = (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            closeExpandModal(true);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            if (teSearchOpen) {
                closeSearchBar();
            } else {
                closeExpandModal(false);
            }
        }
        if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            openSearchBar();
        }
        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        }
        if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            redo();
        }
        if (teSyntaxMode && e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const newVal = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
            editor.value = newVal;
            editor.selectionStart = editor.selectionEnd = start + 4;
            saveHistory(newVal);
            editor.dispatchEvent(new Event('input'));
        }
    };
    
    document.getElementById('te-undo').onclick = undo;
    document.getElementById('te-redo').onclick = redo;

    document.getElementById('te-select-all').onclick = () => {
        editor.focus();
        editor.select();
        showToast('전체 텍스트가 선택되었습니다');
    };

    document.getElementById('te-copy-all').onclick = () => {
        navigator.clipboard.writeText(editor.value).then(() => {
            showToast('전체 텍스트가 복사되었습니다');
        });
    };
    
    document.getElementById('te-paste').onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                showToast('클립보드가 비어있습니다');
                return;
            }
            
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            
            const before = editor.value.substring(0, start);
            const after = editor.value.substring(end);
            const newVal = before + text + after;
            
            editor.value = newVal;
            editor.selectionStart = editor.selectionEnd = start + text.length;
            
            updateHighlightLayer();
            saveHistory(newVal); 
            
            editor.focus();
            showToast('붙여넣기 완료');
        } catch (err) {
            console.error(err);
            showToast('클립보드 접근 권한이 필요합니다');
        }
    };
    
    document.getElementById('te-add-highlight').onclick = () => {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        if (start === end) {
            showToast('하이라이트할 텍스트를 선택해주세요');
            return;
        }
        teHighlights = mergeHighlights([...teHighlights, {start, end}]);
        updateHighlightLayer();
        saveHighlights(); 
        showToast('하이라이트가 추가되었습니다');
    };
    
    document.getElementById('te-goto-highlight').onclick = () => {
        if (teHighlights.length === 0) {
            showToast('하이라이트가 없습니다');
            return;
        }
        const currentPos = editor.selectionStart;
        const sorted = [...teHighlights].sort((a, b) => a.start - b.start);
        
        let nextHighlight = sorted.find(hl => hl.start > currentPos);
        if (!nextHighlight) {
            nextHighlight = sorted[0]; 
        }
        
        editor.focus();
        editor.setSelectionRange(nextHighlight.start, nextHighlight.end);
        
        const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 24;
        const textBeforeHighlight = editor.value.substring(0, nextHighlight.start);
        const linesBeforeHighlight = textBeforeHighlight.split('\n').length;
        const scrollPosition = (linesBeforeHighlight - 3) * lineHeight;
        editor.scrollTop = Math.max(0, scrollPosition);
        highlightLayer.scrollTop = editor.scrollTop;
        searchLayer.scrollTop = editor.scrollTop;
        
        showToast(`하이라이트 ${sorted.indexOf(nextHighlight) + 1}/${sorted.length}로 이동`);
    };
    
    document.getElementById('te-clear-highlight').onclick = () => {
        teHighlights =[];
        updateHighlightLayer();
        saveHighlights(); 
        showToast('하이라이트가 초기화되었습니다');
    };
    
    document.getElementById('te-clean-markdown').onclick = () => {
        const originalText = editor.value;
        const cleanedText = cleanMarkdown(originalText);
        if (originalText === cleanedText) {
            showToast('정리할 내용이 없습니다');
            return;
        }
        editor.value = cleanedText;
        updateHighlightLayer();
        saveHistory(cleanedText);
        showToast('** 제거 및 마크다운 정리 완료');
    };
    
    const syntaxToggle = document.getElementById('te-syntax-toggle');
    syntaxToggle.checked = teSyntaxMode;
    syntaxToggle.onchange = (e) => {
        teSyntaxMode = e.target.checked;
        document.querySelector('.te-editor-container').classList.toggle('syntax-mode', teSyntaxMode);
        updateHighlightLayer();
        if (teSyntaxMode) {
            updateLineNumbers();
            highlightLayer.scrollTop = editor.scrollTop;
            searchLayer.scrollTop = editor.scrollTop;
        }
    };
    if (teSyntaxMode) {
        document.querySelector('.te-editor-container').classList.add('syntax-mode');
        updateLineNumbers();
    }

    function openSearchBar() {
        teSearchOpen = true;
        searchBar.classList.add('open');
        searchInput.focus();
        if (searchInput.value) {
            searchInput.select();
            performSearch(true);
        } else {
            const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
            if (selected && selected.length < 100) {
                searchInput.value = selected;
                performSearch(true);
            }
        }
    }

    function closeSearchBar() {
        teSearchOpen = false;
        searchBar.classList.remove('open');
        teSearchQuery = '';
        teSearchResults =[];
        teSearchIndex = -1;
        updateSearchLayer();
        editor.focus();
    }

    function performSearch(jumpToNext = true) {
        const query = searchInput.value;
        if (!query) {
            teSearchResults =[];
            teSearchIndex = -1;
            searchInfo.textContent = '0/0';
            updateSearchLayer();
            return;
        }

        teSearchQuery = query;
        teSearchResults =[];
        const text = editor.value;
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let index = -1;

        while ((index = lowerText.indexOf(lowerQuery, index + 1)) !== -1) {
            teSearchResults.push({ start: index, end: index + query.length });
        }

        searchInfo.textContent = `${teSearchResults.length > 0 ? teSearchIndex + 1 : 0}/${teSearchResults.length}`;

        if (teSearchResults.length > 0) {
            if (jumpToNext) {
                const currentPos = editor.selectionStart;
                const nextIdx = teSearchResults.findIndex(r => r.start >= currentPos);
                teSearchIndex = nextIdx !== -1 ? nextIdx : 0;
            } else {
                if (teSearchIndex >= teSearchResults.length) teSearchIndex = 0;
                if (teSearchIndex < 0) teSearchIndex = 0;
            }
            if (jumpToNext) scrollToSearchResult();
        } else {
            teSearchIndex = -1;
        }
        
        updateSearchLayer();
        searchInfo.textContent = `${teSearchResults.length > 0 ? teSearchIndex + 1 : 0}/${teSearchResults.length}`;
    }

    function scrollToSearchResult() {
        if (teSearchIndex < 0 || teSearchIndex >= teSearchResults.length) return;
        const result = teSearchResults[teSearchIndex];
        editor.focus();
        editor.setSelectionRange(result.start, result.end);
        
        const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 24;
        const textBefore = editor.value.substring(0, result.start);
        const linesBefore = textBefore.split('\n').length;
        const scrollPos = (linesBefore - 3) * lineHeight;
        editor.scrollTop = Math.max(0, scrollPos);
    }

    document.getElementById('te-toggle-search').onclick = () => {
        if (teSearchOpen) closeSearchBar();
        else openSearchBar();
    };
    document.getElementById('te-search-close').onclick = closeSearchBar;
    
    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchInput.value !== teSearchQuery || teSearchResults.length === 0) {
                performSearch(true);
            } else {
                if (e.shiftKey) {
                    if (teSearchResults.length > 0) {
                        teSearchIndex = (teSearchIndex - 1 + teSearchResults.length) % teSearchResults.length;
                        scrollToSearchResult();
                        updateSearchLayer();
                        searchInfo.textContent = `${teSearchIndex + 1}/${teSearchResults.length}`;
                    }
                } else {
                    if (teSearchResults.length > 0) {
                        teSearchIndex = (teSearchIndex + 1) % teSearchResults.length;
                        scrollToSearchResult();
                        updateSearchLayer();
                        searchInfo.textContent = `${teSearchIndex + 1}/${teSearchResults.length}`;
                    }
                }
            }
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            closeSearchBar();
        }
    };

    document.getElementById('te-search-next').onclick = () => {
        if (searchInput.value !== teSearchQuery || teSearchResults.length === 0) {
            performSearch(true);
        } else if (teSearchResults.length > 0) {
            teSearchIndex = (teSearchIndex + 1) % teSearchResults.length;
            scrollToSearchResult();
            updateSearchLayer();
            searchInfo.textContent = `${teSearchIndex + 1}/${teSearchResults.length}`;
        }
    };

    document.getElementById('te-search-prev').onclick = () => {
        if (searchInput.value !== teSearchQuery || teSearchResults.length === 0) {
            performSearch(true);
        } else if (teSearchResults.length > 0) {
            teSearchIndex = (teSearchIndex - 1 + teSearchResults.length) % teSearchResults.length;
            scrollToSearchResult();
            updateSearchLayer();
            searchInfo.textContent = `${teSearchIndex + 1}/${teSearchResults.length}`;
        }
    };

    document.getElementById('te-toggle-memo').onclick = (e) => {
        teMemoOpen = !teMemoOpen;
        memoPanel.classList.toggle('open', teMemoOpen);
        e.currentTarget.classList.toggle('active', teMemoOpen);
        if (teMemoOpen) renderMemoList();
    };
    
    document.getElementById('te-memo-add').onclick = () => {
        const newMemo = { id: Date.now(), name: '', content: '', open: true };
        teMemos.push(newMemo);
        saveMemos();
        renderMemoList();
        showToast('새 메모가 추가되었습니다');
    };
    
    document.getElementById('te-close').onclick = () => closeExpandModal(false);
    document.getElementById('te-cancel').onclick = () => closeExpandModal(false);
    document.getElementById('te-save').onclick = () => closeExpandModal(true);
    
    requestAnimationFrame(() => {
        overlay.classList.add('open');
        modal.classList.add('open');
        editor.focus();
        updateHighlightLayer();
        
        if (teHighlights.length > 0) {
            const sorted = [...teHighlights].sort((a, b) => a.start - b.start);
            const firstHighlight = sorted[0];
            editor.setSelectionRange(firstHighlight.start, firstHighlight.end);
            
            const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 24;
            const textBeforeHighlight = editor.value.substring(0, firstHighlight.start);
            const linesBeforeHighlight = textBeforeHighlight.split('\n').length;
            const scrollPosition = (linesBeforeHighlight - 3) * lineHeight;
            editor.scrollTop = Math.max(0, scrollPosition);
            highlightLayer.scrollTop = editor.scrollTop;
            
            showToast(`저장된 하이라이트 ${teHighlights.length}개 복원`);
        } else {
            editor.setSelectionRange(editor.value.length, editor.value.length);
        }
        
        if (teMemoOpen) {
            memoPanel.classList.add('open');
            document.getElementById('te-toggle-memo').classList.add('active');
            renderMemoList();
        }
    });
}

function closeExpandModal(save) {
    if (!teModalOpen) return;
    
    const editor = document.getElementById('te-editor');
    const overlay = document.getElementById('te-overlay');
    const modal = document.getElementById('te-modal');
    
    if (save && teCurrentTarget && editor) {
        setTargetValue(teCurrentTarget, editor.value);
    }
    
    overlay?.classList.remove('open');
    modal?.classList.remove('open');
    
    setTimeout(() => {
        overlay?.remove();
        modal?.remove();
    }, 200);
    
    if (teResizeObserver) {
        teResizeObserver.disconnect();
        teResizeObserver = null;
    }
    
    teCurrentTarget = null;
    teCurrentTargetId = null;
    teModalOpen = false;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function updateSearchLayer() {
    const layer = document.getElementById('te-search-layer');
    const editor = document.getElementById('te-editor');
    if (!layer || !editor) return;

    if (teSearchResults.length === 0) {
        layer.innerHTML = '';
        return;
    }

    const text = editor.value;
    let result = '';
    let lastEnd = 0;

    for (let i = 0; i < teSearchResults.length; i++) {
        const hl = teSearchResults[i];
        const start = hl.start;
        const end = hl.end;

        if (start > lastEnd) {
            result += escapeHtml(text.substring(lastEnd, start));
        }
        
        const isCurrent = i === teSearchIndex;
        result += `<mark class="${isCurrent ? 'current' : ''}">${escapeHtml(text.substring(start, end))}</mark>`;
        lastEnd = end;
    }

    if (lastEnd < text.length) {
        result += escapeHtml(text.substring(lastEnd));
    }

    if (text.endsWith('\n')) {
        result += ' ';
    }

    layer.innerHTML = result;
}

function updateLineNumbers() {
    const editor = document.getElementById('te-editor');
    const lineNumbers = document.getElementById('te-line-numbers');
    const layer = document.getElementById('te-highlight-layer');
    if (!editor || !lineNumbers || !layer) return;
    
    if (teSyntaxMode) {
        const markers = layer.querySelectorAll('.te-line-marker');
        if (markers.length < 2) return;
        
        let linesHTML = '';
        const baseHeight = 21; 
        const layerStyle = window.getComputedStyle(layer);
        const paddingBottom = parseInt(layerStyle.paddingBottom) || 60;
        
        for (let i = 0; i < markers.length - 1; i++) {
            let height;
            if (i === markers.length - 2) {
                height = layer.scrollHeight - paddingBottom - markers[i].offsetTop;
            } else {
                const currentTop = markers[i].offsetTop;
                const nextTop = markers[i+1].offsetTop;
                height = nextTop - currentTop;
            }
            
            if (height <= 0) height = baseHeight;
            linesHTML += `<div style="height: ${height}px">${i + 1}</div>`;
        }
        lineNumbers.innerHTML = linesHTML;
    } else {
        const lines = editor.value.split('\n').length;
        if (lineNumbers.childElementCount === lines) return;
        
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= lines; i++) {
            const div = document.createElement('div');
            div.textContent = i;
            fragment.appendChild(div);
        }
        lineNumbers.innerHTML = '';
        lineNumbers.appendChild(fragment);
    }
}

function updateHighlightLayer() {
    const editor = document.getElementById('te-editor');
    const layer = document.getElementById('te-highlight-layer');
    if (!editor || !layer) return;
    
    const text = editor.value;

    if (teSyntaxMode) {
        let html = highlightSyntax(text);
        if (text.endsWith('\n')) {
            html += ' '; 
        }
        html = '<span class="te-line-marker"></span>' + html.replace(/\n/g, '\n<span class="te-line-marker"></span>') + '<span class="te-line-marker"></span>';
        layer.innerHTML = html;
        return;
    }

    if (teHighlights.length === 0) {
        let safeText = escapeHtml(text);
        if (text.endsWith('\n')) safeText += ' ';
        layer.innerHTML = safeText;
        return;
    }
    
    const sorted = [...teHighlights].sort((a, b) => a.start - b.start);
    let result = '';
    let lastEnd = 0;
    
    for (const hl of sorted) {
        const start = Math.min(hl.start, text.length);
        const end = Math.min(hl.end, text.length);
        
        if (start > lastEnd) {
            result += escapeHtml(text.substring(lastEnd, start));
        }
        if (end > start) {
            result += `<mark>${escapeHtml(text.substring(start, end))}</mark>`;
        }
        lastEnd = Math.max(lastEnd, end);
    }
    
    if (lastEnd < text.length) {
        result += escapeHtml(text.substring(lastEnd));
    }
    
    if (text.endsWith('\n')) {
        result += ' ';
    }
    
    layer.innerHTML = result;
}

function parseCBS(text) {
    const CBS_COLORS = 5; 
    const result =[];
    const stack =[]; 

    let i = 0;
    while (i < text.length - 1) {
        if (text[i] === '{' && text[i + 1] === '{') {
            const level = stack.length % CBS_COLORS;
            result.push({ start: i, end: i + 2, type: `cbs-l${level}`, priority: 7 });
            stack.push(level);
            i += 2;
        } else if (text[i] === '}' && text[i + 1] === '}') {
            if (stack.length > 0) {
                const level = stack.pop() % CBS_COLORS;
                result.push({ start: i, end: i + 2, type: `cbs-l${level}`, priority: 7 });
            }
            i += 2;
        } else {
            i++;
        }
    }
    return result;
}

function highlightSyntax(text) {
    if (!text) return '';
    
    const tokens =[
        { type: 'code-block', regex: /```[\s\S]*?```/g },
        { type: 'code-block', regex: /`[^`]+`/g },
        { type: 'title', regex: /^#{1,6}\s+.*$/gm },
        { type: 'bold', regex: /\*\*(?!\*)([^\n]*?)\*\*/g },
        { type: 'italic', regex: /(?<!\*)\*(?!\*)([^\n*]*?)(?<!\*)\*(?!\*)/g },
        { type: 'quote', regex: /^>.*$/gm },
        { type: 'list', regex: /^[\s-]*[-*+]\s+/gm },
        { type: 'list', regex: /^[\s-]*\d+\.\s+/gm },
        { type: 'comment', regex: /\/\/.*$/gm },
        { type: 'comment', regex: /\/\*[\s\S]*?\*\//g },
        { type: 'comment', regex: /<!--[\s\S]*?-->/g },
        { type: 'string', regex: /"(?:[^"\\\n]|\\.)*"/g },
        { type: 'string', regex: /'(?:[^'\\\n]|\\.)*'/g },
        { type: 'number', regex: /\b\d+(\.\d+)?\b/g },
        { type: 'keyword', regex: /\b(function|return|var|let|const|if|else|for|while|class|this|new|import|export|async|await)\b/g },
        { type: 'boolean', regex: /\b(true|false|null|undefined)\b/g },
        { type: 'tag', regex: /<\/?[a-zA-Z][a-zA-Z0-9]*.*?>/g },
    ];
    
    let highlights =[];
    
    tokens.forEach(token => {
        let match;
        token.regex.lastIndex = 0;
        
        while ((match = token.regex.exec(text)) !== null) {
            highlights.push({
                start: match.index,
                end: match.index + match[0].length,
                type: token.type,
                priority: getPriority(token.type)
            });
        }
    });
    
    function getPriority(type) {
        if (type === 'code-block') return 10;
        if (type === 'comment') return 9;
        if (type === 'string') return 8;
        if (type.startsWith('cbs-l')) return 7; 
        if (type === 'tag') return 6;
        return 1;
    }
    
    const cbsTokens = parseCBS(text);
    highlights.push(...cbsTokens);
    
    highlights.sort((a, b) => a.start - b.start || b.priority - a.priority);
    
    let merged =[];
    let lastEnd = 0;
    
    for (const hl of highlights) {
        if (hl.start >= lastEnd) {
            merged.push(hl);
            lastEnd = hl.end;
        }
    }
    
    let result = '';
    let currentIndex = 0;
    
    merged.forEach(hl => {
        if (hl.start > currentIndex) {
            result += escapeHtml(text.substring(currentIndex, hl.start));
        }
        
        const content = escapeHtml(text.substring(hl.start, hl.end));
        result += `<span class="token ${hl.type}">${content}</span>`;
        
        currentIndex = hl.end;
    });
    
    if (currentIndex < text.length) {
        result += escapeHtml(text.substring(currentIndex));
    }
    
    return result;
}

function mergeHighlights(highlights) {
    if (!highlights || highlights.length === 0) return[];
    
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    const merged =[];
    let current = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        
        if (current.end >= next.start) {
            current.end = Math.max(current.end, next.end);
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    
    return merged;
}

function saveMemos() {
    localStorage.setItem('te-memos', JSON.stringify(teMemos));
}

function renderMemoList() {
    const list = document.getElementById('te-memo-list');
    if (!list) return;
    
    list.innerHTML = teMemos.map((memo, index) => {
        const displayTitle = memo.name || (memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모');
        const isPlaceholder = !memo.name && !memo.content;
        
        return `
            <div class="te-memo-item${memo.open ? ' open' : ''}" data-memo-id="${memo.id}">
                <div class="te-memo-item-header">
                    <span class="te-memo-item-toggle">${TE_ICON.chevron}</span>
                    <span class="te-memo-item-title${isPlaceholder ? ' placeholder' : ''}">${escapeHtml(displayTitle)}</span>
                    <div class="te-memo-item-actions">
                        <button class="te-memo-item-btn te-memo-copy" title="복사">${TE_ICON.copy}</button>
                        <button class="te-memo-item-btn te-memo-paste" title="붙여넣기">${TE_ICON.paste}</button>
                        <button class="te-memo-item-btn te-memo-delete" title="삭제">${TE_ICON.trash}</button>
                    </div>
                </div>
                <div class="te-memo-item-body">
                    <input type="text" class="te-memo-item-name" placeholder="메모 이름 (선택)" value="${escapeHtml(memo.name || '')}">
                    <textarea class="te-memo-item-textarea" placeholder="메모 내용...">${escapeHtml(memo.content || '')}</textarea>
                </div>
            </div>
        `;
    }).join('');
    
    list.querySelectorAll('.te-memo-item').forEach(item => {
        const memoId = parseInt(item.dataset.memoId);
        const memo = teMemos.find(m => m.id === memoId);
        if (!memo) return;
        
        item.querySelector('.te-memo-item-header').onclick = (e) => {
            if (e.target.closest('.te-memo-item-actions')) return;
            memo.open = !memo.open;
            item.classList.toggle('open', memo.open);
            saveMemos();
            const titleEl = item.querySelector('.te-memo-item-title');
            const displayTitle = memo.name || (memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모');
            titleEl.textContent = displayTitle;
            titleEl.classList.toggle('placeholder', !memo.name && !memo.content);
        };
        
        item.querySelector('.te-memo-item-name').oninput = (e) => {
            memo.name = e.target.value;
            saveMemos();
            const titleEl = item.querySelector('.te-memo-item-title');
            const displayTitle = memo.name || (memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모');
            titleEl.textContent = displayTitle;
            titleEl.classList.toggle('placeholder', !memo.name && !memo.content);
        };
        
        item.querySelector('.te-memo-item-textarea').oninput = (e) => {
            memo.content = e.target.value;
            saveMemos();
            if (!memo.name) {
                const titleEl = item.querySelector('.te-memo-item-title');
                const displayTitle = memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모';
                titleEl.textContent = displayTitle;
                titleEl.classList.toggle('placeholder', !memo.content);
            }
        };
        
        item.querySelector('.te-memo-copy').onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(memo.content || '').then(() => {
                showToast('메모가 복사되었습니다');
            });
        };
        
        item.querySelector('.te-memo-paste').onclick = async (e) => {
            e.stopPropagation();
            try {
                const text = await navigator.clipboard.readText();
                const textarea = item.querySelector('.te-memo-item-textarea');
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const before = textarea.value.substring(0, start);
                const after = textarea.value.substring(end);
                textarea.value = before + text + after;
                memo.content = textarea.value;
                saveMemos();
                showToast('붙여넣기 완료');
                
                if (!memo.name) {
                    const titleEl = item.querySelector('.te-memo-item-title');
                    const displayTitle = memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모';
                    titleEl.textContent = displayTitle;
                }
            } catch (err) {
                showToast('클립보드 접근 권한이 필요합니다');
            }
        };
        
        item.querySelector('.te-memo-delete').onclick = (e) => {
            e.stopPropagation();
            if (teMemos.length <= 1) {
                showToast('마지막 메모는 삭제할 수 없습니다');
                return;
            }
            teMemos = teMemos.filter(m => m.id !== memoId);
            saveMemos();
            renderMemoList();
            showToast('메모가 삭제되었습니다');
        };
    });
}

function cleanMarkdown(text) {
    return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

// ============================================
// 전역 이벤트 위임 (우클릭 / 롱프레스 트리거)
// ============================================

function getTargetTitle(target) {
    const parent = target.closest('.flex-col, .flex, div');
    if (parent) {
        const label = parent.querySelector('span, label');
        if (label && label.textContent?.trim()) {
            return label.textContent.trim();
        }
    }
    if (target.placeholder) return target.placeholder.slice(0, 30);
    return '텍스트 편집';
}

function getTargetValue(target) {
    if (target.tagName && target.tagName.toLowerCase() === 'textarea') {
        return target.value;
    } else if (target.classList && target.classList.contains('cm-editor')) {
        const lines = target.querySelectorAll('.cm-line');
        if (lines.length > 0) {
            return Array.from(lines).map(line => line.textContent.replace(/\u200b/g, '')).join('\n');
        } else {
            const cmContent = target.querySelector('.cm-content');
            return cmContent ? cmContent.innerText : '';
        }
    }
    return '';
}

function setTargetValue(target, text) {
    if (target.tagName && target.tagName.toLowerCase() === 'textarea') {
        target.value = text;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (target.classList && target.classList.contains('cm-editor')) {
        const cmContent = target.querySelector('.cm-content');
        if (cmContent) {
            cmContent.focus();
            const range = document.createRange();
            range.selectNodeContents(cmContent);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('insertText', false, text);
        }
    }
}

function isValidTarget(target) {
    const isChatArea = target.closest('.mes, .msg, .message, .chat-message,[data-message-id],[data-message_id], #chat-textarea-container, .chat-form');
    if (isChatArea) return false;

    if (target.id && (target.id === 'chat-textarea' || target.id === 'chat-input' || target.id === 'input-text')) return false;
    
    if (target.tagName && target.tagName.toLowerCase() === 'textarea') {
        if (target.classList.contains('te-textarea') || target.id === 'te-editor') return false;
        
        const rect = target.getBoundingClientRect();
        if (rect.height < 60) return false;
        
        const style = window.getComputedStyle(target);
        const minHeight = parseInt(style.minHeight) || 0;
        const rows = target.rows || 1;
        
        if (rows >= 3 || minHeight >= 80 || rect.height >= 100) return true;
        
    } else if (target.classList && target.classList.contains('cm-editor')) {
        const rect = target.getBoundingClientRect();
        if (rect.height < 60) return false;
        return true;
    }
    return false;
}

// 💡 롱프레스 & 우클릭 전역 처리
document.addEventListener('contextmenu', (e) => {
    let target = e.target;
    
    // CodeMirror 클릭 보정
    const cmEditor = target.closest('.cm-editor');
    if (cmEditor) {
        target = cmEditor;
    } else if (target.tagName !== 'TEXTAREA') {
        return; // 다른 요소에서 우클릭 시 무시
    }
    
    // 타겟이 유효한 입력창일 때만 모달 오픈
    if (isValidTarget(target)) {
        // 모달 띄우기 (기본 브라우저 메뉴 억제)
        e.preventDefault();
        e.stopPropagation();
        
        const title = getTargetTitle(target);
        openExpandModal(target, title);
    }
});

function init() {
    console.log('[Text Expander] v2 (Long-Press Trigger) 준비됨');
}

onUnload(() => {
    document.getElementById('te-style')?.remove();
    document.getElementById('te-overlay')?.remove();
    document.getElementById('te-modal')?.remove();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}