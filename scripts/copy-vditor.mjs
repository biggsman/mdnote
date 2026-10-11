// node_modules/vditor/dist 를 public/vditor/dist 로 복사해서
// Vditor 가 CDN 대신 로컬 에셋(lute, i18n, 아이콘, 테마 등)을 쓰도록 한다.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/vditor/dist");
const dest = resolve(root, "public/vditor/dist");
const stamp = resolve(root, "public/vditor/.version");

if (!existsSync(src)) {
  console.error("[copy-vditor] node_modules/vditor 가 없습니다. 먼저 npm install 을 실행하세요.");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(resolve(root, "node_modules/vditor/package.json"), "utf8"));
if (existsSync(stamp) && existsSync(dest) && readFileSync(stamp, "utf8") === version) {
  console.log(`[copy-vditor] vditor ${version} 에셋이 이미 최신입니다.`);
  process.exit(0);
}

rmSync(resolve(root, "public/vditor"), { recursive: true, force: true });
cpSync(src, dest, { recursive: true, filter: (p) => !p.endsWith(".d.ts") });
writeFileSync(stamp, version);
console.log(`[copy-vditor] vditor ${version} 에셋을 public/vditor/dist 로 복사했습니다.`);
