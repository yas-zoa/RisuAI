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

## 이 포크의 추가 기능 (yas-zoa)

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
- 입력 지연을 줄이는 debounce 처리

### 캔버스 팝업 에디터

긴 텍스트를 편집할 때 데스크톱에서는 우클릭 컨텍스트메뉴, 모바일에서는 롱프레스로 전체 화면 팝업 에디터를 열 수 있습니다.

- 팝업을 닫을 때 원본 에디터의 커서 위치 보존
- CodeMirror 기본 검색 패널 (찾기·다음·이전)
- 사용자 지정 하이라이트: 텍스트 구간을 직접 표시하고 다음 하이라이트로 이동하거나 전부 해제 가능 (하이라이트는 문서별로 저장)
- 본문 전체 복사 버튼 + 결과 토스트 알림
- ESC 처리, aria-label 등 키보드·스크린리더 접근성
- 팝업 전용 Catppuccin Mocha 거터 테마

### 사이드바 토글 타입 확장

사이드바 토글 구문(`parseToggleSyntax`)에서 사용할 수 있는 타입이 두 가지 추가되었습니다.

- `textarea`: 여러 줄 텍스트를 입력받는 토글 (기존 `text`의 멀티라인 버전)
- `caption`: 읽기 전용 설명 캡션. 토글 목록에 부연 설명 줄을 넣을 때 사용

## Discord

- https://discord.gg/JzP8tB9ZK8

## Installation

- [RisuAI Website](https://risuai.net) (Recommended)
- [Github Releases](https://github.com/kwaroran/RisuAI/releases)

### Docker Installation

You can also run RisuAI using Docker. This method is particularly useful for web hosting.

1. Run the Docker container:
   ```
   curl -L https://raw.githubusercontent.com/kwaroran/RisuAI/refs/heads/main/docker-compose.yml | docker compose -f - up -d
   ```

2. Access RisuAI at `http://localhost:6001` in your web browser.
