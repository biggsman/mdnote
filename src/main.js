import Vditor from "vditor";
import "vditor/dist/index.css";
import "./style.css";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog, save as saveDialog, message } from "@tauri-apps/plugin-dialog";

// scripts/copy-vditor.mjs 가 node_modules/vditor/dist 를 public/vditor/dist 로 복사한다.
const VDITOR_CDN = "/vditor";
const MD_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown"] },
  { name: "모든 파일", extensions: ["*"] },
];
const MD_EXT = /\.(md|markdown|mdown|mkd)$/i;
const FOLDER_KEY = "mdnote.folder";
const SIDEBAR_KEY = "mdnote.sidebarHidden";

const state = {
  vditor: null,
  mode: "ir", // "ir" | "sv"(원문)
  filePath: null,
  savedContent: "",
  dirty: false,
  folder: null,
  expanded: new Set(),
  busy: false,
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

function isDark() {
  return darkQuery.matches;
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
      toolbar: [],
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

/** 현재 내용과 마지막 저장 내용을 비교해 '저장 안 됨' 상태를 갱신한다. */
function refreshDirty() {
  const dirty = getValue() !== state.savedContent;
  if (dirty !== state.dirty) {
    state.dirty = dirty;
    updateTitle();
  }
  return dirty;
}

function onInput() {
  refreshDirty();
  updateCount();
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
  state.vditor.focus();
}

async function toggleMode() {
  const value = getValue();
  const wasDirty = state.dirty;
  state.mode = state.mode === "ir" ? "sv" : "ir";
  await createEditor(value);
  // 모드 전환에 따른 정규화 차이만으로 '수정됨'이 되지 않도록 한다.
  if (!wasDirty) state.savedContent = getValue();
  else state.dirty = getValue() !== state.savedContent;
  updateTitle();
  state.vditor.focus();
}

function applyTheme() {
  const dark = isDark();
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  state.vditor?.setTheme(dark ? "dark" : "classic", dark ? "dark" : "light", dark ? "github-dark" : "github");
}

/* ---------------- 상태 표시 ---------------- */

function updateTitle() {
  const title = `${state.dirty ? "● " : ""}${docName()} - MdNote`;
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
  if (isTauri()) await message(msg, { title: "MdNote", kind: "error" });
  else alert(msg);
}

/* ---------------- 파일 작업 ---------------- */

/** 저장되지 않은 변경이 있으면 묻는다. 계속 진행해도 되면 true. */
async function confirmDiscard() {
  if (!refreshDirty()) return true;
  const SAVE = "저장";
  const DISCARD = "저장 안 함";
  const answer = await message(`'${docName()}'의 변경 내용을 저장할까요?\n저장하지 않으면 변경 내용이 사라집니다.`, {
    title: "MdNote",
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

async function newDocument() {
  if (!(await confirmDiscard())) return;
  state.filePath = null;
  setContent("");
}

async function loadFile(path) {
  const content = await invoke("read_file", { path });
  state.filePath = path;
  setContent(content);
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
  state.dirty = getValue() !== content;
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

/* ---------------- 사이드바 ---------------- */

async function openFolder() {
  const dir = await openDialog({ directory: true, multiple: false, defaultPath: state.folder ?? undefined });
  if (dir) await setFolder(dir);
}

async function setFolder(dir) {
  const tree = await invoke("list_md_tree", { root: dir });
  if (state.folder !== dir) state.expanded.clear();
  state.folder = dir;
  storageSet(FOLDER_KEY, dir);
  renderTree(tree);
  setSidebarHidden(false);
}

async function refreshTree() {
  if (!state.folder) return;
  try {
    renderTree(await invoke("list_md_tree", { root: state.folder }));
  } catch {
    // 폴더가 사라졌으면 사이드바를 비운다.
    state.folder = null;
    storageSet(FOLDER_KEY, null);
    renderTree(null);
  }
}

function renderTree(root) {
  const treeEl = $("tree");
  const nameEl = $("folder-name");
  treeEl.innerHTML = "";
  if (!root) {
    nameEl.textContent = "폴더 없음";
    nameEl.title = "";
    treeEl.innerHTML = `<div class="tree-empty"><p>열린 폴더가 없습니다.</p><button class="text-btn" data-action="open-folder">폴더 열기 (Ctrl+Shift+O)</button></div>`;
    return;
  }
  nameEl.textContent = root.name;
  nameEl.title = root.path;
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
}

function toggleSidebar() {
  setSidebarHidden(!$("app").classList.contains("sidebar-hidden"));
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
  toggleSidebar,
};

function onKeyDown(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
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
  window.addEventListener("keydown", onKeyDown, true);
  darkQuery.addEventListener("change", applyTheme);
  window.addEventListener("focus", () => refreshTree());
  $("vditor").addEventListener("input", scheduleInputCheck);
  $("vditor").addEventListener("compositionend", scheduleInputCheck);

  $("btn-folder").addEventListener("click", () => actions.openFolder());
  $("btn-refresh").addEventListener("click", () => refreshTree());
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

  // 파일이나 폴더를 창에 끌어다 놓으면 연다.
  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== "drop") return;
    const paths = event.payload.paths ?? [];
    const md = paths.find((p) => MD_EXT.test(p));
    if (md) actions.openPath(md);
    else if (paths[0]) exclusive(setFolder)(paths[0]);
  });
}

async function init() {
  document.documentElement.dataset.theme = isDark() ? "dark" : "light";
  if (storageGet(SIDEBAR_KEY) === "1") setSidebarHidden(true);
  bindEvents();
  await createEditor("");
  updateTitle();

  if (!isTauri()) return;

  const startupFile = await invoke("get_startup_file").catch(() => null);
  const savedFolder = storageGet(FOLDER_KEY);
  const folder = savedFolder ?? (startupFile ? dirname(startupFile) : null);
  if (folder) {
    try {
      await setFolder(folder);
      if (storageGet(SIDEBAR_KEY) === "1") setSidebarHidden(true);
    } catch {
      storageSet(FOLDER_KEY, null);
    }
  }
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
