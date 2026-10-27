// 표 편집 도구 (Typora 스타일)
// 커서가 표 안에 있으면 표 위에 도구 막대를 띄운다:
//   [표 크기] [왼쪽·가운데·오른쪽 정렬]            [더 많은 동작 ⋮] [표 삭제]
// 표를 마크다운 칸 데이터로 읽어 바꾼 뒤 다시 그리는 방식이라 IR 화면과 저장 내용이 항상 같다.
import { execAfterRender } from "./vditor/ts/util/fixBrowserBehavior";
import { t } from "./i18n.js";

const svg = (body) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICON = {
  grid: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>'),
  left: svg('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
  center: svg('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
  right: svg('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
  more: svg('<circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};

/** [동작, 단축키] — 이름은 i18n 의 table.<동작> */
const MENU = [
  ["rowAbove", ""],
  ["rowBelow", "Ctrl+Enter"],
  ["colLeft", ""],
  ["colRight", ""],
  null,
  ["rowUp", "Alt+↑"],
  ["rowDown", "Alt+↓"],
  ["colMoveLeft", "Alt+←"],
  ["colMoveRight", "Alt+→"],
  null,
  ["deleteRow", ""],
  ["deleteCol", ""],
  null,
  ["copy", ""],
  ["pretty", ""],
  null,
  ["deleteTable", ""],
];

/* ---------------- 표 ↔ 칸 데이터 ---------------- */

/** 마크다운 표 한 줄을 칸으로 나눈다. (\| 는 칸 구분이 아님) */
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

function parseTable(md) {
  const lines = md.trim().split("\n").filter((l) => l.trim());
  const rows = [splitRow(lines[0]), ...lines.slice(2).map(splitRow)];
  const aligns = splitRow(lines[1] ?? "").map((d) => {
    const l = d.startsWith(":");
    const r = d.endsWith(":");
    return l && r ? "center" : r ? "right" : l ? "left" : "";
  });
  const cols = Math.max(...rows.map((r) => r.length), aligns.length, 1);
  for (const r of rows) while (r.length < cols) r.push("");
  while (aligns.length < cols) aligns.push("");
  return { rows, aligns: aligns.slice(0, cols) };
}

/** 한글 등은 2칸으로 세어 열 너비를 맞춘다. */
const textWidth = (s) =>
  [...s].reduce((n, ch) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1), 0);

/** 칸 데이터를 열 너비가 맞춰진 마크다운 표로 만든다. */
function tableToMarkdown({ rows, aligns }) {
  const cols = aligns.length;
  const widths = Array.from({ length: cols }, (_, c) => Math.max(3, ...rows.map((r) => textWidth(r[c] ?? ""))));
  const pad = (s, w) => s + " ".repeat(Math.max(0, w - textWidth(s)));
  const line = (cells) => `| ${cells.map((c, i) => pad(c ?? "", widths[i])).join(" | ")} |`;
  const delim = `| ${aligns.map((a, i) => {
    const w = widths[i];
    if (a === "center") return `:${"-".repeat(w - 2)}:`;
    if (a === "right") return `${"-".repeat(w - 1)}:`;
    if (a === "left") return `:${"-".repeat(w - 1)}`;
    return "-".repeat(w);
  }).join(" | ")} |`;
  return [line(rows[0]), delim, ...rows.slice(1).map(line)].join("\n");
}

/* ---------------- 도구 ---------------- */

/**
 * @param {{ getVditor: () => any, onChange: () => void }} opts
 * @returns {{ handleKey: (e: KeyboardEvent) => boolean, refresh: () => void }}
 */
export function installTableTools({ getVditor, onChange }) {
  const bar = document.createElement("div");
  bar.className = "gd-table-bar";
  bar.hidden = true;

  const menu = document.createElement("div");
  menu.className = "gd-table-pop gd-table-menu";
  menu.hidden = true;

  /** 도구 막대와 메뉴의 글자를 현재 언어로 다시 쓴다. */
  function relabel() {
    bar.innerHTML = `
      <div class="gd-tb-group">
        <button data-act="resize" title="${t("table.resize")}">${ICON.grid}</button>
        <button data-act="align-left" title="${t("table.alignLeft")}">${ICON.left}</button>
        <button data-act="align-center" title="${t("table.alignCenter")}">${ICON.center}</button>
        <button data-act="align-right" title="${t("table.alignRight")}">${ICON.right}</button>
      </div>
      <div class="gd-tb-group">
        <button data-act="more" class="gd-tb-more" title="${t("table.more")}">${t("table.more")} ${ICON.more}</button>
        <button data-act="deleteTable" title="${t("table.deleteTable")}">${ICON.trash}</button>
      </div>`;
    menu.innerHTML = MENU.map((m) => (m
      ? `<button data-act="${m[0]}"><span>${t(`table.${m[0]}`)}</span><kbd>${m[1]}</kbd></button>`
      : `<hr>`)).join("");
  }
  relabel();

  const sizer = document.createElement("div");
  sizer.className = "gd-table-pop gd-table-sizer";
  sizer.hidden = true;

  document.body.append(bar, menu, sizer);

  /** 도구를 연 시점의 표와 칸 위치 (팝업에 포커스가 가도 잃지 않도록) */
  let ctx = null;

  const vd = () => getVditor()?.vditor;
  const irRoot = () => (vd()?.currentMode === "ir" ? vd().ir.element : null);

  /** 커서가 있는 표와 칸 위치 */
  function currentContext() {
    const root = irRoot();
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    const cell = node?.closest?.("td, th");
    const table = cell?.closest("table");
    if (!table || !root.contains(table)) return null;
    return { table, row: cell.parentElement.rowIndex, col: cell.cellIndex };
  }

  function readModel(table) {
    return parseTable(vd().lute.VditorIRDOM2Md(table.outerHTML));
  }

  /** 바뀐 칸 데이터로 표를 다시 그리고 커서를 (row, col) 칸에 둔다. */
  function writeModel(table, model, row, col) {
    const tpl = document.createElement("template");
    tpl.innerHTML = vd().lute.Md2VditorIRDOM(tableToMarkdown(model));
    const fresh = tpl.content.querySelector("table");
    if (!fresh) return;
    table.replaceWith(fresh);
    const r = Math.max(0, Math.min(row, fresh.rows.length - 1));
    const cell = fresh.rows[r]?.cells[Math.max(0, Math.min(col, fresh.rows[r].cells.length - 1))];
    if (cell) {
      const range = document.createRange();
      range.selectNodeContents(cell);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    execAfterRender(vd());
    onChange();
    ctx = currentContext();
    position();
  }

  function deleteTable(table) {
    const range = document.createRange();
    const next = table.nextElementSibling || table.previousElementSibling;
    table.remove();
    if (next) {
      range.selectNodeContents(next);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    execAfterRender(vd());
    onChange();
    hideAll();
  }

  const swap = (arr, i, j) => ([arr[i], arr[j]] = [arr[j], arr[i]]);

  /** 표 명령 실행. 커서가 표 안에 없으면 아무것도 하지 않는다. */
  function run(act, arg) {
    const c = ctx && ctx.table.isConnected ? ctx : currentContext();
    if (!c) return;
    const { table, row, col } = c;
    if (act === "deleteTable") return deleteTable(table);
    const m = readModel(table);
    const cols = m.aligns.length;
    const empty = () => Array(cols).fill("");
    let r = row;
    let k = col;
    switch (act) {
      case "align-left": case "align-center": case "align-right": {
        const a = act.slice(6);
        m.aligns[col] = m.aligns[col] === a ? "" : a;
        break;
      }
      case "resize": {
        const { rows: nr, cols: nc } = arg;
        m.rows.length = Math.min(m.rows.length, nr);
        while (m.rows.length < nr) m.rows.push(empty());
        for (const rw of m.rows) {
          rw.length = Math.min(rw.length, nc);
          while (rw.length < nc) rw.push("");
        }
        m.aligns.length = Math.min(m.aligns.length, nc);
        while (m.aligns.length < nc) m.aligns.push("");
        break;
      }
      case "rowAbove": m.rows.splice(row, 0, empty()); break;
      case "rowBelow": m.rows.splice(row + 1, 0, empty()); r = row + 1; break;
      case "colLeft": m.rows.forEach((rw) => rw.splice(col, 0, "")); m.aligns.splice(col, 0, ""); break;
      case "colRight": m.rows.forEach((rw) => rw.splice(col + 1, 0, "")); m.aligns.splice(col + 1, 0, ""); k = col + 1; break;
      case "rowUp": if (row === 0) return; swap(m.rows, row, row - 1); r = row - 1; break;
      case "rowDown": if (row >= m.rows.length - 1) return; swap(m.rows, row, row + 1); r = row + 1; break;
      case "colMoveLeft":
        if (col === 0) return;
        m.rows.forEach((rw) => swap(rw, col, col - 1)); swap(m.aligns, col, col - 1); k = col - 1;
        break;
      case "colMoveRight":
        if (col >= cols - 1) return;
        m.rows.forEach((rw) => swap(rw, col, col + 1)); swap(m.aligns, col, col + 1); k = col + 1;
        break;
      case "deleteRow":
        if (m.rows.length <= 1) return deleteTable(table);
        m.rows.splice(row, 1); r = Math.min(row, m.rows.length - 1);
        break;
      case "deleteCol":
        if (cols <= 1) return deleteTable(table);
        m.rows.forEach((rw) => rw.splice(col, 1)); m.aligns.splice(col, 1); k = Math.min(col, cols - 2);
        break;
      case "copy":
        navigator.clipboard?.writeText(tableToMarkdown(m)).catch(() => {});
        return;
      case "pretty":
        break; // 다시 그리면 열 너비가 맞춰진 마크다운이 된다.
      default:
        return;
    }
    writeModel(table, m, r, k);
  }

  /* ---------- 표 크기 팝업 ---------- */

  function openSizer() {
    const c = ctx;
    if (!c) return;
    const m = readModel(c.table);
    const cur = { rows: m.rows.length, cols: m.aligns.length };
    const gridRows = Math.min(20, Math.max(10, cur.rows + 2));
    const gridCols = Math.min(15, Math.max(6, cur.cols + 2));
    sizer.innerHTML = `
      <div class="gd-sizer-grid" style="grid-template-columns: repeat(${gridCols}, 16px)">
        ${Array.from({ length: gridRows * gridCols }, (_, i) =>
          `<i data-r="${Math.floor(i / gridCols) + 1}" data-c="${(i % gridCols) + 1}"></i>`).join("")}
      </div>
      <div class="gd-sizer-input">
        <input type="number" min="1" max="50" value="${cur.cols}" data-k="cols" title="${t("table.cols")}"> x
        <input type="number" min="1" max="200" value="${cur.rows}" data-k="rows" title="${t("table.rows")}">
      </div>`;
    const paint = (rows, cols) => {
      for (const cell of sizer.querySelectorAll("i")) {
        const r = Number(cell.dataset.r);
        const col = Number(cell.dataset.c);
        cell.classList.toggle("cur", r <= cur.rows && col <= cur.cols);
        cell.classList.toggle("sel", r <= rows && col <= cols);
      }
    };
    paint(cur.rows, cur.cols);
    const grid = sizer.querySelector(".gd-sizer-grid");
    const [colsIn, rowsIn] = sizer.querySelectorAll("input");
    grid.onmousemove = (e) => {
      const cell = e.target.closest("i");
      if (!cell) return;
      paint(Number(cell.dataset.r), Number(cell.dataset.c));
      colsIn.value = cell.dataset.c;
      rowsIn.value = cell.dataset.r;
    };
    grid.onmouseleave = () => {
      paint(cur.rows, cur.cols);
      colsIn.value = cur.cols;
      rowsIn.value = cur.rows;
    };
    grid.onclick = (e) => {
      const cell = e.target.closest("i");
      if (!cell) return;
      hidePopups();
      run("resize", { rows: Number(cell.dataset.r), cols: Number(cell.dataset.c) });
    };
    sizer.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const rows = Math.max(1, Math.min(200, Number(rowsIn.value) || cur.rows));
        const cols = Math.max(1, Math.min(50, Number(colsIn.value) || cur.cols));
        hidePopups();
        run("resize", { rows, cols });
      } else if (e.key === "Escape") {
        hidePopups();
      }
    };
    const btn = bar.querySelector('[data-act="resize"]').getBoundingClientRect();
    sizer.style.left = `${btn.left}px`;
    sizer.style.top = `${btn.bottom + 6}px`;
    menu.hidden = true;
    sizer.hidden = false;
  }

  function openMenu() {
    const btn = bar.querySelector('[data-act="more"]').getBoundingClientRect();
    sizer.hidden = true;
    menu.hidden = false;
    const w = menu.offsetWidth;
    menu.style.left = `${Math.max(8, Math.min(btn.right - w, window.innerWidth - w - 8))}px`;
    menu.style.top = `${btn.bottom + 6}px`;
  }

  const hidePopups = () => {
    menu.hidden = true;
    sizer.hidden = true;
  };
  const hideAll = () => {
    hidePopups();
    bar.hidden = true;
    ctx = null;
  };

  /* ---------- 위치 ---------- */

  function position() {
    if (!ctx || !ctx.table.isConnected) return hideAll();
    const root = irRoot();
    if (!root) return hideAll();
    const t = ctx.table.getBoundingClientRect();
    const view = root.getBoundingClientRect();
    if (t.bottom < view.top + 30 || t.top > view.bottom) {
      bar.hidden = true;
      return;
    }
    const contentRight = view.right - parseFloat(getComputedStyle(root).paddingRight || "0");
    const width = Math.min(Math.max(t.width, 340), contentRight - t.left);
    bar.style.left = `${t.left}px`;
    bar.style.width = `${width}px`;
    bar.style.top = `${Math.max(view.top + 2, t.top - 38)}px`;
    bar.hidden = false;
  }

  function refresh() {
    if (!menu.hidden || !sizer.hidden) return; // 팝업 사용 중에는 유지
    const c = currentContext();
    if (!c) {
      hideAll();
      return;
    }
    ctx = c;
    position();
  }

  /* ---------- 이벤트 ---------- */

  // 도구를 눌러도 편집기의 커서(선택)가 사라지지 않게 한다.
  bar.addEventListener("mousedown", (e) => e.preventDefault());
  menu.addEventListener("mousedown", (e) => e.preventDefault());

  bar.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "resize") return sizer.hidden ? openSizer() : hidePopups();
    if (act === "more") return menu.hidden ? openMenu() : hidePopups();
    hidePopups();
    run(act);
  });
  menu.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    hidePopups();
    run(act);
  });
  document.addEventListener("mousedown", (e) => {
    if (bar.contains(e.target) || menu.contains(e.target) || sizer.contains(e.target)) return;
    hidePopups();
  }, true);
  document.addEventListener("selectionchange", refresh);
  window.addEventListener("resize", () => ctx && position());
  document.addEventListener("scroll", () => ctx && position(), true);

  /** 표 단축키: Ctrl+Enter, Alt+방향키. 처리했으면 true. */
  function handleKey(e) {
    if (e.key === "Escape" && (!menu.hidden || !sizer.hidden)) {
      hidePopups();
      return true;
    }
    const ctrlEnter = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === "Enter";
    const altArrow = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.startsWith("Arrow");
    if (!ctrlEnter && !altArrow) return false;
    const c = currentContext();
    if (!c) return false;
    ctx = c;
    const act = ctrlEnter ? "rowBelow"
      : { ArrowUp: "rowUp", ArrowDown: "rowDown", ArrowLeft: "colMoveLeft", ArrowRight: "colMoveRight" }[e.key];
    run(act);
    return true;
  }

  return {
    handleKey,
    refresh: () => { hidePopups(); refresh(); },
    relabel: () => { hidePopups(); relabel(); },
  };
}
