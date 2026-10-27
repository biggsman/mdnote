// 파일 → 내보내기 (PDF, HTML, 이미지, Word, RTF)
// 모두 인터넷 없이 프로그램 안에서 변환한다.
import { invoke } from "@tauri-apps/api/core";
import { t } from "./i18n.js";
import { toPng } from "html-to-image";
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, ImageRun,
  LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";

/* ---------------- 공통 ---------------- */

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

const base64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp" };

/**
 * 이미지 src 를 data: URL 로 바꾼다. 로컬 파일은 Rust 로 읽고, 웹 주소는 받아 온다.
 * 실패하면 null.
 */
async function imageDataUrl(src, resolveLocal) {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  try {
    const local = resolveLocal(src);
    if (local) {
      const ext = local.split(".").pop().toLowerCase();
      const b64 = await invoke("read_binary", { path: local.replace(/\//g, "\\") });
      return `data:${MIME[ext] ?? "application/octet-stream"};base64,${b64}`;
    }
    const res = await fetch(src);
    if (!res.ok) return null;
    return `data:${res.headers.get("content-type") ?? "image/png"};base64,${await blobToBase64(await res.blob())}`;
  } catch {
    return null;
  }
}

/** 이미지를 PNG 로 바꾸고 크기를 함께 돌려준다. (Word·RTF 는 PNG 로 넣는다) */
async function imageAsPng(src, resolveLocal) {
  const url = await imageDataUrl(src, resolveLocal);
  if (!url) return null;
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const width = img.naturalWidth || 300;
  const height = img.naturalHeight || 200;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, width, height);
  g.drawImage(img, 0, 0);
  const b64 = canvas.toDataURL("image/png").split(",")[1];
  return { bytes: base64ToBytes(b64), width, height };
}

/** 가로가 maxWidth 를 넘지 않게 줄인 크기 */
function fit(width, height, maxWidth) {
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.round((height * maxWidth) / width) };
}

/* ---------------- HTML ---------------- */

/** 화면에 적용된 스타일 중 문서 본문(.vditor-reset)에 해당하는 규칙만 모은다. */
function collectReaderCss() {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      const text = rule.cssText;
      if (text.includes("vditor-reset") || text.includes(".hljs") || text.includes(".katex")) out.push(text);
    }
  }
  return out.join("\n");
}

/**
 * 렌더링된 문서(area)로 단독 HTML 파일을 만든다. 이미지는 파일 안에 넣는다.
 * @param {HTMLElement} area 인쇄용으로 렌더링된 요소 (밝은 테마)
 */
export async function buildHtml(area, title, resolveLocal) {
  const copy = area.cloneNode(true);
  copy.removeAttribute("id");
  copy.querySelectorAll(".vditor-copy").forEach((el) => el.remove());
  for (const img of copy.querySelectorAll("img")) {
    const original = img.dataset.src0 || img.getAttribute("src");
    const data = await imageDataUrl(original, resolveLocal);
    img.setAttribute("src", data ?? original);
    delete img.dataset.src0;
    delete img.dataset.shown;
  }
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { margin: 0; background: #fff; color: #1f2328; }
.doc { max-width: 860px; margin: 0 auto; padding: 40px 32px;
  font-family: "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
${collectReaderCss()}
.doc li.vditor-task { list-style: none; }
.doc li.vditor-task > input { margin: 0 6px 0 -20px; }
</style>
</head>
<body>
<div class="doc vditor-reset">
${copy.innerHTML}
</div>
</body>
</html>
`;
}

/* ---------------- 이미지 (PNG) ---------------- */

/** 렌더링된 문서를 PNG(base64)로 만든다. */
export async function buildPng(area) {
  const height = area.scrollHeight;
  // 브라우저 캔버스 크기 제한(약 32,000px) 안에 들도록 배율을 낮춘다.
  const pixelRatio = Math.max(0.5, Math.min(2, 30000 / Math.max(height, 1)));
  const url = await toPng(area, {
    backgroundColor: "#ffffff",
    pixelRatio,
    skipFonts: true,
    // 화면 밖에 둔 위치(position: fixed; left: -20000px)를 그림에서는 되돌린다.
    style: { position: "static", left: "0", top: "0", margin: "0" },
    filter: (node) => !(node.classList && node.classList.contains("vditor-copy")),
  });
  return url.split(",")[1];
}

/* ---------------- 문서 구조 읽기 (Word·RTF 공통) ---------------- */

/** 마크다운을 HTML 로 바꿔 DOM 으로 읽는다. (코드 강조 등 화면 장식 없이) */
export async function markdownToDom(VditorClass, markdown, cdn) {
  const html = await VditorClass.md2html(markdown, {
    cdn,
    mode: "light",
    markdown: { toc: false, mark: true, footnotes: true, autoSpace: false },
    math: { engine: "KaTeX" },
  });
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
}

/* ---------------- 텍스트 (.txt) ---------------- */

/**
 * 마크다운 기호(#, **, >, ``` 등)를 모두 없앤 순수 텍스트를 만든다.
 * 목록은 •, 번호, ☐/☑ 로, 표는 탭으로 구분한 줄로 바꾼다. 줄바꿈은 Windows 형식(CRLF).
 */
export function buildText(body) {
  const blocks = [];

  /** 인라인 요소의 글자만 (링크는 글자만, 그림은 생략) */
  function inline(node) {
    let s = "";
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) s += n.textContent;
      else if (n.nodeType !== Node.ELEMENT_NODE) continue;
      else {
        const tag = n.tagName.toLowerCase();
        if (tag === "br") s += "\n";
        else if (tag === "img") continue;
        else if (tag === "input" && n.getAttribute("type") === "checkbox") s += n.hasAttribute("checked") ? "☑ " : "☐ ";
        else s += inline(n);
      }
    }
    return s;
  }

  // 문단·제목 글자 정리. 띄어쓰기 없이 쓴 제목(#제목)처럼 마크다운이 제목으로 보지 않은 줄의 # 도 지운다.
  // (코드 블록에는 쓰지 않는다)
  const clean = (s) => s
    .replace(/\uFEFF/g, "")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .replace(/^#{1,6}[ \t]*/gm, "");

  function list(n, depth) {
    const lines = [];
    let i = 0;
    for (const li of n.children) {
      if (li.tagName.toLowerCase() !== "li") continue;
      i++;
      const own = document.createElement("div");
      const nested = [];
      for (const c of [...li.childNodes]) {
        const t = c.tagName?.toLowerCase();
        if (t === "ul" || t === "ol") nested.push(c);
        else if (t === "p") own.append(...c.cloneNode(true).childNodes, " ");
        else own.append(c.cloneNode(true));
      }
      const isTask = !!own.querySelector('input[type="checkbox"]');
      const mark = isTask ? "" : n.tagName.toLowerCase() === "ol" ? `${i}. ` : "• ";
      lines.push(`${"    ".repeat(depth)}${mark}${clean(inline(own))}`);
      for (const sub of nested) lines.push(...list(sub, depth + 1));
    }
    return lines;
  }

  function block(n) {
    const tag = n.tagName?.toLowerCase();
    if (!tag) {
      const text = clean(n.textContent);
      if (text) blocks.push(text);
      return;
    }
    if (/^h[1-6]$/.test(tag) || tag === "p") {
      const text = clean(inline(n));
      if (text) blocks.push(text);
    } else if (tag === "ul" || tag === "ol") {
      blocks.push(list(n, 0).join("\n"));
    } else if (tag === "blockquote") {
      for (const c of n.children) block(c);
    } else if (tag === "pre") {
      blocks.push(n.textContent.replace(/\n$/, ""));
    } else if (tag === "table") {
      const rows = [...n.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => clean(inline(c))).join("\t"));
      if (rows.length) blocks.push(rows.join("\n"));
    } else if (tag === "hr") {
      // 구분선은 빈 줄로만 남긴다.
    } else if (tag === "div" || tag === "section" || tag === "details") {
      for (const c of n.childNodes) block(c);
    } else {
      const text = clean(inline(n));
      if (text) blocks.push(text);
    }
  }

  for (const n of body.childNodes) block(n);
  return `${blocks.join("\n\n")}\n`.replace(/\r?\n/g, "\r\n");
}

/* ---------------- Word (.docx) ---------------- */

const CODE_FONT = "Consolas";
const BODY_FONT = "Malgun Gothic";
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

export async function buildDocx(body, resolveLocal) {
  let olInstance = 0;
  const children = [];

  /** 인라인 요소 → TextRun 목록 */
  async function runs(node, style = {}) {
    const out = [];
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent.replace(/\n/g, " ");
        if (text) out.push(new TextRun({ text, ...style }));
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === "strong" || tag === "b") out.push(...(await runs(n, { ...style, bold: true })));
      else if (tag === "em" || tag === "i") out.push(...(await runs(n, { ...style, italics: true })));
      else if (tag === "del" || tag === "s") out.push(...(await runs(n, { ...style, strike: true })));
      else if (tag === "u") out.push(...(await runs(n, { ...style, underline: {} })));
      else if (tag === "mark") out.push(...(await runs(n, { ...style, highlight: "yellow" })));
      else if (tag === "code") out.push(new TextRun({ text: n.textContent, ...style, font: CODE_FONT, shading: { type: ShadingType.CLEAR, fill: "F0F0F0", color: "auto" } }));
      else if (tag === "br") out.push(new TextRun({ text: "", break: 1 }));
      else if (tag === "a") {
        const linkRuns = await runs(n, { ...style, style: "Hyperlink" });
        const href = n.getAttribute("href");
        if (href) out.push(new ExternalHyperlink({ link: href, children: linkRuns }));
        else out.push(...linkRuns);
      } else if (tag === "img") {
        const png = await imageAsPng(n.getAttribute("src"), resolveLocal);
        if (png) out.push(new ImageRun({ type: "png", data: png.bytes, transformation: fit(png.width, png.height, 600) }));
        else out.push(new TextRun({ text: t("export.imageAlt", { alt: n.getAttribute("alt") ?? "" }), italics: true }));
      } else if (tag === "input" && n.getAttribute("type") === "checkbox") {
        out.push(new TextRun({ text: n.hasAttribute("checked") ? "☑ " : "☐ ", ...style }));
      } else out.push(...(await runs(n, style)));
    }
    return out;
  }

  /** 블록 요소 하나 → Paragraph/Table 목록 */
  async function block(n, ctx = { level: 0, indent: 0 }) {
    const tag = n.tagName?.toLowerCase();
    if (!tag) {
      const text = n.textContent.trim();
      if (text) children.push(new Paragraph({ children: [new TextRun(text)] }));
      return;
    }
    const indent = ctx.indent ? { left: ctx.indent } : undefined;
    const quoteBorder = ctx.quote ? { left: { style: BorderStyle.SINGLE, size: 12, color: "CCCCCC", space: 8 } } : undefined;
    if (/^h[1-6]$/.test(tag)) {
      children.push(new Paragraph({ heading: HEADINGS[Number(tag[1]) - 1], children: await runs(n) }));
    } else if (tag === "p") {
      children.push(new Paragraph({ children: await runs(n), indent, border: quoteBorder, spacing: { after: 120 } }));
    } else if (tag === "ul" || tag === "ol") {
      const instance = tag === "ol" ? ++olInstance : 0;
      for (const li of n.children) {
        if (li.tagName.toLowerCase() !== "li") continue;
        const inline = document.createElement("div");
        const nested = [];
        for (const c of [...li.childNodes]) {
          const t = c.tagName?.toLowerCase();
          if (t === "ul" || t === "ol") nested.push(c);
          else if (t === "p") inline.append(...c.cloneNode(true).childNodes, " ");
          else inline.append(c.cloneNode(true));
        }
        // 할 일 목록은 글머리 기호 없이 체크박스만 보여 준다.
        const isTask = !!li.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
        children.push(new Paragraph({
          children: await runs(inline),
          ...(isTask
            ? { indent: { left: 360 * (ctx.level + 1) } }
            : tag === "ol"
            ? { numbering: { reference: "ordered", level: Math.min(ctx.level, 8), instance } }
            : { bullet: { level: Math.min(ctx.level, 8) } }),
        }));
        for (const sub of nested) await block(sub, { ...ctx, level: ctx.level + 1 });
      }
    } else if (tag === "blockquote") {
      for (const c of n.children) await block(c, { ...ctx, indent: (ctx.indent || 0) + 480, quote: true });
    } else if (tag === "pre") {
      const lines = n.textContent.replace(/\n$/, "").split("\n");
      lines.forEach((line, i) => children.push(new Paragraph({
        children: [new TextRun({ text: line || " ", font: CODE_FONT, size: 19 })],
        shading: { type: ShadingType.CLEAR, fill: "F6F8FA", color: "auto" },
        spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 120 : 0 },
        indent,
      })));
    } else if (tag === "table") {
      const rows = [];
      for (const tr of n.querySelectorAll("tr")) {
        const cells = [];
        for (const cell of tr.children) {
          const header = cell.tagName.toLowerCase() === "th";
          cells.push(new TableCell({
            children: [new Paragraph({ children: await runs(cell, header ? { bold: true } : {}) })],
            shading: header ? { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" } : undefined,
          }));
        }
        if (cells.length) rows.push(new TableRow({ children: cells }));
      }
      if (rows.length) {
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        children.push(new Paragraph(""));
      }
    } else if (tag === "hr") {
      children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BBBBBB", space: 1 } } }));
    } else if (tag === "div" || tag === "section" || tag === "details") {
      for (const c of n.childNodes) await block(c, ctx);
    } else {
      children.push(new Paragraph({ children: await runs(n), indent }));
    }
  }

  for (const n of body.childNodes) await block(n);

  const doc = new Document({
    styles: {
      default: { document: { run: { font: BODY_FONT, size: 22 } } },
    },
    numbering: {
      config: [{
        reference: "ordered",
        levels: Array.from({ length: 9 }, (_, level) => ({
          level,
          format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    sections: [{ children }],
  });
  return Packer.toBase64String(doc);
}

/* ---------------- RTF ---------------- */

/** RTF 글자 이스케이프 (한글 등은 \uN? 로) */
function rtfText(s) {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (ch === "\\" || ch === "{" || ch === "}") out += `\\${ch}`;
    else if (ch === "\n") out += " ";
    else if (ch === "\t") out += "\\tab ";
    else if (code < 128) out += ch;
    else if (code > 0xffff) {
      const v = code - 0x10000;
      const hi = 0xd800 + (v >> 10);
      const lo = 0xdc00 + (v & 0x3ff);
      out += `\\u${hi - 65536}?\\u${lo - 65536}?`;
    } else out += `\\u${code > 32767 ? code - 65536 : code}?`;
  }
  return out;
}

const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export async function buildRtf(body, resolveLocal) {
  const out = [];
  const HEADING_SIZE = [40, 32, 28, 24, 22, 22];

  async function inline(node) {
    let s = "";
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        s += rtfText(n.textContent);
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === "strong" || tag === "b") s += `{\\b ${await inline(n)}}`;
      else if (tag === "em" || tag === "i") s += `{\\i ${await inline(n)}}`;
      else if (tag === "del" || tag === "s") s += `{\\strike ${await inline(n)}}`;
      else if (tag === "u") s += `{\\ul ${await inline(n)}}`;
      else if (tag === "mark") s += `{\\highlight4 ${await inline(n)}}`;
      else if (tag === "code") s += `{\\f1\\highlight3 ${rtfText(n.textContent)}}`;
      else if (tag === "br") s += "\\line ";
      else if (tag === "a") {
        const href = n.getAttribute("href") ?? "";
        s += `{\\field{\\*\\fldinst HYPERLINK "${href.replace(/"/g, "")}"}{\\fldrslt {\\cf1\\ul ${await inline(n)}}}}`;
      } else if (tag === "img") {
        const png = await imageAsPng(n.getAttribute("src"), resolveLocal);
        if (png) {
          const size = fit(png.width, png.height, 600);
          s += `{\\pict\\pngblip\\picw${png.width}\\pich${png.height}\\picwgoal${size.width * 15}\\pichgoal${size.height * 15} ${bytesToHex(png.bytes)}}`;
        } else s += `{\\i ${rtfText(t("export.imageAlt", { alt: n.getAttribute("alt") ?? "" }))}}`;
      } else if (tag === "input" && n.getAttribute("type") === "checkbox") {
        s += rtfText(n.hasAttribute("checked") ? "☑ " : "☐ ");
      } else s += await inline(n);
    }
    return s;
  }

  async function block(n, ctx = { level: 0, indent: 0, quote: false }) {
    const tag = n.tagName?.toLowerCase();
    const li = ctx.indent ? `\\li${ctx.indent}` : "";
    const border = ctx.quote ? "\\brdrl\\brdrs\\brdrw20\\brsp120\\brdrcf2" : "";
    if (!tag) {
      const text = n.textContent.trim();
      if (text) out.push(`\\pard${li}\\sa120 ${rtfText(text)}\\par`);
      return;
    }
    if (/^h[1-6]$/.test(tag)) {
      const lv = Number(tag[1]);
      out.push(`\\pard\\sb240\\sa120\\keepn{\\b\\fs${HEADING_SIZE[lv - 1]} ${await inline(n)}}\\par`);
    } else if (tag === "p") {
      out.push(`\\pard${li}${border}\\sa120 ${await inline(n)}\\par`);
    } else if (tag === "ul" || tag === "ol") {
      let i = 0;
      for (const item of n.children) {
        if (item.tagName.toLowerCase() !== "li") continue;
        i++;
        const indent = (ctx.indent || 0) + 360 * (ctx.level + 1);
        const isTask = !!item.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
        const mark = tag === "ol" ? `${i}.` : "\\u8226?";
        const inlinePart = document.createElement("div");
        const nested = [];
        for (const c of [...item.childNodes]) {
          const t = c.tagName?.toLowerCase();
          if (t === "ul" || t === "ol") nested.push(c);
          else if (t === "p") inlinePart.append(...c.cloneNode(true).childNodes, " ");
          else inlinePart.append(c.cloneNode(true));
        }
        out.push(isTask
          ? `\\pard\\li${indent}\\sa60 ${await inline(inlinePart)}\\par`
          : `\\pard\\li${indent + 360}\\fi-360\\sa60 ${mark}\\tab ${await inline(inlinePart)}\\par`);
        for (const sub of nested) await block(sub, { ...ctx, level: ctx.level + 1 });
      }
    } else if (tag === "blockquote") {
      for (const c of n.children) await block(c, { ...ctx, indent: (ctx.indent || 0) + 480, quote: true });
    } else if (tag === "pre") {
      const lines = n.textContent.replace(/\n$/, "").split("\n").map(rtfText).join("\\line ");
      out.push(`\\pard${li}\\sb120\\sa120\\cbpat3{\\f1\\fs19 ${lines}}\\par`);
    } else if (tag === "table") {
      for (const tr of n.querySelectorAll("tr")) {
        const cells = [...tr.children];
        if (!cells.length) continue;
        const width = Math.floor(9000 / cells.length);
        let row = "\\trowd\\trgaph108";
        cells.forEach((_, i) => {
          row += `\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${width * (i + 1)}`;
        });
        for (const cell of cells) {
          const text = await inline(cell);
          row += `\\pard\\intbl ${cell.tagName.toLowerCase() === "th" ? `{\\b ${text}}` : text}\\cell`;
        }
        out.push(`${row}\\row`);
      }
      out.push("\\pard\\par");
    } else if (tag === "hr") {
      out.push("\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par");
    } else if (tag === "div" || tag === "section" || tag === "details") {
      for (const c of n.childNodes) await block(c, ctx);
    } else {
      out.push(`\\pard${li}\\sa120 ${await inline(n)}\\par`);
    }
  }

  for (const n of body.childNodes) await block(n);

  return [
    "{\\rtf1\\ansi\\ansicpg949\\deff0\\uc1",
    "{\\fonttbl{\\f0\\fnil\\fcharset129 Malgun Gothic;}{\\f1\\fmodern Consolas;}}",
    "{\\colortbl;\\red5\\green99\\blue193;\\red204\\green204\\blue204;\\red240\\green240\\blue240;\\red255\\green255\\blue0;}",
    "\\viewkind4\\f0\\fs22",
    ...out,
    "}",
  ].join("\n");
}
