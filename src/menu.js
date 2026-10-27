import { Menu, Submenu, MenuItem, CheckMenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { t } from "./i18n.js";

// 단축키는 main.js 의 keydown 처리기가 담당한다. 메뉴에는 안내용 글자만 붙여서
// (가속키를 등록하지 않아) 한 번 누르면 두 번 실행되는 일이 없게 한다.
const label = (text, shortcut) => (shortcut ? `${text}\t${shortcut}` : text);

/**
 * 창 위쪽 메뉴줄(파일/편집/본문/서식/보기/테마/도움말)을 만든다.
 * 언어를 바꾸면 다시 불러서 새 메뉴로 바꾼다.
 * @param {import("@tauri-apps/api/window").Window} win
 * @param {Record<string, (...args: any[]) => void>} on  메뉴 항목이 부를 동작
 * @param {{ sidebar: boolean, source: boolean, theme: "system" | "light" | "dark", lang: "ko" | "en" }} initial
 */
export async function installMenu(win, on, initial) {
  const item = (key, shortcut, action) => MenuItem.new({ text: label(t(key), shortcut), action });
  const sep = () => PredefinedMenuItem.new({ item: "Separator" });
  // 편집 기본 항목(실행 취소·복사 등)은 Windows 가 키 입력을 그대로 편집기에 보내 준다.
  const edit = (kind, key) => PredefinedMenuItem.new({ item: kind, text: t(key) });

  const sidebarItem = await CheckMenuItem.new({
    text: label(t("menu.sidebar"), "Ctrl+\\"),
    checked: initial.sidebar,
    action: () => on.toggleSidebar(),
  });
  const sourceItem = await CheckMenuItem.new({
    text: label(t("menu.source"), "Ctrl+/"),
    checked: initial.source,
    action: () => on.toggleMode(),
  });
  const themeItems = {
    system: await CheckMenuItem.new({ text: t("menu.themeSystem"), checked: initial.theme === "system", action: () => on.setTheme("system") }),
    light: await CheckMenuItem.new({ text: t("menu.themeLight"), checked: initial.theme === "light", action: () => on.setTheme("light") }),
    dark: await CheckMenuItem.new({ text: t("menu.themeDark"), checked: initial.theme === "dark", action: () => on.setTheme("dark") }),
  };
  // 언어 이름은 어느 언어에서나 그 언어로 쓴다.
  const langItems = {
    ko: await CheckMenuItem.new({ text: "한국어", checked: initial.lang === "ko", action: () => on.setLanguage("ko") }),
    en: await CheckMenuItem.new({ text: "English", checked: initial.lang === "en", action: () => on.setLanguage("en") }),
  };

  const menu = await Menu.new({
    items: [
      await Submenu.new({
        text: t("menu.file"),
        items: [
          await item("menu.newDoc", "Ctrl+N", on.newDocument),
          await item("menu.open", "Ctrl+O", on.openFile),
          await item("menu.openFolder", "Ctrl+Shift+O", on.openFolder),
          await sep(),
          await item("menu.save", "Ctrl+S", on.save),
          await item("menu.saveAs", "Ctrl+Shift+S", on.saveAs),
          await sep(),
          await Submenu.new({
            text: t("menu.export"),
            items: [
              await MenuItem.new({ text: "PDF", action: () => on.exportAs("pdf") }),
              await MenuItem.new({ text: "HTML", action: () => on.exportAs("html") }),
              await item("menu.exportImage", null, () => on.exportAs("image")),
              await sep(),
              await MenuItem.new({ text: "Word (.docx)", action: () => on.exportAs("docx") }),
              await MenuItem.new({ text: "RTF", action: () => on.exportAs("rtf") }),
              await item("menu.exportTxt", null, () => on.exportAs("txt")),
            ],
          }),
          await item("menu.print", "Ctrl+P", on.print),
          await sep(),
          await item("menu.close", "Alt+F4", on.close),
        ],
      }),
      await Submenu.new({
        text: t("menu.edit"),
        items: [
          await edit("Undo", "menu.undo"),
          await edit("Redo", "menu.redo"),
          await sep(),
          await edit("Cut", "menu.cut"),
          await edit("Copy", "menu.copy"),
          await edit("Paste", "menu.paste"),
          await sep(),
          await edit("SelectAll", "menu.selectAll"),
        ],
      }),
      await Submenu.new({
        text: t("menu.paragraph"),
        items: [
          ...(await Promise.all([1, 2, 3, 4, 5, 6].map((n) =>
            MenuItem.new({ text: label(t("menu.heading", { n }), `Ctrl+${n}`), action: () => on.heading(n) })))),
          await item("menu.body", "Ctrl+0", () => on.heading(0)),
          await sep(),
          await item("menu.table", "Ctrl+T", on.table),
          await item("menu.codeBlock", "Ctrl+Shift+K", on.codeBlock),
          await item("menu.mathBlock", "Ctrl+Shift+M", on.mathBlock),
          await item("menu.quote", "Ctrl+Shift+Q", on.quote),
          await sep(),
          await item("menu.ol", "Ctrl+Shift+[", on.orderedList),
          await item("menu.ul", "Ctrl+Shift+]", on.bulletList),
          await item("menu.task", null, on.taskList),
          await sep(),
          await item("menu.hr", null, on.hr),
        ],
      }),
      await Submenu.new({
        text: t("menu.format"),
        items: [
          await item("menu.bold", "Ctrl+B", on.bold),
          await item("menu.italic", "Ctrl+I", on.italic),
          await item("menu.underline", "Ctrl+U", on.underline),
          await item("menu.strike", "Alt+Shift+5", on.strike),
          await item("menu.inlineCode", "Ctrl+Shift+`", on.inlineCode),
          await sep(),
          await item("menu.link", "Ctrl+K", on.link),
          await item("menu.image", "Ctrl+Shift+I", on.image),
        ],
      }),
      await Submenu.new({
        text: t("menu.view"),
        items: [
          sidebarItem,
          sourceItem,
          await sep(),
          await item("menu.refresh", null, on.refreshTree),
          await item("menu.fullscreen", "F11", on.toggleFullscreen),
          await sep(),
          await Submenu.new({ text: t("menu.language"), items: [langItems.ko, langItems.en] }),
        ],
      }),
      await Submenu.new({
        text: t("menu.theme"),
        items: [themeItems.system, await sep(), themeItems.light, themeItems.dark],
      }),
      await Submenu.new({
        text: t("menu.help"),
        items: [
          await item("menu.shortcuts", null, on.showShortcuts),
          await sep(),
          await item("menu.about", null, on.showAbout),
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
