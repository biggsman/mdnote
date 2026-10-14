# 글담 (Geuldam)

Typora 스타일의 가벼운 마크다운 편집기입니다.
[Tauri 2](https://tauri.app) + Vite(바닐라 JS)로 만들었습니다.
편집기는 [Vditor](https://github.com/Vanessa219/vditor) 3.11.3(MIT)의 소스를 가져와 `src/vditor` 에서 글담에 맞게 고쳐 씁니다.

## 기능

- 입력하는 즉시 서식이 반영되는 IR(Instant Rendering) 편집, `Ctrl+/`로 원문(마크다운 소스) 편집과 전환
- 새 문서(새 창으로 열려 여러 문서를 동시에 편집) / 열기 / 저장 / 다른 이름으로 저장
- 왼쪽 사이드바에 열린 파일이 있는 폴더의 `.md` 파일 트리 표시 (아래쪽 폴더 이름을 눌러 다른 폴더 열기)
- 제목 표시줄·상태 표시줄에 **저장 안 됨(●)** 표시, 새 문서/다른 파일 열기/창 닫기 전에 저장 여부 확인
- `.md`, `.markdown` 파일 연결 — 탐색기에서 더블클릭하면 글담으로 열림
- 인쇄 — 편집 화면 대신 문서 내용만 밝은 테마로 깔끔하게 인쇄 (PDF로 저장도 가능)
- 내보내기 — PDF, HTML(그림 포함 파일 하나), 이미지(PNG), Word(.docx), RTF
- 창 위쪽 메뉴줄: 파일(F) · 편집(E) · 본문(P) · 서식(O) · 보기(V) · 테마(T) · 도움말(H)
- 사이드바 탭: 파일(폴더 트리) / 개요(문서 제목 목록, 클릭하면 이동)
- 테마 선택: 시스템 설정 따르기 / 밝게 / 어둡게 (모든 창에 함께 적용)
- 파일·폴더를 창에 끌어다 놓아서 열기, 이미지를 끌어다 놓으면 그 위치에 삽입
- Windows 시스템 다크 모드를 자동으로 따라감
- Vditor 에셋을 앱에 포함해서 **인터넷 연결 없이** 동작 (한국어 UI)

### 단축키

| 단축키 | 동작 |
| --- | --- |
| `Ctrl+N` | 새 문서 (새 창) |
| `Ctrl+O` | 파일 열기 |
| `Ctrl+Shift+O` | 폴더 열기 (사이드바) |
| `Ctrl+S` | 저장 |
| `Ctrl+Shift+S` | 다른 이름으로 저장 |
| `Ctrl+P` | 인쇄 |
| `Ctrl+/` | IR ↔ 원문 모드 전환 |
| `Ctrl+\` | 사이드바 보이기/숨기기 |
| `F11` | 전체 화면 |
| `Ctrl+1`~`Ctrl+6` / `Ctrl+0` | 제목 1~6 / 본문 |
| `Ctrl+T` | 표 삽입 |
| `Ctrl+Shift+K` / `Ctrl+Shift+M` | 코드 블록 / 수식 블록 |
| `Ctrl+Shift+Q` | 인용 |
| `Ctrl+Shift+[` / `Ctrl+Shift+]` | 번호 목록 / 글머리 기호 목록 |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U` | 굵게 / 기울임 / 밑줄 |
| `Alt+Shift+5` | 취소선 |
| ``Ctrl+Shift+` `` | 인라인 코드 |
| `Ctrl+K` / `Ctrl+Shift+I` | 링크 / 이미지 |

## Windows에서 빌드하기

### 1. 준비물 설치 (처음 한 번만)

1. **Microsoft C++ Build Tools**
   - <https://visualstudio.microsoft.com/visual-cpp-build-tools/> 에서 설치 프로그램을 받아 실행합니다.
   - **"C++를 사용한 데스크톱 개발"** 워크로드를 체크하고 설치합니다.
2. **WebView2 런타임**
   - Windows 10(최신 업데이트)과 Windows 11에는 이미 설치되어 있습니다.
   - 없다면 <https://developer.microsoft.com/microsoft-edge/webview2/> 에서 "Evergreen Bootstrapper"를 설치합니다.
3. **Rust**
   - <https://www.rust-lang.org/ko/tools/install> 에서 `rustup-init.exe`를 받아 실행하고 기본값(1번)으로 설치합니다.
   - 설치 후 새 터미널에서 `rustc --version`이 나오면 됩니다.
4. **Node.js** (LTS, 20 이상)
   - <https://nodejs.org/ko> 에서 LTS 버전을 설치합니다.
   - 새 터미널에서 `node -v`, `npm -v`가 나오면 됩니다.
5. **Git** (소스를 받을 때 필요)
   - <https://git-scm.com/download/win>

> 설치 후에는 PowerShell(또는 터미널)을 **새로 열어야** PATH가 반영됩니다.

또는 `winget`으로 한 번에 설치할 수도 있습니다 (관리자 PowerShell):

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install Rustlang.Rustup
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

### 2. 소스 받기와 의존성 설치

```powershell
git clone https://github.com/biggsman/mdnote.git
cd mdnote
npm install
```

### 3. 개발 모드로 실행

```powershell
npm run tauri dev
```

처음에는 Rust 크레이트를 컴파일하느라 몇 분 걸립니다. 이후에는 빠르게 뜹니다.
`src/` 아래 파일을 고치면 창이 자동으로 새로 고쳐집니다.

### 문제 해결

- **`link.exe`를 찾을 수 없음** → C++ Build Tools의 "C++를 사용한 데스크톱 개발"이 설치되지 않은 것입니다. 1번을 다시 확인하세요.
- **`cargo`/`npm` 명령을 찾을 수 없음** → 터미널을 새로 열거나 재부팅합니다.
- **창이 하얗게만 나옴** → WebView2 런타임을 설치(또는 복구)합니다.
- **편집기가 뜨지 않음** → `public\vditor` 폴더가 있는지 확인합니다. 없다면 `npm run copy-vditor`를 실행합니다.

## 프로젝트 구조

```
mdnote/
├─ index.html              # 화면 뼈대 (사이드바 + 편집기 + 상태 표시줄)
├─ src/
│  ├─ main.js              # 파일 작업, 단축키, 사이드바, 개요, 인쇄
│  ├─ menu.js              # 창 메뉴줄
│  ├─ format.js            # 본문·서식 명령
│  ├─ style.css
│  └─ vditor/              # 편집기 소스 (Vditor 3.11.3 기반, 글담에서 고쳐 씀)
├─ scripts/copy-vditor.mjs # node_modules/vditor/dist → public/vditor/dist 복사
├─ vite.config.js
└─ src-tauri/
   ├─ src/lib.rs           # Rust 커맨드: 파일 읽기·쓰기, 폴더 트리, 시작 파일, 메뉴 열기
   ├─ tauri.conf.json      # 창, 번들(nsis/msi), 파일 연결 설정
   └─ capabilities/        # 권한 설정 (dialog 플러그인, 창 제목/닫기)
```

### 오프라인 에셋

Vditor는 기본적으로 CDN(unpkg)에서 lute 파서, 한국어 언어 팩, 아이콘, 테마 CSS 등을 불러옵니다.
`npm run dev`/`npm run build` 직전에 `scripts/copy-vditor.mjs`가 실행되어
`node_modules/vditor/dist`를 `public/vditor/dist`로 복사하고, 편집기는 `cdn: "/vditor"`로 이 로컬 에셋만 사용합니다.
`public/vditor`는 빌드 산출물이므로 Git에 올리지 않습니다.

### 리눅스에서 확인

```bash
# Tauri 빌드 의존성 (Debian/Ubuntu)
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev libssl-dev build-essential pkg-config

npm install
npm run build              # 프런트엔드 빌드
(cd src-tauri && cargo check)
```
