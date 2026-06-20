# RisuAI

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/kwaroran/RisuAI/assets/116663078/efbbfe78-65ad-43ef-89f8-36fa94826925">
  <img alt="text" src="https://github.com/kwaroran/RisuAI/assets/116663078/bc28e5a3-c6da-4a42-bfc1-f3ab3debdf65">
</picture>

[![Svelte](https://img.shields.io/badge/svelte-4-red?logo=svelte)](https://svelte.dev/) [![Typescript](https://img.shields.io/badge/typescript-5-blue?logo=typescript)](https://www.typescriptlang.org/) [![Tauri](https://img.shields.io/badge/tauri-1.5-%2324C8D8?logo=tauri)](https://tauri.app/)

RisuAI, or Risu for short, is a cross platform AI chatting software / web application with powerful features such as multiple API support, assets in the chat, regex functions and much more.

# Screenshots

|         Screenshot 1         |         Screenshot 2         |
| :--------------------------: | :--------------------------: |
| ![Screenshot 1][screenshot1] | ![Screenshot 2][screenshot2] |
| ![Screenshot 3][screenshot3] | ![Screenshot 4][screenshot4] |

[screenshot1]: https://github.com/kwaroran/RisuAI/assets/116663078/cccb9b33-5dbd-47d7-9c85-61464790aafe
[screenshot2]: https://github.com/kwaroran/RisuAI/assets/116663078/30d29f85-1380-4c73-9b82-1a40f2c5d2ea
[screenshot3]: https://github.com/kwaroran/RisuAI/assets/116663078/faad0de5-56f3-4176-b38e-61c2d3a8698e
[screenshot4]: https://github.com/kwaroran/RisuAI/assets/116663078/ef946882-2311-43e7-81e7-5ca2d484fa90

## Features

- **Multiple API Supports**: Supports OAI, Claude, Ooba, OpenRouter... and More!
- **Emotion Images**: Display the image of the current character, according to his/her expressions!
- **Group Chats**: Multiple characters in one chat.
- **Plugins**: Add your features and providers, and simply share.
- **Regex Script**: Modify model's output by regex, to make a custom GUI and others
- **Powerful Translators**: Automatically translate the input/output, so you can roleplay without knowing model's language.
- **Lorebook**: Also known as world infos or memory book, which can make character memorize more. 
- **Themes**: Choose it from 3 themes, Classic, WaifuLike, WaifuCut.
- **Powerful Prompting**: Change the prompting order easily, Impersonate inside prompts, Use conditions, variables... and more!
- **Customizable, Friendly UI**: Great Accessibility and mobile friendly
- **TTS**: Use TTS to make the output text into voice.
- **Additonal Assets**: Embed your images, audios and videos to bot, and make it display at chat or background!
- And More!

You can get detailed information on https://github.com/kwaroran/RisuAI/wiki (Work in Progress)

## 이 포크의 추가 기능

원본 RisuAI에 더해 이 포크에서 사용할 수 있는 기능입니다.

### 앱처럼 설치 가능 (PWA 지원)

모바일과 데스크톱 브라우저에서 "홈 화면에 추가" 또는 "앱으로 설치"로 설치하면 독립 실행 애플리케이션처럼 동작합니다.

- 서비스 워커 기반 오프라인 캐싱으로 빠른 재시작
- 설치/업데이트 수명주기 지원
- Chrome·Firefox 양쪽에서 아이콘·스크린샷이 올바르게 표시되도록 매니페스트 정리
- 설치된 PWA의 화면 방향은 기기의 OS 회전-잠금 설정을 그대로 따름 (회전 잠금이 켜져 있으면 회전하지 않고, 꺼져 있으면 자유롭게 회전)

### 문법 하이라이트 기반 에디터

프롬프트 설정, 캐릭터 설정, 로어북, 정규식 스크립트 등 주요 텍스트 입력창이 CodeMirror 기반 에디터로 전환되어 구문 강조와 함께 편집할 수 있습니다.

- CBS 키워드 (제어문·매크로) 컬러링
- XML 태그, 인라인 CSS, Markdown 강조
- 타이핑·스크롤 지연을 줄이기 위해 하이라이트 계산을 입력/스크롤 경로에서 분리 (스크롤 시 재파싱 없음, 타이핑 중 비차단 — 멈춘 뒤 따라옴)

### 캔버스 팝업 에디터

긴 텍스트를 편집할 때 데스크톱에서는 우클릭 컨텍스트메뉴, 모바일에서는 입력창 포커스 시 나타나는 확대(⤢) 버튼으로 전체 화면 팝업 에디터를 열 수 있습니다. (모바일 롱프레스는 네이티브 텍스트 선택/복사용으로 보존됩니다)

- 팝업을 닫을 때 원본 에디터의 커서 위치 보존
- CodeMirror 기본 검색 패널 (찾기·다음·이전)
- 되돌리기·다시 실행·전체 선택·붙여넣기 버튼 (CodeMirror 명령 직결)
- 자주 쓰는 문구를 메모로 저장해 본문에 삽입 (브라우저 로컬 저장)
- 본문 전체 복사 버튼 + 결과 토스트 알림
- ESC 처리, aria-label 등 키보드·스크린리더 접근성
- 팝업 전용 Catppuccin Mocha 거터 테마

### 사이드바 토글 타입 확장

사이드바 토글 구문(`parseToggleSyntax`)에서 사용할 수 있는 타입이 두 가지 추가되었습니다.

- `textarea`: 여러 줄 텍스트를 입력받는 토글 (기존 `text`의 멀티라인 버전)
- `caption`: 읽기 전용 설명 캡션. 토글 목록에 부연 설명 줄을 넣을 때 사용

## Installation

- [RisuAI Website](https://risuai.net) (Recommended)
- [Github Releases](https://github.com/yas-zoa/RisuAI/releases)

### Docker Installation

이 포크의 `docker-compose.yml`은 두 가지를 모두 지원합니다 — **미리 빌드된 이미지를 받기**(빠름)와 **소스에서 직접 빌드**(소스 수정 시). 먼저 저장소를 클론하세요:

```
git clone https://github.com/yas-zoa/RisuAI
cd RisuAI
```

**방법 A — 미리 빌드된 이미지 받기 (권장, 빠름)**

GitHub Actions가 `v*` 태그 push 시 `ghcr.io/yas-zoa/risuai:latest`(amd64+arm64)를 빌드해 둡니다. 빌드 없이 받아서 실행:
```
docker compose pull && docker compose up -d
```
> 이미지가 비공개면 먼저 `docker login ghcr.io` (GitHub PAT, `read:packages`)가 필요합니다. 공개로 전환했다면 인증 없이 받을 수 있습니다.

**방법 B — 소스에서 직접 빌드**

로컬 소스를 그대로 빌드해 실행 (코드를 수정했을 때):
```
docker compose up -d --build
```

그다음 웹 브라우저에서 `http://localhost:6001` 접속.

> 소스를 수정한 뒤에는 방법 B(`--build`)로 다시 빌드하세요. 그 외에는 방법 A로 최신 이미지를 받으면 됩니다.

### Termux (Android) 설치

안드로이드에서는 Docker를 쓰기 어려우니 Node로 직접 서버를 띄웁니다. 두 가지 방법이 있어요.

**방법 A — 미리 빌드된 서버 받기 (권장, 빌드 불필요)**

릴리스에 첨부된 `risuai-server-termux-*.tar.gz`에는 빌드 결과물(`dist/`)과 서버가 들어 있어, 무거운 빌드 없이 의존성 5개만 받으면 바로 실행됩니다.

```bash
pkg update && pkg install -y nodejs-lts
# 릴리스에서 tar.gz 다운로드 후
tar xzf risuai-server-termux-*.tar.gz && cd risuai-server
npm install express fast-json-patch node-html-parser fflate msgpackr
node server/node/server.cjs
```

그다음 브라우저에서 `http://localhost:6001` 접속. (인증서가 없으면 HTTP로 자동 동작합니다)

**방법 B — 소스에서 직접 빌드 (수정하려는 경우)**

빌드는 메모리를 많이 써서 RAM 여유가 있는 기기에서 권장합니다.

```bash
pkg update && pkg install -y nodejs-lts git
git clone https://github.com/yas-zoa/RisuAI && cd RisuAI
corepack enable && corepack install --global pnpm@10.28.0
pnpm install
# Termux에서 pnpm 실행 스크립트가 깨지면 vite를 node로 직접 호출:
NODE_OPTIONS="--max-old-space-size=6144" node node_modules/vite/bin/vite.js build
node server/node/server.cjs
```

> 빌드 중 메모리 부족(OOM)이 나면 `--max-old-space-size` 값을 기기 RAM에 맞춰 조정하세요.
> 포트는 `PORT` 환경변수로 바꿀 수 있습니다 (기본 6001).

### 기존 버전에서 업데이트

RisuAI 본체 데이터(캐릭터·챗·설정)는 **브라우저(IndexedDB)**에 있어 서버 교체와 무관하게 보존됩니다. 디스크 `save/` 폴더는 서버 계정·동기화를 쓸 때만 채워지며, 아래 방법은 그것도 보존합니다.

**Docker** — 이미지만 새로 받아 재기동:
```bash
docker compose pull && docker compose up -d
```
`save/`는 명명 볼륨(`risuai-save`)에 있어 컨테이너를 재생성해도 유지됩니다.

**Termux (prebuilt)** — 새 tar.gz를 **기존 폴더 위에 덮어** 풉니다:
```bash
cd ~                                        # risuai-server 의 상위 폴더에서
tar xzf risuai-server-termux-새버전.tar.gz   # dist·server 만 갱신됨
cd risuai-server
npm install express fast-json-patch node-html-parser fflate msgpackr
node server/node/server.cjs
```
`save/`·`node_modules/`는 아카이브에 없어 덮어쓰기로도 지워지지 않습니다. 단:
- `risuai-server` **안에서** 풀면 폴더가 중첩되니, 반드시 **상위 폴더에서** 풀거나 `--strip-components=1` 을 쓰세요.
- 옛 `dist/` 에셋 잔여물이 신경 쓰이면 풀기 전에 `rm -rf risuai-server/dist` (형제 폴더인 `save/`는 안 지워집니다).
- 걱정되면 미리 백업: `cp -r risuai-server/save ~/risu-save-backup`

**Termux (소스 빌드)** — 받아서 다시 빌드:
```bash
cd RisuAI && git pull
NODE_OPTIONS="--max-old-space-size=6144" node node_modules/vite/bin/vite.js build
node server/node/server.cjs
```