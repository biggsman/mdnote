// 편집기: Vditor 3.11.3 소스를 가져와 글담에 맞게 고쳐 쓰는 코드 (src/vditor)
import Vditor from "./vditor/index.ts";
import "./style.css";
import { invoke, isTauri, convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getVersion } from "@tauri-apps/api/app";
import { open as openDialog, save as saveDialog, message } from "@tauri-apps/plugin-dialog";
import { installMenu } from "./menu.js";
import { TOOLBAR_ITEMS, applyToolbar, applyHeading, wrapSelection, insertBlock } from "./format.js";
import { buildHtml, buildPng, markdownToDom, buildDocx, buildRtf } from "./export.js";

// scripts/copy-vditor.mjs 가 node_modules/vditor/dist 를 public/vditor/dist 로 복사한다.
const VDITOR_CDN = "/vditor";
const MD_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown"] },
  { name: "모든 파일", extensions: ["*"] },
];
const MD_EXT = /\.(md|markdown|mdown|mkd)$/i;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const IMAGE_EXT = new RegExp(`\\.(${IMAGE_EXTS.join("|")})$`, "i");
const SIDEBAR_KEY = "mdnote.sidebarHidden";
const SIDEBAR_PANEL_KEY = "mdnote.sidebarPanel"; // "files" | "outline"
// Alt+글자로 여는 메뉴 (파일·편집·본문·서식·보기·테마·도움말)
const MENU_KEYS = { KeyF: "f", KeyE: "e", KeyP: "p", KeyO: "o", KeyV: "v", KeyT: "t", KeyH: "h" };
const THEME_KEY = "mdnote.theme"; // "system" | "light" | "dark"
const SIDEBAR_WIDTH_KEY = "mdnote.sidebarWidth";
const SIDEBAR_DEFAULT_WIDTH = 180;
const SIDEBAR_MIN_WIDTH = 120;
const SIDEBAR_MAX_WIDTH = 480;

const state = {
  vditor: null,
  mode: "ir", // "ir" | "sv"(원문)
  filePath: null,
  savedContent: "",
  dirty: false,
  folder: null,
  expanded: new Set(),
  busy: false,
  /** 메뉴의 체크 표시를 맞추는 함수들 (Tauri 창에서만) */
  menu: null,
};

const $ = (id) => document.getElementById(id);
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const appWindow = isTauri() ? getCurrentWindow() : null;

const basename = (p) => p.split(/[\\/]/).pop();
const dirname = (p) => p.replace(/[\\/][^\\/]*$/, "");
const docName = () => (state.filePath ? basename(state.filePath) : "제목 없음");

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 무시 */
  }
}

/* ---------------- 편집기 ---------------- */

function themePref() {
  const t = storageGet(THEME_KEY);
  return t === "light" || t === "dark" ? t : "system";
}

function isDark() {
  const pref = themePref();
  return pref === "dark" || (pref === "system" && darkQuery.matches);
}

/** 테마 메뉴에서 고른 값을 저장하고 적용한다. 다른 창도 storage 이벤트로 따라온다. */
function setTheme(pref) {
  storageSet(THEME_KEY, pref === "system" ? null : pref);
  applyTheme();
}

function createEditor(value) {
  return new Promise((resolve) => {
    if (state.vditor) state.vditor.destroy();
    const dark = isDark();
    state.vditor = new Vditor("vditor", {
      cdn: VDITOR_CDN,
      lang: "ko_KR",
      mode: state.mode,
      value,
      height: "100%",
      width: "100%",
      theme: dark ? "dark" : "classic",
      placeholder: "여기에 입력하세요…",
      // 서식 명령용 툴바 (화면에는 CSS 로 숨김)
      toolbar: TOOLBAR_ITEMS,
      toolbarConfig: { hide: true },
      cache: { enable: false },
      counter: { enable: false },
      outline: { enable: false },
      tab: "    ",
      preview: {
        mode: "editor",
        maxWidth: 860,
        theme: {
          current: dark ? "dark" : "light",
          path: `${VDITOR_CDN}/dist/css/content-theme`,
        },
        hljs: { style: dark ? "github-dark" : "github", lineNumber: false },
        markdown: { toc: true, mark: true, footnotes: true, autoSpace: false },
        math: { engine: "KaTeX" },
      },
      input: onInput,
      after: () => {
        updateCount();
        resolve();
      },
    });
  });
}

function getValue() {
  return state.vditor ? state.vditor.getValue() : "";
}

/** 마지막 저장 이후 실제로 바뀐 내용이 있는지 확인한다. */
function computeDirty() {
  const value = getValue();
  // 저장한 적 없는 새 문서가 비어 있으면 저장할 내용이 없다.
  if (!state.filePath && value.trim() === "") return false;
  // Vditor 가 끝에 붙이는 줄바꿈 차이는 변경으로 보지 않는다.
  const trimEnd = (s) => s.replace(/\s+$/, "");
  return trimEnd(value) !== trimEnd(state.savedContent);
}

/** 현재 내용과 마지막 저장 내용을 비교해 '저장 안 됨' 상태를 갱신한다. */
function refreshDirty() {
  const dirty = computeDirty();
  if (dirty !== state.dirty) {
    state.dirty = dirty;
    updateTitle();
  }
  return dirty;
}

function onInput() {
  refreshDirty();
  updateCount();
  scheduleOutline();
}

// Vditor 의 input 콜백은 undoDelay 만큼 늦게 오므로 직접 입력 이벤트도 감시한다.
let inputTimer = 0;
function scheduleInputCheck() {
  clearTimeout(inputTimer);
  inputTimer = setTimeout(onInput, 150);
}

function setContent(markdown) {
  state.vditor.setValue(markdown, true);
  // Vditor(Lute)가 정규화한 값을 기준으로 저장 여부를 판단한다.
  state.savedContent = getValue();
  state.dirty = false;
  updateTitle();
  updateCount();
  renderOutline();
  state.vditor.focus();
}

async function toggleMode() {
  const value = getValue();
  const wasDirty = state.dirty;
  state.mode = state.mode === "ir" ? "sv" : "ir";
  await createEditor(value);
  // 모드 전환에 따른 정규화 차이만으로 '수정됨'이 되지 않도록 한다.
  if (!wasDirty) state.savedContent = getValue();
  else state.dirty = computeDirty();
  updateTitle();
  state.menu?.setSource(state.mode === "sv");
  renderOutline();
  state.vditor.focus();
}

function applyTheme() {
  const dark = isDark();
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  state.vditor?.setTheme(dark ? "dark" : "classic", dark ? "dark" : "light", dark ? "github-dark" : "github");
  // 창 제목 표시줄과 메뉴줄 색도 맞춘다.
  const pref = themePref();
  appWindow?.setTheme(pref === "system" ? null : pref).catch(() => {});
  state.menu?.setTheme(pref);
}

/* ---------------- 상태 표시 ---------------- */

function updateTitle() {
  const title = `${state.dirty ? "● " : ""}${docName()} - 글담`;
  document.title = title;
  appWindow?.setTitle(title).catch(() => {});
  $("status-path").textContent = state.filePath ?? "새 문서";
  $("status-path").title = state.filePath ?? "";
  $("status-dirty").textContent = state.dirty ? "● 저장 안 됨" : "";
  $("status-mode").textContent = state.mode === "ir" ? "IR" : "원문";
  highlightActive();
}

function updateCount() {
  const text = getValue();
  $("status-count").textContent = `${text.replace(/\s/g, "").length.toLocaleString()}자`;
}

async function showError(err) {
  const msg = typeof err === "string" ? err : (err?.message ?? String(err));
  console.error(err);
  if (isTauri()) await message(msg, { title: "글담", kind: "error" });
  else alert(msg);
}

/* ---------------- 파일 작업 ---------------- */

/** 저장되지 않은 변경이 있으면 묻는다. 계속 진행해도 되면 true. */
async function confirmDiscard() {
  if (!refreshDirty()) return true;
  const SAVE = "저장";
  const DISCARD = "저장 안 함";
  const answer = await message(`'${docName()}'의 변경 내용을 저장할까요?\n저장하지 않으면 변경 내용이 사라집니다.`, {
    title: "글담",
    kind: "warning",
    buttons: { yes: SAVE, no: DISCARD, cancel: "취소" },
  });
  if (answer === SAVE || answer === "Yes") return await saveFile();
  if (answer === DISCARD || answer === "No") return true;
  return false;
}

/** 동시에 대화상자가 여러 개 뜨지 않도록 한 번에 하나의 작업만 실행한다. */
function exclusive(fn) {
  return async (...args) => {
    if (state.busy) return;
    state.busy = true;
    try {
      return await fn(...args);
    } catch (err) {
      await showError(err);
    } finally {
      state.busy = false;
    }
  };
}

/** 새 문서는 새 창으로 연다. 각 창은 독립된 편집기다. */
async function newDocument() {
  if (!isTauri()) {
    window.open(location.href, "_blank");
    return;
  }
  const size = await appWindow.innerSize().then((s) => s.toLogical(window.devicePixelRatio)).catch(() => null);
  const win = new WebviewWindow(`doc-${Date.now()}`, {
    url: "index.html",
    title: "글담",
    width: size?.width ?? 825,
    height: size?.height ?? 760,
    minWidth: 480,
    minHeight: 320,
  });
  win.once("tauri://error", (e) => showError(`새 창을 열 수 없습니다: ${e.payload}`));
}

async function loadFile(path) {
  const content = await invoke("read_file", { path });
  state.filePath = path;
  setContent(content);
  // Typora 처럼 연 파일이 있는 폴더를 사이드바에 보여 준다. (이미 열린 폴더 안의 파일이면 그대로)
  if (!isInside(path, state.folder)) await setFolder(dirname(path), false).catch(() => {});
}

/** path 가 folder 안에 있는지 (대소문자·구분자 무시) */
function isInside(path, folder) {
  if (!path || !folder) return false;
  const norm = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(path).startsWith(`${norm(folder)}/`);
}

async function openFile() {
  if (!(await confirmDiscard())) return;
  const path = await openDialog({
    multiple: false,
    directory: false,
    filters: MD_FILTERS,
    defaultPath: state.filePath ? dirname(state.filePath) : (state.folder ?? undefined),
  });
  if (path) await loadFile(path);
}

async function openPath(path) {
  if (path === state.filePath) return;
  if (!(await confirmDiscard())) return;
  await loadFile(path);
}

async function writeTo(path) {
  const content = getValue();
  await invoke("write_file", { path, content });
  state.filePath = path;
  state.savedContent = content;
  state.dirty = computeDirty();
  updateTitle();
}

async function saveFile() {
  if (!state.filePath) return await saveFileAs();
  await writeTo(state.filePath);
  return true;
}

async function saveFileAs() {
  const base = state.filePath ? dirname(state.filePath) : state.folder;
  const name = state.filePath ? basename(state.filePath) : "제목 없음.md";
  let path = await saveDialog({
    filters: MD_FILTERS,
    defaultPath: base ? `${base}${base.includes("\\") ? "\\" : "/"}${name}` : name,
  });
  if (!path) return false;
  if (!/\.[^\\/.]+$/.test(path)) path += ".md";
  await writeTo(path);
  if (state.folder && path.startsWith(state.folder)) await refreshTree();
  return true;
}

/* ---------------- 인쇄 ---------------- */

/**
 * 편집 화면 대신 문서 내용만 밝은 테마로 렌더링해서 인쇄한다.
 * (코드 강조, 수식, 다이어그램 포함)
 */
async function printDocument() {
  const markdown = getValue();
  if (markdown.trim() === "") {
    await message("인쇄할 내용이 없습니다.", { title: "글담", kind: "info" });
    return;
  }
  await renderPrintArea(markdown);
  // 머리글에 찍히는 제목은 파일 이름만 쓴다.
  document.title = docName();
  document.body.classList.add("printing");
  window.print();
}

/** 문서를 인쇄·내보내기용(밝은 테마)으로 #print-area 에 그린다. */
async function renderPrintArea(markdown) {
  const area = $("print-area");
  await new Promise((resolve) => {
    Vditor.preview(area, markdown, {
      cdn: VDITOR_CDN,
      lang: "ko_KR",
      mode: "light",
      theme: { current: "light", path: `${VDITOR_CDN}/dist/css/content-theme` },
      hljs: { style: "github", lineNumber: false },
      markdown: { toc: true, mark: true, footnotes: true, autoSpace: false },
      math: { engine: "KaTeX" },
      after: resolve,
    });
  });
  // 코드 강조·수식 스크립트와 이미지가 그려질 시간을 준다.
  await Promise.all([
    document.fonts?.ready,
    ...[...area.querySelectorAll("img")].map((img) =>
      img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })),
    new Promise((r) => setTimeout(r, 500)),
  ]);
  return area;
}

/* ---------------- 내보내기 ---------------- */

const EXPORTS = {
  pdf: { ext: "pdf", label: "PDF" },
  html: { ext: "html", label: "HTML" },
  image: { ext: "png", label: "PNG 이미지" },
  docx: { ext: "docx", label: "Word 문서" },
  rtf: { ext: "rtf", label: "RTF 문서" },
};

/** 파일 → 내보내기. 문서와 같은 폴더·같은 이름을 기본값으로 묻는다. */
async function exportDocument(kind) {
  const spec = EXPORTS[kind];
  const markdown = getValue();
  if (markdown.trim() === "") {
    await message("내보낼 내용이 없습니다.", { title: "글담", kind: "info" });
    return;
  }
  const name = `${docName().replace(/\.[^.]+$/, "")}.${spec.ext}`;
  const base = state.filePath ? dirname(state.filePath) : state.folder;
  let path = await saveDialog({
    filters: [{ name: spec.label, extensions: [spec.ext] }],
    defaultPath: base ? `${base}${base.includes("\\") ? "\\" : "/"}${name}` : name,
  });
  if (!path) return;
  if (!path.toLowerCase().endsWith(`.${spec.ext}`)) path += `.${spec.ext}`;

  $("status-dirty").textContent = `${spec.label}(으)로 내보내는 중…`;
  try {
    if (kind === "docx" || kind === "rtf") {
      const body = await markdownToDom(Vditor, markdown, VDITOR_CDN);
      if (kind === "docx") await invoke("write_binary", { path, data: await buildDocx(body, localImagePath) });
      else await invoke("write_file", { path, content: await buildRtf(body, localImagePath) });
    } else {
      const area = await renderPrintArea(markdown);
      try {
        if (kind === "pdf") {
          await invoke("export_pdf", { path });
        } else if (kind === "html") {
          await invoke("write_file", { path, content: await buildHtml(area, docName(), localImagePath) });
        } else {
          area.classList.add("exporting");
          await new Promise((r) => requestAnimationFrame(r));
          await invoke("write_binary", { path, data: await buildPng(area) });
        }
      } finally {
        area.classList.remove("exporting");
        finishPrint();
      }
    }
  } finally {
    updateTitle();
  }
  await message(`내보냈습니다.\n${path}`, { title: "글담", kind: "info" });
}

function finishPrint() {
  document.body.classList.remove("printing");
  $("print-area").textContent = "";
  // 인쇄용 밝은 테마로 바뀐 내용·코드 테마를 화면 테마로 되돌린다.
  applyTheme();
  updateTitle();
}

/* ---------------- 개요(목차) ---------------- */

/** 편집기 화면에서 제목 요소를 찾는다. (IR 모드는 h1~h6, 원문 모드는 '#' 표시가 있는 줄) */
function findHeadings() {
  const root = state.vditor?.vditor?.element;
  if (!root) return [];
  if (state.mode === "sv") {
    return [...root.querySelectorAll('.vditor-sv [data-type="heading-marker"]')].map((marker) => {
      const line = marker.parentElement;
      const copy = line.cloneNode(true);
      copy.querySelectorAll('[class*="vditor-sv__marker"]').forEach((m) => m.remove());
      const level = (marker.textContent.match(/#/g) || []).length || 1;
      return { el: line, level, text: copy.textContent.trim() };
    });
  }
  return [...root.querySelectorAll(".vditor-ir .vditor-reset :is(h1, h2, h3, h4, h5, h6)")]
    .filter((h) => !h.closest(".vditor-ir__preview"))
    .map((h) => {
      const copy = h.cloneNode(true);
      copy.querySelectorAll(".vditor-ir__marker").forEach((m) => m.remove());
      return { el: h, level: Number(h.tagName[1]), text: copy.textContent.trim() };
    });
}

let outlineHeadings = [];
let outlineTimer = 0;

function scheduleOutline() {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(renderOutline, 300);
}

function renderOutline() {
  if ($("panel-outline").hidden) return;
  outlineHeadings = findHeadings().filter((h) => h.text);
  const box = $("outline");
  box.textContent = "";
  if (outlineHeadings.length === 0) {
    box.innerHTML = `<div class="outline-empty">제목이 없습니다.<br />'# 제목' 형식으로 쓰면 여기에 표시됩니다.</div>`;
    return;
  }
  const top = Math.min(...outlineHeadings.map((h) => h.level));
  outlineHeadings.forEach((h, i) => {
    const item = document.createElement("div");
    item.className = "outline-item";
    item.classList.toggle("top", h.level === top);
    item.style.paddingLeft = `${12 + (h.level - top) * 16}px`;
    item.dataset.index = String(i);
    item.title = h.text;
    item.textContent = h.text;
    box.appendChild(item);
  });
}

/** 개요에서 고른 제목으로 편집기를 스크롤한다. */
function goToHeading(index) {
  const h = outlineHeadings[index];
  if (!h || !h.el.isConnected) {
    renderOutline();
    return;
  }
  h.el.scrollIntoView({ block: "start" });
}

function showSidebarPanel(panel) {
  const name = panel === "outline" ? "outline" : "files";
  for (const tab of document.querySelectorAll(".sidebar-tab")) {
    tab.classList.toggle("active", tab.dataset.panel === name);
  }
  $("panel-files").hidden = name !== "files";
  $("panel-outline").hidden = name !== "outline";
  storageSet(SIDEBAR_PANEL_KEY, name === "files" ? null : name);
  if (name === "outline") renderOutline();
}

/* ---------------- 사이드바 ---------------- */

async function openFolder() {
  const dir = await openDialog({ directory: true, multiple: false, defaultPath: state.folder ?? undefined });
  if (dir) await setFolder(dir);
}

async function setFolder(dir, reveal = true) {
  const tree = await invoke("list_md_tree", { root: dir });
  if (state.folder !== dir) state.expanded.clear();
  state.folder = dir;
  renderTree(tree);
  if (reveal) {
    setSidebarHidden(false);
    showSidebarPanel("files");
  }
}

async function refreshTree() {
  if (!state.folder) return;
  try {
    renderTree(await invoke("list_md_tree", { root: state.folder }));
  } catch {
    // 폴더가 사라졌으면 사이드바를 비운다.
    state.folder = null;
    renderTree(null);
  }
}

function renderTree(root) {
  const treeEl = $("tree");
  const footer = $("folder-footer");
  treeEl.innerHTML = "";
  if (!root) {
    footer.textContent = "폴더 열기...";
    footer.title = "폴더 열기 (Ctrl+Shift+O)";
    treeEl.innerHTML = `<div class="tree-empty">열린 폴더가 없음.</div>`;
    return;
  }
  // 아래쪽 폴더 이름을 누르면 다른 폴더를 연다.
  footer.textContent = `📁 ${root.name}`;
  footer.title = `${root.path}\n클릭하면 다른 폴더를 엽니다 (Ctrl+Shift+O)`;
  if (root.children.length === 0) {
    treeEl.innerHTML = `<div class="tree-empty"><p>.md 파일이 없습니다.</p></div>`;
    return;
  }
  treeEl.appendChild(buildList(root.children, 0));
  highlightActive();
}

function buildList(nodes, depth) {
  const ul = document.createElement("ul");
  for (const node of nodes) {
    const li = document.createElement("li");
    const item = document.createElement("div");
    item.className = "tree-item";
    item.style.paddingLeft = `${8 + depth * 14}px`;
    item.title = node.path;
    item.dataset.path = node.path;

    const caret = document.createElement("span");
    caret.className = "caret";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = node.isDir ? node.name : node.name.replace(MD_EXT, "");
    item.append(caret, label);
    li.appendChild(item);

    if (node.isDir) {
      caret.textContent = "▸";
      li.className = "tree-dir";
      if (!state.expanded.has(node.path)) li.classList.add("collapsed");
      item.dataset.kind = "dir";
      li.appendChild(buildList(node.children, depth + 1));
    } else {
      caret.textContent = "";
      item.dataset.kind = "file";
    }
    ul.appendChild(li);
  }
  return ul;
}

function highlightActive() {
  for (const el of document.querySelectorAll(".tree-item.active")) el.classList.remove("active");
  if (!state.filePath) return;
  for (const el of document.querySelectorAll('.tree-item[data-kind="file"]')) {
    if (el.dataset.path === state.filePath) el.classList.add("active");
  }
}

function setSidebarHidden(hidden) {
  $("app").classList.toggle("sidebar-hidden", hidden);
  storageSet(SIDEBAR_KEY, hidden ? "1" : null);
  state.menu?.setSidebar(!hidden);
}

function setSidebarWidth(width, persist = true) {
  const w = Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)));
  document.documentElement.style.setProperty("--sidebar-width", `${w}px`);
  if (persist) storageSet(SIDEBAR_WIDTH_KEY, w === SIDEBAR_DEFAULT_WIDTH ? null : String(w));
}

function bindSidebarResizer() {
  const handle = $("sidebar-resizer");
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    $("app").classList.add("resizing");
    const left = $("sidebar").getBoundingClientRect().left;
    const onMove = (ev) => setSidebarWidth(ev.clientX - left, false);
    const onUp = (ev) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      $("app").classList.remove("resizing");
      setSidebarWidth(ev.clientX - left);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
  handle.addEventListener("dblclick", () => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH));
}

function toggleSidebar() {
  setSidebarHidden(!$("app").classList.contains("sidebar-hidden"));
}

/* ---------------- 본문 · 서식 ---------------- */

/** 문서 폴더 기준 상대 경로 (드라이브가 다르면 절대 경로) */
function relativePath(fromDir, toFile) {
  const a = fromDir.replace(/\\/g, "/").split("/").filter(Boolean);
  const b = toFile.replace(/\\/g, "/").split("/").filter(Boolean);
  if (!a.length || !b.length || a[0].toLowerCase() !== b[0].toLowerCase()) return toFile.replace(/\\/g, "/");
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i].toLowerCase() === b[i].toLowerCase()) i++;
  return [...Array(a.length - i).fill(".."), ...b.slice(i)].join("/");
}

async function insertImage() {
  const file = await openDialog({
    multiple: false,
    directory: false,
    filters: [{ name: "이미지", extensions: IMAGE_EXTS }],
    defaultPath: state.filePath ? dirname(state.filePath) : (state.folder ?? undefined),
  });
  if (!file) return;
  insertImages([file]);
}

/** 이미지 파일들을 커서 위치에 넣는다. */
function insertImages(files) {
  const md = files.map((file) => {
    // 문서 폴더 안의 이미지는 상대 경로, 그 밖은 절대 경로 (Typora 와 같게)
    const path = state.filePath && isInside(file, dirname(state.filePath))
      ? relativePath(dirname(state.filePath), file)
      : file.replace(/\\/g, "/");
    const alt = basename(file).replace(/\.[^.]+$/, "");
    return `![${alt}](${path.replace(/ /g, "%20")})`;
  });
  state.vditor.focus();
  state.vditor.insertValue(md.join("\n\n"));
  scheduleInputCheck();
}

/* ---------------- 로컬 이미지 표시 ---------------- */

/** 마크다운의 이미지 경로를 실제 파일 경로로 바꾼다. 로컬 파일이 아니면 null. */
function localImagePath(src) {
  if (!src || /^(https?|data|blob|asset):/i.test(src) || src.startsWith("//")) return null;
  let path;
  try {
    path = decodeURI(src.replace(/^file:\/\/\/?/i, ""));
  } catch {
    path = src;
  }
  path = path.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(path)) return path; // C:/... 절대 경로
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("/") || !state.filePath) return null;
  const parts = dirname(state.filePath).replace(/\\/g, "/").split("/");
  for (const seg of path.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

/**
 * 웹뷰는 로컬 파일을 직접 못 읽으므로 화면에 그릴 때만 img 주소를 asset 주소로 바꾼다.
 * (저장되는 마크다운은 Vditor 가 원래 경로를 쓰므로 바뀌지 않는다)
 */
function fixLocalImage(img) {
  const src = img.getAttribute("src");
  if (!src || src === img.dataset.shown) return;
  const path = localImagePath(src);
  if (!path) return;
  const url = convertFileSrc(path);
  img.dataset.src0 = src; // 내보내기(HTML)에서 원래 경로를 쓰기 위해 남겨 둔다
  img.dataset.shown = url;
  img.setAttribute("src", url);
}

function watchLocalImages() {
  if (!isTauri()) return;
  const fixAll = (root) => {
    if (root.tagName === "IMG") fixLocalImage(root);
    else root.querySelectorAll?.("img").forEach(fixLocalImage);
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") fixLocalImage(r.target);
      else r.addedNodes.forEach((n) => n.nodeType === 1 && fixAll(n));
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
  fixAll(document.body);
}

/** 끌어다 놓은 위치로 커서를 옮긴다. (편집기 안일 때만) */
function placeCaretAt(position) {
  if (!position) return;
  const ratio = window.devicePixelRatio || 1;
  const range = document.caretRangeFromPoint?.(position.x / ratio, position.y / ratio);
  const editor = state.vditor?.vditor?.element;
  if (!range || !editor?.contains(range.startContainer)) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/** 본문·서식 명령. 편집기에 포커스를 돌려준 뒤 적용한다. */
function format(fn) {
  return () => {
    if (!state.vditor) return;
    state.vditor.focus();
    fn(state.vditor);
    scheduleInputCheck();
  };
}

const formats = {
  heading: (level) => format((v) => applyHeading(v, level))(),
  table: format((v) => applyToolbar(v, "table")),
  codeBlock: format((v) => applyToolbar(v, "code")),
  mathBlock: format((v) => insertBlock(v, "$$\n\n$$")),
  quote: format((v) => applyToolbar(v, "quote")),
  orderedList: format((v) => applyToolbar(v, "ordered-list")),
  bulletList: format((v) => applyToolbar(v, "list")),
  taskList: format((v) => applyToolbar(v, "check")),
  hr: format((v) => applyToolbar(v, "line")),
  bold: format((v) => applyToolbar(v, "bold")),
  italic: format((v) => applyToolbar(v, "italic")),
  underline: format((v) => wrapSelection(v, "<u>", "</u>")),
  strike: format((v) => applyToolbar(v, "strike")),
  inlineCode: format((v) => applyToolbar(v, "inline-code")),
  link: format((v) => applyToolbar(v, "link")),
  image: () => exclusive(insertImage)(),
};

/* ---------------- 보기 · 도움말 ---------------- */

async function toggleFullscreen() {
  if (!appWindow) {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
    return;
  }
  await appWindow.setFullscreen(!(await appWindow.isFullscreen()));
}

const SHORTCUTS = `파일
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
  Ctrl+B / Ctrl+I\t굵게 / 기울임`;

async function showShortcuts() {
  await message(SHORTCUTS, { title: "단축키 목록", kind: "info" });
}

async function showAbout() {
  const version = await getVersion().catch(() => "");
  await message(`글담 ${version}\n\nTypora 스타일 마크다운 편집기\nTauri · Vditor 기반`, { title: "글담 정보", kind: "info" });
}

/* ---------------- 이벤트 ---------------- */

const actions = {
  newDocument: exclusive(newDocument),
  openFile: exclusive(openFile),
  openFolder: exclusive(openFolder),
  openPath: exclusive(openPath),
  save: exclusive(saveFile),
  saveAs: exclusive(saveFileAs),
  toggleMode: exclusive(toggleMode),
  print: exclusive(printDocument),
  exportAs: exclusive(exportDocument),
  toggleSidebar,
  toggleFullscreen,
};

function openMenu(key) {
  if (isTauri()) invoke("open_menu", { key }).catch(() => {});
}

// 왼쪽 Alt 를 눌렀다 떼기만 하면 메뉴줄을 활성화한다(Windows 기본 동작과 같게).
// 오른쪽 Alt 는 한/영 키로 쓰이므로 제외한다.
let altAlone = false;

function onKeyUp(e) {
  if (e.code === "AltLeft" && altAlone) {
    altAlone = false;
    e.preventDefault();
    openMenu("");
  }
}

/** 본문·서식 단축키 (Typora 와 같게). Ctrl 이 눌린 상태에서 부른다. */
function formatShortcut(e) {
  const digit = /^Digit([0-6])$/.exec(e.code);
  if (digit && !e.shiftKey) return () => formats.heading(Number(digit[1]));
  if (e.shiftKey) {
    switch (e.code) {
      case "KeyK": return formats.codeBlock;
      case "KeyM": return formats.mathBlock;
      case "KeyQ": return formats.quote;
      case "BracketLeft": return formats.orderedList;
      case "BracketRight": return formats.bulletList;
      case "Backquote": return formats.inlineCode;
      case "KeyI": return formats.image;
      default: return null;
    }
  }
  switch (e.code) {
    case "KeyT": return formats.table;
    case "KeyB": return formats.bold;
    case "KeyI": return formats.italic;
    case "KeyU": return formats.underline;
    case "KeyK": return formats.link;
    default: return null;
  }
}

function onKeyDown(e) {
  altAlone = e.code === "AltLeft" && !e.repeat && !e.ctrlKey && !e.shiftKey && !e.metaKey;
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && MENU_KEYS[e.code]) {
    e.preventDefault();
    e.stopPropagation();
    openMenu(MENU_KEYS[e.code]);
    return;
  }
  if (e.key === "F11" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    actions.toggleFullscreen();
    return;
  }
  // 취소선: Alt+Shift+5 (Typora 와 같음)
  if (e.altKey && e.shiftKey && !e.ctrlKey && e.code === "Digit5") {
    e.preventDefault();
    e.stopPropagation();
    formats.strike();
    return;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const fmt = formatShortcut(e);
  if (fmt) {
    e.preventDefault();
    e.stopPropagation();
    fmt();
    return;
  }
  let action = null;
  switch (e.code) {
    case "KeyN":
      if (!e.shiftKey) action = actions.newDocument;
      break;
    case "KeyO":
      action = e.shiftKey ? actions.openFolder : actions.openFile;
      break;
    case "KeyS":
      action = e.shiftKey ? actions.saveAs : actions.save;
      break;
    case "KeyP":
      if (!e.shiftKey) action = actions.print;
      break;
    case "Slash":
      action = actions.toggleMode;
      break;
    case "Backslash":
    case "IntlYen":
      action = actions.toggleSidebar;
      break;
  }
  if (!action && e.key === "/") action = actions.toggleMode;
  if (!action && (e.key === "\\" || e.key === "₩")) action = actions.toggleSidebar;
  if (!action) return;
  // Vditor 의 단축키보다 먼저 처리한다(capture 단계).
  e.preventDefault();
  e.stopPropagation();
  action();
}

function bindEvents() {
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", () => { altAlone = false; });
  for (const tab of document.querySelectorAll(".sidebar-tab")) {
    tab.addEventListener("click", () => showSidebarPanel(tab.dataset.panel));
  }
  $("outline").addEventListener("click", (e) => {
    const item = e.target.closest(".outline-item");
    if (item) goToHeading(Number(item.dataset.index));
  });
  window.addEventListener("keydown", onKeyDown, true);
  darkQuery.addEventListener("change", () => themePref() === "system" && applyTheme());
  // 다른 창에서 테마를 바꾸면 이 창도 따라간다.
  window.addEventListener("storage", (e) => e.key === THEME_KEY && applyTheme());
  window.addEventListener("focus", () => refreshTree());
  $("vditor").addEventListener("input", scheduleInputCheck);
  $("vditor").addEventListener("compositionend", scheduleInputCheck);

  $("folder-footer").addEventListener("click", () => actions.openFolder());
  window.addEventListener("afterprint", finishPrint);
  $("status-mode").addEventListener("click", () => actions.toggleMode());

  $("tree").addEventListener("click", (e) => {
    if (e.target.closest('[data-action="open-folder"]')) {
      actions.openFolder();
      return;
    }
    const item = e.target.closest(".tree-item");
    if (!item) return;
    if (item.dataset.kind === "dir") {
      const li = item.parentElement;
      li.classList.toggle("collapsed");
      if (li.classList.contains("collapsed")) state.expanded.delete(item.dataset.path);
      else state.expanded.add(item.dataset.path);
    } else {
      actions.openPath(item.dataset.path);
    }
  });

  if (!appWindow) {
    window.addEventListener("beforeunload", (e) => {
      if (refreshDirty()) e.preventDefault();
    });
    return;
  }

  // 창을 닫기 전에 저장 여부를 확인한다.
  appWindow.onCloseRequested(async (event) => {
    if (!refreshDirty()) return;
    event.preventDefault();
    if (state.busy) return;
    state.busy = true;
    try {
      if (await confirmDiscard()) {
        state.dirty = false;
        await appWindow.destroy();
      }
    } catch (err) {
      await showError(err);
    } finally {
      state.busy = false;
    }
  });

  // 끌어다 놓기: 이미지는 놓은 위치에 삽입, .md 는 열기, 폴더는 사이드바에 열기. 그 밖의 파일은 무시.
  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;
    const paths = event.payload.paths ?? [];
    const images = paths.filter((p) => IMAGE_EXT.test(p));
    if (images.length) {
      placeCaretAt(event.payload.position);
      insertImages(images);
      return;
    }
    const md = paths.find((p) => MD_EXT.test(p));
    if (md) {
      actions.openPath(md);
      return;
    }
    const dir = paths.find((p) => !/\.[^\\/.]+$/.test(p));
    if (dir) setFolder(dir).catch(() => {});
  });
}

async function init() {
  document.documentElement.dataset.theme = isDark() ? "dark" : "light";
  if (storageGet(SIDEBAR_KEY) === "1") setSidebarHidden(true);
  const savedWidth = Number(storageGet(SIDEBAR_WIDTH_KEY));
  if (savedWidth) setSidebarWidth(savedWidth, false);
  bindSidebarResizer();
  watchLocalImages();
  showSidebarPanel(storageGet(SIDEBAR_PANEL_KEY));
  bindEvents();
  if (appWindow) {
    try {
      state.menu = await installMenu(appWindow, {
        newDocument: () => actions.newDocument(),
        openFile: () => actions.openFile(),
        openFolder: () => actions.openFolder(),
        save: () => actions.save(),
        saveAs: () => actions.saveAs(),
        print: () => actions.print(),
        exportAs: (kind) => actions.exportAs(kind),
        close: () => appWindow.close(),
        toggleSidebar: () => actions.toggleSidebar(),
        toggleMode: () => actions.toggleMode(),
        refreshTree: () => refreshTree(),
        toggleFullscreen: () => actions.toggleFullscreen(),
        setTheme: (t) => setTheme(t),
        showShortcuts: () => exclusive(showShortcuts)(),
        showAbout: () => exclusive(showAbout)(),
        ...formats,
      }, {
        sidebar: !$("app").classList.contains("sidebar-hidden"),
        source: state.mode === "sv",
        theme: themePref(),
      });
    } catch (err) {
      console.error("메뉴를 만들 수 없습니다", err);
    }
    applyTheme();
  }
  await createEditor("");
  updateTitle();

  if (!isTauri()) return;

  // 탐색기에서 더블클릭한 파일은 처음 뜨는 메인 창에서만 연다.
  const startupFile = appWindow.label === "main" ? await invoke("get_startup_file").catch(() => null) : null;
  // 사이드바에는 연 파일의 폴더만 보여 준다. (loadFile 이 설정)
  if (startupFile) {
    try {
      await loadFile(startupFile);
    } catch (err) {
      await showError(err);
    }
  }
  state.vditor.focus();
}

init();
