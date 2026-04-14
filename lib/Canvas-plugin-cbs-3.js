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
    padding: 16px;
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
    padding: 16px; /* 패딩 통일 */
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
/* font-weight: bold 제거 — syntax-mode에서 textarea와 highlight-layer를 픽셀 단위로
   겹치므로 bold 폰트가 글자 폭을 넓혀 줄바꿈 위치를 어긋나게 만듦 */
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
    padding-left: 16px !important; /* wrapper에서 48px 밀었으므로 16px만 적용 */
    padding-top: 16px !important;
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
    padding: 16px;
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
let teCurrentTargetId = null; // textarea 식별용 ID
let teModalOpen = false;
let teHighlights =[]; // {start, end} 배열
let teHighlightsStore = JSON.parse(localStorage.getItem('te-highlights-store') || '{}'); // textarea별 하이라이트 저장
let teMemos = JSON.parse(localStorage.getItem('te-memos') || '[]'); // 여러 개 메모[{id, name, content, open}]
let teMemoOpen = false;
let teSyntaxMode = false; // 구문 강조 모드
let teSearchQuery = '';
let teSearchResults =[]; // {start, end}
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
    
    // textarea 식별용 ID 생성 (위치 + 제목 기반)
    teCurrentTargetId = generateTargetId(target, title);
    
    // 저장된 하이라이트 복원
    teHighlights = teHighlightsStore[teCurrentTargetId] ||[];
    
    // 기존 모달 제거
    document.getElementById('te-overlay')?.remove();
    document.getElementById('te-modal')?.remove();
    
    // 상태 초기화
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
    
    // Undo/Redo 기능
    function saveHistory(newText) {
        if (newText === teHistory[teHistoryIndex]) return;
        
        // 현재 인덱스 이후의 기록은 삭제 (새로운 분기)
        teHistory = teHistory.slice(0, teHistoryIndex + 1);
        teHistory.push(newText);
        teHistoryIndex++;
        
        // 최대 히스토리 제한 (예: 50개)
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
            // tokenCount.textContent = estimateTokens(text);
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
            // tokenCount.textContent = estimateTokens(text);
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

    // 초기 버튼 상태
    updateUndoRedoButtons();

    // 이벤트 바인딩
    const editor = document.getElementById('te-editor');
    // const tokenCount = document.getElementById('te-token-count'); // 제거됨
    const highlightLayer = document.getElementById('te-highlight-layer');
    const searchLayer = document.getElementById('te-search-layer');
    const lineNumbers = document.getElementById('te-line-numbers');
    const memoPanel = document.getElementById('te-memo-panel');
    const searchBar = document.getElementById('te-search-bar');
    const searchInput = document.getElementById('te-search-input');
    const searchInfo = document.getElementById('te-search-info');
    
    // 에디터 스크롤과 하이라이트 레이어 동기화
    editor.onscroll = () => {
        highlightLayer.scrollTop = editor.scrollTop;
        highlightLayer.scrollLeft = editor.scrollLeft;
        searchLayer.scrollTop = editor.scrollTop;
        searchLayer.scrollLeft = editor.scrollLeft;
        if (teSyntaxMode) {
            lineNumbers.scrollTop = editor.scrollTop;
        }
    };
    
    // 화면 크기 변경 시 자동 줄바꿈으로 인한 높이 변화 동기화
    teResizeObserver = new ResizeObserver(() => {
        if (teSyntaxMode) updateLineNumbers();
    });
    teResizeObserver.observe(editor);
    
    // 입력 디바운스 (히스토리 저장용)
    let inputTimeout;
    editor.oninput = () => {
        // tokenCount.textContent = estimateTokens(editor.value);
        updateHighlightLayer();
        if (teSyntaxMode) updateLineNumbers();
        if (teSearchOpen) performSearch(false); // 내용 변경 시 검색 갱신
        
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
            saveHistory(editor.value);
        }, 500); // 0.5초 멈추면 저장
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
        // 검색 단축키 (Ctrl+F)
        if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
            e.preventDefault();
            openSearchBar();
        }
        // Undo (Ctrl+Z)
        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        }
        // Redo (Ctrl+Y)
        if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            redo();
        }
        // Tab 키 지원 (코드 모드일 때)
        if (teSyntaxMode && e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const newVal = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
            editor.value = newVal;
            editor.selectionStart = editor.selectionEnd = start + 4;
            saveHistory(newVal); // 탭 입력은 즉시 저장
            editor.dispatchEvent(new Event('input')); // 트리거
        }
    };
    
    // Undo/Redo 버튼
    document.getElementById('te-undo').onclick = undo;
    document.getElementById('te-redo').onclick = redo;

    // 전체 선택
    document.getElementById('te-select-all').onclick = () => {
        editor.focus();
        editor.select();
        showToast('전체 텍스트가 선택되었습니다');
    };

    // 전체 복사
    document.getElementById('te-copy-all').onclick = () => {
        navigator.clipboard.writeText(editor.value).then(() => {
            showToast('전체 텍스트가 복사되었습니다');
        });
    };
    
    // 붙여넣기
    document.getElementById('te-paste').onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                showToast('클립보드가 비어있습니다');
                return;
            }
            
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            
            // 선택된 텍스트가 있으면 덮어쓰기, 없으면 커서 위치에 삽입
            const before = editor.value.substring(0, start);
            const after = editor.value.substring(end);
            const newVal = before + text + after;
            
            editor.value = newVal;
            editor.selectionStart = editor.selectionEnd = start + text.length;
            
            // tokenCount.textContent = estimateTokens(editor.value);
            updateHighlightLayer();
            saveHistory(newVal); // 붙여넣기는 즉시 저장
            
            editor.focus();
            showToast('붙여넣기 완료');
        } catch (err) {
            console.error(err);
            showToast('클립보드 접근 권한이 필요합니다');
        }
    };
    
    // 하이라이트 추가
    document.getElementById('te-add-highlight').onclick = () => {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        if (start === end) {
            showToast('하이라이트할 텍스트를 선택해주세요');
            return;
        }
        // 겹치는 하이라이트 병합 처리
        teHighlights = mergeHighlights([...teHighlights, {start, end}]);
        updateHighlightLayer();
        saveHighlights(); // 저장
        showToast('하이라이트가 추가되었습니다');
    };
    
    // 하이라이트 위치로 이동
    document.getElementById('te-goto-highlight').onclick = () => {
        if (teHighlights.length === 0) {
            showToast('하이라이트가 없습니다');
            return;
        }
        // 첫 번째 하이라이트로 이동 (순환)
        const currentPos = editor.selectionStart;
        const sorted = [...teHighlights].sort((a, b) => a.start - b.start);
        
        // 현재 위치 다음의 하이라이트 찾기
        let nextHighlight = sorted.find(hl => hl.start > currentPos);
        if (!nextHighlight) {
            nextHighlight = sorted[0]; // 순환
        }
        
        // 해당 위치로 이동 및 선택
        editor.focus();
        editor.setSelectionRange(nextHighlight.start, nextHighlight.end);
        
        // 스크롤하여 보이게 하기
        const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 24;
        const textBeforeHighlight = editor.value.substring(0, nextHighlight.start);
        const linesBeforeHighlight = textBeforeHighlight.split('\n').length;
        const scrollPosition = (linesBeforeHighlight - 3) * lineHeight;
        editor.scrollTop = Math.max(0, scrollPosition);
        highlightLayer.scrollTop = editor.scrollTop;
        searchLayer.scrollTop = editor.scrollTop;
        
        showToast(`하이라이트 ${sorted.indexOf(nextHighlight) + 1}/${sorted.length}로 이동`);
    };
    
    // 하이라이트 초기화
    document.getElementById('te-clear-highlight').onclick = () => {
        teHighlights =[];
        updateHighlightLayer();
        saveHighlights(); // 저장
        showToast('하이라이트가 초기화되었습니다');
    };
    
    // 마크다운 정리
    document.getElementById('te-clean-markdown').onclick = () => {
        const originalText = editor.value;
        const cleanedText = cleanMarkdown(originalText);
        if (originalText === cleanedText) {
            showToast('정리할 내용이 없습니다');
            return;
        }
        editor.value = cleanedText;
        // tokenCount.textContent = estimateTokens(editor.value);
        updateHighlightLayer();
        saveHistory(cleanedText); // 정리 후 저장
        showToast('** 제거 및 마크다운 정리 완료');
    };
    
    // 구문 강조 토글
    const syntaxToggle = document.getElementById('te-syntax-toggle');
    syntaxToggle.checked = teSyntaxMode;
    syntaxToggle.onchange = (e) => {
        teSyntaxMode = e.target.checked;
        document.querySelector('.te-editor-container').classList.toggle('syntax-mode', teSyntaxMode);
        updateHighlightLayer();
        if (teSyntaxMode) {
            updateLineNumbers();
            // 폰트 변경 등으로 인한 스크롤 위치 재조정
            highlightLayer.scrollTop = editor.scrollTop;
            searchLayer.scrollTop = editor.scrollTop;
        }
    };
    if (teSyntaxMode) {
        document.querySelector('.te-editor-container').classList.add('syntax-mode');
        updateLineNumbers();
    }

    // 검색 기능 관련
    function openSearchBar() {
        teSearchOpen = true;
        searchBar.classList.add('open');
        searchInput.focus();
        if (searchInput.value) {
            searchInput.select();
            performSearch(true);
        } else {
            // 선택된 텍스트가 있으면 검색어로 설정
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

        // 검색 수행
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
                // 현재 커서 위치 이후의 첫 번째 결과 찾기
                const currentPos = editor.selectionStart;
                const nextIdx = teSearchResults.findIndex(r => r.start >= currentPos);
                teSearchIndex = nextIdx !== -1 ? nextIdx : 0;
            } else {
                // 인덱스 유지하되 범위 체크
                if (teSearchIndex >= teSearchResults.length) teSearchIndex = 0;
                if (teSearchIndex < 0) teSearchIndex = 0;
            }
            
            // 현재 결과로 이동
            if (jumpToNext) {
                scrollToSearchResult();
            }
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
        
        // 스크롤 조정
        const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 24;
        const textBefore = editor.value.substring(0, result.start);
        const linesBefore = textBefore.split('\n').length;
        const scrollPos = (linesBefore - 3) * lineHeight;
        editor.scrollTop = Math.max(0, scrollPos);
    }

    // 검색 이벤트
    document.getElementById('te-toggle-search').onclick = () => {
        if (teSearchOpen) closeSearchBar();
        else openSearchBar();
    };
    document.getElementById('te-search-close').onclick = closeSearchBar;
    
    // 실시간 검색 제거 (사용자 요청: 다 입력 후 검색)
    // searchInput.oninput = () => performSearch(true); 
    
    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // 검색어가 변경되었거나 결과가 없으면 새로 검색
            if (searchInput.value !== teSearchQuery || teSearchResults.length === 0) {
                performSearch(true);
            } else {
                // 기존 결과 내에서 이동
                if (e.shiftKey) {
                    // 이전 찾기
                    if (teSearchResults.length > 0) {
                        teSearchIndex = (teSearchIndex - 1 + teSearchResults.length) % teSearchResults.length;
                        scrollToSearchResult();
                        updateSearchLayer();
                        searchInfo.textContent = `${teSearchIndex + 1}/${teSearchResults.length}`;
                    }
                } else {
                    // 다음 찾기
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

    // 검색 버튼 클릭 시 검색 실행
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

    // 메모 토글
    document.getElementById('te-toggle-memo').onclick = (e) => {
        teMemoOpen = !teMemoOpen;
        memoPanel.classList.toggle('open', teMemoOpen);
        e.currentTarget.classList.toggle('active', teMemoOpen);
        if (teMemoOpen) {
            renderMemoList();
        }
    };
    
    // 메모 추가
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
    
    // 애니메이션 후 열기
    requestAnimationFrame(() => {
        overlay.classList.add('open');
        modal.classList.add('open');
        editor.focus();
        // tokenCount.textContent = estimateTokens(editor.value);
        updateHighlightLayer();
        
        // 하이라이트가 있으면 첫 번째 하이라이트로 이동
        if (teHighlights.length > 0) {
            const sorted = [...teHighlights].sort((a, b) => a.start - b.start);
            const firstHighlight = sorted[0];
            editor.setSelectionRange(firstHighlight.start, firstHighlight.end);
            
            // 스크롤하여 보이게 하기
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
        
        // 메모 패널 상태 복원
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
        // 값 적용
        setTargetValue(teCurrentTarget, editor.value);
    }
    
    // 닫기 애니메이션
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

// 검색 레이어 업데이트
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

    // 검색 결과만 마킹하고 나머지는 투명 텍스트로 채움 (위치 보존용)
    // 성능을 위해 보이는 영역 근처만 렌더링하면 좋겠지만, 일단 전체 렌더링
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

    layer.innerHTML = result;
}

// 줄 번호 업데이트
function updateLineNumbers() {
    const editor = document.getElementById('te-editor');
    const lineNumbers = document.getElementById('te-line-numbers');
    const layer = document.getElementById('te-highlight-layer');
    if (!editor || !lineNumbers || !layer) return;
    
    if (teSyntaxMode) {
        const markers = layer.querySelectorAll('.te-line-marker');
        if (markers.length < 2) return;
        
        let linesHTML = '';
        const baseHeight = 21; // 기본 line-height
        
        for (let i = 0; i < markers.length - 1; i++) {
            const currentTop = markers[i].offsetTop;
            const nextTop = markers[i+1].offsetTop;
            let height = nextTop - currentTop;
            
            // 높이 계산 보정 (빈 줄 겹침 등 방지)
            if (height <= 0) height = baseHeight;
            
            linesHTML += `<div style="height: ${height}px">${i + 1}</div>`;
        }
        lineNumbers.innerHTML = linesHTML;
    } else {
        const lines = editor.value.split('\n').length;
        // 기존 줄 수와 같으면 스킵 (성능 최적화)
        if (lineNumbers.childElementCount === lines) return;
        
        // DocumentFragment 사용하여 성능 개선
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

// 하이라이트 레이어 업데이트
function updateHighlightLayer() {
    const editor = document.getElementById('te-editor');
    const layer = document.getElementById('te-highlight-layer');
    if (!editor || !layer) return;
    
    const text = editor.value;

    // 구문 강조 모드
    if (teSyntaxMode) {
        let html = highlightSyntax(text);
        // 줄 높이 계산을 위한 숨김 마커 삽입
        html = '<span class="te-line-marker"></span>' + html.replace(/\n/g, '\n<span class="te-line-marker"></span>') + '<span class="te-line-marker"></span>';
        layer.innerHTML = html;
        return;
    }

    if (teHighlights.length === 0) {
        layer.innerHTML = escapeHtml(text);
        return;
    }
    
    // 정렬된 하이라이트
    const sorted = [...teHighlights].sort((a, b) => a.start - b.start);
    let result = '';
    let lastEnd = 0;
    
    for (const hl of sorted) {
        // 텍스트 길이 초과 방지
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
    
    layer.innerHTML = result;
}

// CBS 중첩 스택 파서
// {{ 와 }} 괄호 자체(각 2자)만 레벨별 색상 토큰으로 발행.
// 전체 span을 발행하면 outer가 inner를 포함해 기존 겹침 제거 로직에서
// inner가 버려지므로, 괄호 2자만 발행하여 겹침 없이 동작.
// 반환:[{start, end, type: 'cbs-lN', priority: 7}]
function parseCBS(text) {
    const CBS_COLORS = 5; // cbs-l0 ~ cbs-l4
    const result = [];
    const stack =[]; // 현재 중첩 깊이 추적 (열린 {{ 마다 push)

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
    // 닫히지 않은 {{ 는 무시 (크래시 없음)
    return result;
}

// 간단한 구문 강조 파서 (VS Code 스타일 + Markdown + RisuAI)
function highlightSyntax(text) {
    if (!text) return '';
    
    // 토큰 정의 (순서 중요)
    const tokens =[
        // Markdown Code Block (```...```)
        { type: 'code-block', regex: /```[\s\S]*?```/g },
        
        // Markdown Inline Code (`...`)
        { type: 'code-block', regex: /`[^`]+`/g },
        
        // Markdown Headers
        { type: 'title', regex: /^#{1,6}\s+.*$/gm },
        
        // Markdown Bold — 개행 제외, greedy 방지
        { type: 'bold', regex: /\*\*(?!\*)([^\n]*?)\*\*/g },
        
        // Markdown Italic — (?<!\*) / (?!\*) 로 ** 안의 * 를 잡지 않도록 방지
        // 예: **bold** 에서 *bold* 가 italic으로 오매칭 되는 문제 수정
        { type: 'italic', regex: /(?<!\*)\*(?!\*)([^\n*]*?)(?<!\*)\*(?!\*)/g },
        
        // Markdown Quote
        { type: 'quote', regex: /^>.*$/gm },
        
        // Markdown List
        { type: 'list', regex: /^[\s-]*[-*+]\s+/gm },
        { type: 'list', regex: /^[\s-]*\d+\.\s+/gm },
        
        // Comments
        { type: 'comment', regex: /\/\/.*$/gm },
        { type: 'comment', regex: /\/\*[\s\S]*?\*\//g },
        { type: 'comment', regex: /<!--[\s\S]*?-->/g },
        
        // Strings — [^'\\] → [^'\\\n] : 개행 제외
        // 이유: Nun's 의 ' 에서 다음 apostrophe 까지 여러 줄 전체가
        //       오렌지(string)로 칠해지는 false positive 수정
        { type: 'string', regex: /"(?:[^"\\\n]|\\.)*"/g },
        { type: 'string', regex: /'(?:[^'\\\n]|\\.)*'/g },
        
        // Numbers
        { type: 'number', regex: /\b\d+(\.\d+)?\b/g },
        
        // Keywords (Javascript-ish)
        { type: 'keyword', regex: /\b(function|return|var|let|const|if|else|for|while|class|this|new|import|export|async|await)\b/g },
        
        // Booleans
        { type: 'boolean', regex: /\b(true|false|null|undefined)\b/g },
        
        // HTML Tags (simple)
        { type: 'tag', regex: /<\/?[a-zA-Z][a-zA-Z0-9]*.*?>/g },
    ];
    
    // 하이라이트 적용을 위한 마킹
    let highlights =[];
    
    tokens.forEach(token => {
        let match;
        // 정규식 초기화
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
    
    // 우선순위: code-block > comment > string > CBS > others
    function getPriority(type) {
        if (type === 'code-block') return 10;
        if (type === 'comment') return 9;
        if (type === 'string') return 8;
        if (type.startsWith('cbs-l')) return 7; // CBS 레벨별 색상
        if (type === 'tag') return 6;
        return 1;
    }
    
    // CBS 스택 파서 결과 추가
    const cbsTokens = parseCBS(text);
    highlights.push(...cbsTokens);
    
    // 겹치는 하이라이트 제거 (우선순위 기반)
    highlights.sort((a, b) => a.start - b.start || b.priority - a.priority);
    
    let merged =[];
    let lastEnd = 0;
    
    for (const hl of highlights) {
        if (hl.start >= lastEnd) {
            merged.push(hl);
            lastEnd = hl.end;
        }
    }
    
    // HTML 생성
    let result = '';
    let currentIndex = 0;
    
    merged.forEach(hl => {
        // 하이라이트 이전 텍스트
        if (hl.start > currentIndex) {
            result += escapeHtml(text.substring(currentIndex, hl.start));
        }
        
        // 하이라이트 텍스트
        const content = escapeHtml(text.substring(hl.start, hl.end));
        result += `<span class="token ${hl.type}">${content}</span>`;
        
        currentIndex = hl.end;
    });
    
    // 남은 텍스트
    if (currentIndex < text.length) {
        result += escapeHtml(text.substring(currentIndex));
    }
    
    return result;
}

// 겹치는 하이라이트 병합
function mergeHighlights(highlights) {
    if (!highlights || highlights.length === 0) return [];
    
    // 시작 위치로 정렬
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    const merged =[];
    let current = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        
        if (current.end >= next.start) {
            // 겹치거나 인접한 경우 병합
            current.end = Math.max(current.end, next.end);
        } else {
            // 겹치지 않으면 현재 하이라이트 저장 후 교체
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    
    return merged;
}

// 토스트 알림
function showToast(message) {
    // 기존 토스트 제거
    document.querySelector('.te-toast')?.remove();
    
    const toast = document.createElement('div');
    toast.className = 'te-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// textarea 식별용 ID 생성
function generateTargetId(target, title) {
    // 제목과 내용 일부를 조합해서 고유 ID 생성
    const titlePart = title.replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 20);
    const content = getTargetValue(target);
    const contentPart = (content || '').slice(0, 50).replace(/[^a-zA-Z0-9가-힣]/g, '');
    return `te-hl-${titlePart}-${contentPart.slice(0, 20)}`;
}

// 하이라이트 저장
function saveHighlights() {
    if (!teCurrentTargetId) return;
    
    if (teHighlights.length > 0) {
        teHighlightsStore[teCurrentTargetId] = teHighlights;
    } else {
        delete teHighlightsStore[teCurrentTargetId];
    }
    
    // 50개 이상이면 오래된 것 정리
    const keys = Object.keys(teHighlightsStore);
    if (keys.length > 50) {
        delete teHighlightsStore[keys[0]];
    }
    
    localStorage.setItem('te-highlights-store', JSON.stringify(teHighlightsStore));
}

// 토큰 수 추정 (cl100k_base 기반 - GPT-4/3.5 통계적 근사)
function estimateTokens(text) {
    if (!text) return 0;
    
    // RisuAI의 토큰 계산과 다를 수 있으므로, 사용자 혼란을 방지하기 위해
    // 정확한 계산이 불가능한 경우 표시하지 않거나, 매우 단순한 근사치만 제공합니다.
    // 여기서는 기존 로직을 유지하되, UI에서 제거하는 방향으로 수정되었습니다.
    // (UI 수정 부분에서 호출되지 않도록 변경됨)
    
    return 0; 
    
    /* 기존 로직 주석 처리
    // 복잡한 파싱 대신 통계적 근사치를 사용합니다.
    // cl100k_base에서:
    // - 영어/숫자/기호 등은 평균적으로 3.5~4글자당 1토큰입니다.
    // - 한글/한자 등 CJK 문자는 평균적으로 1글자당 2토큰 정도입니다.
    
    // 1. CJK 문자 추출 (한글, 한자, 히라가나/가타카나)
    const cjkMatches = text.match(/[\u4e00-\u9fa5\uac00-\ud7a3\u3040-\u30ff]/g);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;
    
    // 2. 비-CJK 문자 길이 (전체 길이 - CJK 개수)
    // 줄바꿈은 별도 토큰으로 계산하는 것이 정확도가 높음
    const newlines = (text.match(/\n/g) ||[]).length;
    const nonCjkLength = text.length - cjkCount - newlines;
    
    // 토큰 계산
    // - CJK: 글자당 2토큰 (가중치)
    // - 비-CJK: 글자당 0.27토큰 (약 3.7글자당 1토큰)
    // - 줄바꿈: 1토큰
    // + 기본 1토큰 (BOS 등)
    
    const tokenCount = Math.ceil((cjkCount * 2) + (nonCjkLength * 0.27) + newlines + 1);
    return tokenCount;
    */
}

// 메모 저장
function saveMemos() {
    localStorage.setItem('te-memos', JSON.stringify(teMemos));
}

// 메모 리스트 렌더링
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
    
    // 이벤트 바인딩
    list.querySelectorAll('.te-memo-item').forEach(item => {
        const memoId = parseInt(item.dataset.memoId);
        const memo = teMemos.find(m => m.id === memoId);
        if (!memo) return;
        
        // 토글
        item.querySelector('.te-memo-item-header').onclick = (e) => {
            if (e.target.closest('.te-memo-item-actions')) return;
            memo.open = !memo.open;
            item.classList.toggle('open', memo.open);
            saveMemos();
            // 타이틀 업데이트
            const titleEl = item.querySelector('.te-memo-item-title');
            const displayTitle = memo.name || (memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모');
            titleEl.textContent = displayTitle;
            titleEl.classList.toggle('placeholder', !memo.name && !memo.content);
        };
        
        // 이름 변경
        item.querySelector('.te-memo-item-name').oninput = (e) => {
            memo.name = e.target.value;
            saveMemos();
            const titleEl = item.querySelector('.te-memo-item-title');
            const displayTitle = memo.name || (memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모');
            titleEl.textContent = displayTitle;
            titleEl.classList.toggle('placeholder', !memo.name && !memo.content);
        };
        
        // 내용 변경
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
        
        // 복사
        item.querySelector('.te-memo-copy').onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(memo.content || '').then(() => {
                showToast('메모가 복사되었습니다');
            });
        };
        
        // 붙여넣기
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
                
                // 타이틀 업데이트
                if (!memo.name) {
                    const titleEl = item.querySelector('.te-memo-item-title');
                    const displayTitle = memo.content ? memo.content.split('\n')[0].slice(0, 30) : '빈 메모';
                    titleEl.textContent = displayTitle;
                }
            } catch (err) {
                showToast('클립보드 접근 권한이 필요합니다');
            }
        };
        
        // 삭제
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

// 마크다운 정리 (**만 제거)
function cleanMarkdown(text) {
    // **bold** 표시만 제거 (내용은 유지)
    return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

// ============================================
// 에디터 감지 및 버튼 추가 (Textarea + CodeMirror)
// ============================================

function getTargetTitle(target) {
    // 라벨이나 주변 텍스트에서 제목 추출 시도
    const parent = target.closest('.flex-col, .flex, div');
    if (parent) {
        const label = parent.querySelector('span, label');
        if (label && label.textContent?.trim()) {
            return label.textContent.trim();
        }
    }
    
    // placeholder에서 추출
    if (target.placeholder) {
        return target.placeholder.slice(0, 30);
    }
    
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

function shouldAddButton(target) {
    // 이미 버튼이 있는지 확인
    if (target.dataset.teProcessed) return false;

    // -----[채팅화면(메시지 내부 / 하단 입력창) 제외 필터] -----
    // RisuAI의 메시지 영역 및 채팅 관련 폼을 감지하기 위한 공통 클래스 및 ID 검사
    const isChatArea = target.closest('.mes, .msg, .message, .chat-message, [data-message-id], [data-message_id], #chat-textarea-container, .chat-form');
    if (isChatArea) return false;

    // 타겟 요소 자체가 채팅 입력창인지 검사
    if (target.id && (target.id === 'chat-textarea' || target.id === 'chat-input' || target.id === 'input-text')) {
        return false;
    }
    // -----------------------------------------------------------
    
    if (target.tagName && target.tagName.toLowerCase() === 'textarea') {
        // 모달 내의 에디터는 제외 (중복 생성 방지)
        if (target.classList.contains('te-textarea') || target.id === 'te-editor') return false;
        
        // 너무 작은 textarea 제외 (채팅 입력창 등)
        const rect = target.getBoundingClientRect();
        if (rect.height < 60) return false;
        
        const style = window.getComputedStyle(target);
        const minHeight = parseInt(style.minHeight) || 0;
        const rows = target.rows || 1;
        
        if (rows >= 3 || minHeight >= 80 || rect.height >= 100) {
            return true;
        }
    } else if (target.classList && target.classList.contains('cm-editor')) {
        const rect = target.getBoundingClientRect();
        // CodeMirror 에디터도 너무 작으면 제외
        if (rect.height < 60) return false;
        return true;
    }
    
    return false;
}

function addExpandButton(target) {
    if (target.dataset.teProcessed) return;
    target.dataset.teProcessed = 'true';
    
    const btn = document.createElement('button');
    btn.className = 'te-expand-btn';
    btn.innerHTML = TE_ICON.expand;
    btn.title = '확대 편집 (렉 없이 편집)';
    btn.type = 'button';
    
    // 클릭/터치 핸들러
    const handleOpen = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const title = getTargetTitle(target);
        openExpandModal(target, title);
    };
    
    btn.onclick = handleOpen;
    btn.ontouchend = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleOpen(e);
    };
    
    if (target.classList && target.classList.contains('cm-editor')) {
        // CodeMirror는 보통 자체적으로 상대 좌표를 가지며 컨테이너 역할을 함
        target.appendChild(btn);
    } else {
        // textarea의 부모를 relative로 설정
        const parent = target.parentElement;
        if (!parent) return;
        
        // 부모가 이미 position이 있으면 유지, 없으면 relative 추가
        const parentPos = window.getComputedStyle(parent).position;
        if (parentPos === 'static') {
            parent.style.position = 'relative';
        }
        // textarea 다음에 버튼 삽입
        parent.appendChild(btn);
    }
}

function scanTargets() {
    const targets = document.querySelectorAll('textarea:not([data-te-processed]), .cm-editor:not([data-te-processed])');
    targets.forEach(target => {
        if (shouldAddButton(target)) {
            addExpandButton(target);
        } else {
            target.dataset.teProcessed = 'skip';
        }
    });
}

// ============================================
// 관찰자 & 초기화
// ============================================

let teObserver = null;

function observe() {
    if (teObserver) teObserver.disconnect();
    
    teObserver = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            // 디바운스
            clearTimeout(observe.timeout);
            observe.timeout = setTimeout(scanTargets, 300);
        }
    });
    
    teObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
}

function init() {
    console.log('[Text Expander] v1 시작...');
    setTimeout(() => {
        scanTargets();
        observe();
        console.log('[Text Expander] 준비됨');
    }, 1500);
}

onUnload(() => {
    if (teObserver) teObserver.disconnect();
    document.getElementById('te-style')?.remove();
    document.getElementById('te-overlay')?.remove();
    document.getElementById('te-modal')?.remove();
    
    // 추가된 버튼들 제거
    document.querySelectorAll('.te-expand-btn').forEach(btn => btn.remove());
    
    // processed 플래그 제거
    document.querySelectorAll('[data-te-processed]').forEach(el => {
        delete el.dataset.teProcessed;
    });
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}