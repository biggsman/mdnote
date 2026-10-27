// 화면 문구 (한국어 / English)
// t("키", { 변수 }) 로 쓴다. 언어는 보기 → 언어 에서 바꾸고, 모든 창이 함께 따라간다.

export const LANG_KEY = "geuldam.lang";

const STRINGS = {
  ko: {
    app: "글담",
    untitled: "제목 없음",
    newDocStatus: "새 문서",
    unsaved: "● 저장 안 됨",
    modeIR: "IR",
    modeSource: "원문",
    modeTip: "Ctrl+/ 로 전환",
    chars: "{n}자",
    placeholder: "여기에 입력하세요…",
    allFiles: "모든 파일",
    images: "이미지",
    confirmSave: "'{name}'의 변경 내용을 저장할까요?\n저장하지 않으면 변경 내용이 사라집니다.",
    btnSave: "저장",
    btnDiscard: "저장 안 함",
    btnCancel: "취소",
    newWindowError: "새 창을 열 수 없습니다: {e}",
    nothingToPrint: "인쇄할 내용이 없습니다.",
    nothingToExport: "내보낼 내용이 없습니다.",
    exporting: "{label}(으)로 내보내는 중…",
    exported: "내보냈습니다.\n{path}",
    "export.pdf": "PDF",
    "export.html": "HTML",
    "export.image": "PNG 이미지",
    "export.docx": "Word 문서",
    "export.rtf": "RTF 문서",
    "export.txt": "텍스트",
    "export.imageAlt": "[그림: {alt}]",
    outlineEmpty: "제목이 없습니다.<br />'# 제목' 형식으로 쓰면 여기에 표시됩니다.",
    openFolderButton: "폴더 열기...",
    openFolderTip: "폴더 열기 (Ctrl+Shift+O)",
    folderTip: "{path}\n클릭하면 다른 폴더를 엽니다 (Ctrl+Shift+O)",
    noFolder: "열린 폴더가 없음.",
    noMarkdown: ".md 파일이 없습니다.",
    tabFiles: "파일",
    tabOutline: "개요",
    resizerTip: "끌어서 너비 조절 (더블클릭: 기본값)",
    shortcutsTitle: "단축키 목록",
    shortcuts: `파일
  Ctrl+N\t새 문서 (새 창)
  Ctrl+O\t열기
  Ctrl+Shift+O\t폴더 열기
  Ctrl+S\t저장
  Ctrl+Shift+S\t다른 이름으로 저장
  Ctrl+P\t인쇄

보기
  Ctrl+/\tIR ↔ 원문 모드
  Ctrl+\\\t사이드바 보이기/숨기기
  F11\t전체 화면

편집
  Ctrl+Z / Ctrl+Y\t실행 취소 / 다시 실행
  Ctrl+B / Ctrl+I\t굵게 / 기울임

표 (표 안에서)
  Ctrl+Enter\t아래에 행 삽입
  Alt+방향키\t행·열 이동`,
    aboutTitle: "글담 정보",
    about: "글담 {version}\n\nTypora 스타일 마크다운 편집기\nTauri · Vditor 기반\n\n만든 사람: biggsman\nhttps://github.com/biggsman",

    "menu.file": "파일(&F)",
    "menu.newDoc": "새 문서 (새 창)",
    "menu.open": "열기...",
    "menu.openFolder": "폴더 열기...",
    "menu.save": "저장",
    "menu.saveAs": "다른 이름으로 저장...",
    "menu.export": "내보내기",
    "menu.exportImage": "이미지",
    "menu.exportTxt": "텍스트 (.txt)",
    "menu.print": "인쇄...",
    "menu.close": "닫기",
    "menu.edit": "편집(&E)",
    "menu.undo": "실행 취소",
    "menu.redo": "다시 실행",
    "menu.cut": "잘라내기",
    "menu.copy": "복사",
    "menu.paste": "붙여넣기",
    "menu.selectAll": "모두 선택",
    "menu.paragraph": "본문(&P)",
    "menu.heading": "제목 {n}",
    "menu.body": "본문 (제목 해제)",
    "menu.table": "표 삽입",
    "menu.codeBlock": "코드 블록",
    "menu.mathBlock": "수식 블록",
    "menu.quote": "인용",
    "menu.ol": "번호 목록",
    "menu.ul": "글머리 기호 목록",
    "menu.task": "할 일 목록",
    "menu.hr": "구분선",
    "menu.format": "서식(&O)",
    "menu.bold": "굵게",
    "menu.italic": "기울임",
    "menu.underline": "밑줄",
    "menu.strike": "취소선",
    "menu.inlineCode": "인라인 코드",
    "menu.link": "링크",
    "menu.image": "이미지...",
    "menu.view": "보기(&V)",
    "menu.sidebar": "사이드바",
    "menu.source": "원문 모드",
    "menu.refresh": "사이드바 새로 고침",
    "menu.fullscreen": "전체 화면",
    "menu.language": "언어 (Language)",
    "menu.theme": "테마(&T)",
    "menu.themeSystem": "시스템 설정 따르기",
    "menu.themeLight": "밝게",
    "menu.themeDark": "어둡게",
    "menu.help": "도움말(&H)",
    "menu.shortcuts": "단축키 목록",
    "menu.about": "글담 정보",

    "table.resize": "표 크기 조정",
    "table.alignLeft": "왼쪽 정렬",
    "table.alignCenter": "가운데 정렬",
    "table.alignRight": "오른쪽 정렬",
    "table.more": "더 많은 동작",
    "table.rowAbove": "앞에 행 삽입",
    "table.rowBelow": "뒤에 행 삽입",
    "table.colLeft": "앞에 열 삽입",
    "table.colRight": "뒤에 열 삽입",
    "table.rowUp": "행 위로 이동",
    "table.rowDown": "행 아래로 이동",
    "table.colMoveLeft": "열 왼쪽으로 이동",
    "table.colMoveRight": "열 오른쪽으로 이동",
    "table.deleteRow": "행 삭제",
    "table.deleteCol": "열 삭제",
    "table.copy": "표 복사",
    "table.pretty": "소스코드 이쁘게 하기",
    "table.deleteTable": "표 삭제",
    "table.cols": "열",
    "table.rows": "행",
  },

  en: {
    app: "Geuldam",
    untitled: "Untitled",
    newDocStatus: "New document",
    unsaved: "● Unsaved",
    modeIR: "IR",
    modeSource: "Source",
    modeTip: "Toggle with Ctrl+/",
    chars: "{n} chars",
    placeholder: "Start writing…",
    allFiles: "All files",
    images: "Images",
    confirmSave: "Save changes to '{name}'?\nYour changes will be lost if you don't save them.",
    btnSave: "Save",
    btnDiscard: "Don't Save",
    btnCancel: "Cancel",
    newWindowError: "Could not open a new window: {e}",
    nothingToPrint: "There is nothing to print.",
    nothingToExport: "There is nothing to export.",
    exporting: "Exporting to {label}…",
    exported: "Exported.\n{path}",
    "export.pdf": "PDF",
    "export.html": "HTML",
    "export.image": "PNG image",
    "export.docx": "Word document",
    "export.rtf": "RTF document",
    "export.txt": "Plain text",
    "export.imageAlt": "[Image: {alt}]",
    outlineEmpty: "No headings.<br />Lines written as '# Heading' appear here.",
    openFolderButton: "Open Folder...",
    openFolderTip: "Open Folder (Ctrl+Shift+O)",
    folderTip: "{path}\nClick to open another folder (Ctrl+Shift+O)",
    noFolder: "No folder open.",
    noMarkdown: "No .md files.",
    tabFiles: "Files",
    tabOutline: "Outline",
    resizerTip: "Drag to resize (double-click: default)",
    shortcutsTitle: "Keyboard Shortcuts",
    shortcuts: `File
  Ctrl+N\tNew (new window)
  Ctrl+O\tOpen
  Ctrl+Shift+O\tOpen Folder
  Ctrl+S\tSave
  Ctrl+Shift+S\tSave As
  Ctrl+P\tPrint

View
  Ctrl+/\tIR ↔ Source mode
  Ctrl+\\\tShow/hide sidebar
  F11\tFull screen

Edit
  Ctrl+Z / Ctrl+Y\tUndo / Redo
  Ctrl+B / Ctrl+I\tBold / Italic

Table (inside a table)
  Ctrl+Enter\tInsert row below
  Alt+Arrow keys\tMove row / column`,
    aboutTitle: "About Geuldam",
    about: "Geuldam {version}\n\nA Typora-style Markdown editor\nBuilt with Tauri · Vditor\n\nDeveloper: biggsman\nhttps://github.com/biggsman",

    "menu.file": "&File",
    "menu.newDoc": "New (New Window)",
    "menu.open": "Open...",
    "menu.openFolder": "Open Folder...",
    "menu.save": "Save",
    "menu.saveAs": "Save As...",
    "menu.export": "Export",
    "menu.exportImage": "Image",
    "menu.exportTxt": "Plain Text (.txt)",
    "menu.print": "Print...",
    "menu.close": "Close",
    "menu.edit": "&Edit",
    "menu.undo": "Undo",
    "menu.redo": "Redo",
    "menu.cut": "Cut",
    "menu.copy": "Copy",
    "menu.paste": "Paste",
    "menu.selectAll": "Select All",
    "menu.paragraph": "&Paragraph",
    "menu.heading": "Heading {n}",
    "menu.body": "Paragraph (No Heading)",
    "menu.table": "Insert Table",
    "menu.codeBlock": "Code Block",
    "menu.mathBlock": "Math Block",
    "menu.quote": "Quote",
    "menu.ol": "Numbered List",
    "menu.ul": "Bulleted List",
    "menu.task": "Task List",
    "menu.hr": "Horizontal Rule",
    "menu.format": "F&ormat",
    "menu.bold": "Bold",
    "menu.italic": "Italic",
    "menu.underline": "Underline",
    "menu.strike": "Strikethrough",
    "menu.inlineCode": "Inline Code",
    "menu.link": "Link",
    "menu.image": "Image...",
    "menu.view": "&View",
    "menu.sidebar": "Sidebar",
    "menu.source": "Source Mode",
    "menu.refresh": "Refresh Sidebar",
    "menu.fullscreen": "Full Screen",
    "menu.language": "Language (언어)",
    "menu.theme": "&Theme",
    "menu.themeSystem": "Follow System",
    "menu.themeLight": "Light",
    "menu.themeDark": "Dark",
    "menu.help": "&Help",
    "menu.shortcuts": "Keyboard Shortcuts",
    "menu.about": "About Geuldam",

    "table.resize": "Resize Table",
    "table.alignLeft": "Align Left",
    "table.alignCenter": "Align Center",
    "table.alignRight": "Align Right",
    "table.more": "More Actions",
    "table.rowAbove": "Insert Row Above",
    "table.rowBelow": "Insert Row Below",
    "table.colLeft": "Insert Column Before",
    "table.colRight": "Insert Column After",
    "table.rowUp": "Move Row Up",
    "table.rowDown": "Move Row Down",
    "table.colMoveLeft": "Move Column Left",
    "table.colMoveRight": "Move Column Right",
    "table.deleteRow": "Delete Row",
    "table.deleteCol": "Delete Column",
    "table.copy": "Copy Table",
    "table.pretty": "Tidy Source",
    "table.deleteTable": "Delete Table",
    "table.cols": "Columns",
    "table.rows": "Rows",
  },
};

function load() {
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

let lang = load();

export const getLang = () => lang;

/** 저장된 언어를 다시 읽는다. (다른 창에서 바꾼 경우) 바뀌었으면 true */
export function reloadLang() {
  const next = load();
  const changed = next !== lang;
  lang = next;
  return changed;
}

export function setLang(next) {
  lang = next === "en" ? "en" : "ko";
  try {
    if (lang === "ko") localStorage.removeItem(LANG_KEY);
    else localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* 무시 */
  }
}

/** 문구를 꺼낸다. {이름} 자리에 vars 값을 넣는다. */
export function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.ko[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
