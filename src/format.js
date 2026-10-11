// 본문(P)·서식(O) 메뉴의 동작.
// Vditor 의 툴바(화면에는 숨김)를 만들어 두고 그 버튼을 눌러서 서식을 적용한다.
// 이렇게 하면 IR/원문 모드별 처리를 Vditor 가 그대로 해 준다.

/** createEditor 의 toolbar 옵션 (숨긴 툴바에 들어갈 항목) */
export const TOOLBAR_ITEMS = [
  "headings", "bold", "italic", "strike", "link",
  "list", "ordered-list", "check", "quote", "line",
  "code", "inline-code", "table",
];

function toolbarButton(vditor, name) {
  return vditor?.vditor?.toolbar?.elements?.[name]?.children?.[0] ?? null;
}

function press(el) {
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** 툴바 항목 하나를 누른다. (굵게, 표, 인용 등) */
export function applyToolbar(vditor, name) {
  press(toolbarButton(vditor, name));
}

/** 제목 1~6. level 0 은 제목을 없애고 본문으로 되돌린다. */
export function applyHeading(vditor, level) {
  if (vditor?.vditor?.currentMode === "sv") {
    headingInSource(level);
    return;
  }
  const item = vditor?.vditor?.toolbar?.elements?.headings;
  if (!item) return;
  if (level === 0) {
    // 커서가 제목 안에 있으면 Vditor 가 제목 버튼을 '현재' 상태로 표시하고, 그때 누르면 제목이 풀린다.
    const btn = item.children[0];
    if (btn.classList.contains("vditor-menu--current")) press(btn);
    return;
  }
  press(item.querySelector(`button[data-tag="h${level}"]`));
  const panel = item.querySelector(".vditor-hint, .vditor-panel");
  if (panel) panel.style.display = "none";
}

/**
 * 원문 모드: 커서가 있는 줄 전체의 '#' 표시를 바꾼다.
 * (Vditor 의 원문 모드 제목 처리는 커서 위치에서 줄을 나누므로 직접 처리한다)
 */
function headingInSource(level) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  sel.collapseToStart();
  sel.modify("move", "backward", "paragraphboundary");
  sel.modify("extend", "forward", "paragraphboundary");
  const line = sel.toString().replace(/\n$/, "");
  const text = line.replace(/^#{1,6}\s*/, "");
  const next = level > 0 ? `${"#".repeat(level)} ${text}` : text;
  document.execCommand("insertText", false, next);
}

/** 선택한 글자를 앞뒤 표시로 감싼다. (밑줄처럼 Vditor 툴바에 없는 서식) */
export function wrapSelection(vditor, before, after) {
  const selected = vditor.getSelection();
  // insertValue 는 선택을 바꾸지 않고 문단을 나누므로, 입력한 것처럼 넣어서 Vditor 가 다시 그리게 한다.
  document.execCommand("insertText", false, `${before}${selected}${after}`);
}

/** 커서 위치에 새 블록을 넣는다. */
export function insertBlock(vditor, markdown) {
  vditor.insertValue(`\n${markdown}\n`);
}
