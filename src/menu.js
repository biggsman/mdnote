import { Menu, Submenu, MenuItem, CheckMenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";

// 단축키는 main.js 의 keydown 처리기가 담당한다. 메뉴에는 안내용 글자만 붙여서
// (가속키를 등록하지 않아) 한 번 누르면 두 번 실행되는 일이 없게 한다.
const label = (text, shortcut) => (shortcut ? `${text}\t${shortcut}` : text);

/**
 * 창 위쪽 메뉴줄(파일/편집/보기/테마/도움말)을 만든다.
 * @param {import("@tauri-apps/api/window").Window} win
 * @param {Record<string, () => void>} on  메뉴 항목이 부를 동작
 * @param {{ sidebar: boolean, source: boolean, theme: "system" | "light" | "dark" }} initial
 */
export async function installMenu(win, on, initial) {
  const item = (text, shortcut, action) => MenuItem.new({ text: label(text, shortcut), action });
  const sep = () => PredefinedMenuItem.new({ item: "Separator" });
  // 편집 기본 항목(실행 취소·복사 등)은 Windows 가 키 입력을 그대로 편집기에 보내 준다.
  const edit = (kind, text) => PredefinedMenuItem.new({ item: kind, text });

  const sidebarItem = await CheckMenuItem.new({
    text: label("사이드바", "Ctrl+\\"),
    checked: initial.sidebar,
    action: () => on.toggleSidebar(),
  });
  const sourceItem = await CheckMenuItem.new({
    text: label("원문 모드", "Ctrl+/"),
    checked: initial.source,
    action: () => on.toggleMode(),
  });
  const themeItems = {
    system: await CheckMenuItem.new({ text: "시스템 설정 따르기", checked: initial.theme === "system", action: () => on.setTheme("system") }),
    light: await CheckMenuItem.new({ text: "밝게", checked: initial.theme === "light", action: () => on.setTheme("light") }),
    dark: await CheckMenuItem.new({ text: "어둡게", checked: initial.theme === "dark", action: () => on.setTheme("dark") }),
  };

  const menu = await Menu.new({
    items: [
      await Submenu.new({
        text: "파일(&F)",
        items: [
          await item("새 문서 (새 창)", "Ctrl+N", on.newDocument),
          await item("열기...", "Ctrl+O", on.openFile),
          await item("폴더 열기...", "Ctrl+Shift+O", on.openFolder),
          await sep(),
          await item("저장", "Ctrl+S", on.save),
          await item("다른 이름으로 저장...", "Ctrl+Shift+S", on.saveAs),
          await sep(),
          await item("인쇄...", "Ctrl+P", on.print),
          await sep(),
          await item("닫기", "Alt+F4", on.close),
        ],
      }),
      await Submenu.new({
        text: "편집(&E)",
        items: [
          await edit("Undo", "실행 취소"),
          await edit("Redo", "다시 실행"),
          await sep(),
          await edit("Cut", "잘라내기"),
          await edit("Copy", "복사"),
          await edit("Paste", "붙여넣기"),
          await sep(),
          await edit("SelectAll", "모두 선택"),
        ],
      }),
      await Submenu.new({
        text: "보기(&V)",
        items: [
          sidebarItem,
          sourceItem,
          await sep(),
          await item("사이드바 새로 고침", null, on.refreshTree),
          await item("전체 화면", "F11", on.toggleFullscreen),
        ],
      }),
      await Submenu.new({
        text: "테마(&T)",
        items: [themeItems.system, await sep(), themeItems.light, themeItems.dark],
      }),
      await Submenu.new({
        text: "도움말(&H)",
        items: [
          await item("단축키 목록", null, on.showShortcuts),
          await sep(),
          await item("MdNote 정보", null, on.showAbout),
        ],
      }),
    ],
  });
  await menu.setAsWindowMenu(win);

  // 단축키나 버튼으로 상태가 바뀌었을 때 메뉴의 체크 표시를 맞춘다.
  return {
    setSidebar: (on_) => sidebarItem.setChecked(on_).catch(() => {}),
    setSource: (on_) => sourceItem.setChecked(on_).catch(() => {}),
    setTheme: (theme) => {
      for (const [key, it] of Object.entries(themeItems)) it.setChecked(key === theme).catch(() => {});
    },
  };
}
