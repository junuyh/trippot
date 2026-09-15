// ============================================================================
// budget-products · reference.ts 가 앱 상수와 같은지 점검
//
//   node supabase/functions/budget-products/check-reference.mjs
//
// ⚠️ **budget-products 를 배포하기 전에 돌린다.** reference.ts 는 배포할 때만
//    서버에 반영되므로, 맞춰야 하는 시점이 곧 배포 시점이다.
//    아무것도 안 나오면 그대로 배포한다. 어긋난 줄이 나오면 reference.ts 를
//    앱 상수에 맞춘 뒤 다시 돌린다.
//
// ⚠️ 앱 상수를 import 하지 않고 글자로 읽는다. 앱 상수는 '@/…' 경로와 확장자 없는
//    import 를 써서 node 로 바로 불러올 수 없다. 그래서 상수 파일의 모양이 크게
//    바뀌면 이 점검이 "0개 읽음" 으로 멈춘다. 그때는 아래 정규식을 맞춘다.
// ============================================================================
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ? resolve(process.argv[2]) : resolve(here, "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

/** `export const NAME ... = { ... }` 블록 안의 글자만 */
function block(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) return "";
  // ⚠️ 타입 선언 안의 { 를 잡지 않게 = 뒤에서 찾는다. `Record<string, { … }> = {`
  const open = source.indexOf("{", source.indexOf("=", start));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(open, i + 1);
  }
  return "";
}

// ── 앱 상수 ─────────────────────────────────────────────────────────────────

const destinationsTs = read("lib/constants/destinations.ts");
const codeOf = Object.fromEntries(
  [...block(destinationsTs, "DESTINATION_CODE").matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]),
);
const appDestinations = Object.fromEntries(
  [...destinationsTs.matchAll(/code:\s*DESTINATION_CODE\.(\w+),\s*nameKo:\s*'([^']+)'/g)].map((m) => [
    codeOf[m[1]] ?? `?${m[1]}`,
    m[2],
  ]),
);

const statusTs = read("lib/constants/status.ts");
const appCategories = Object.fromEntries(
  [...block(statusTs, "CATEGORY_CODE_LABEL").matchAll(/(\w+):\s*"([^"]+)"/g)]
    .filter((m) => m[1] !== "CONTINGENCY")
    .map((m) => [m[1], m[2]]),
);

const productsTs = read("lib/constants/budgetProducts.ts");
const appProducts = {};
let currentCategory = null;
for (const line of productsTs.split("\n")) {
  const category = line.match(/categoryCode:\s*CATEGORY_CODE\.(\w+)/);
  if (category) currentCategory = category[1];
  const product = line.match(/id:\s*'([^']+)',\s*name:\s*'([^']+)'/);
  if (product) appProducts[product[1]] = { category: currentCategory, name: product[2] };
}

// ── reference.ts ────────────────────────────────────────────────────────────

const referenceTs = read("supabase/functions/budget-products/reference.ts");
const serverDestinations = Object.fromEntries(
  [...block(referenceTs, "DESTINATION_NAME").matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
);
const serverCategories = Object.fromEntries(
  [...block(referenceTs, "CATEGORY_LABEL").matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
);
const serverProducts = Object.fromEntries(
  [...block(referenceTs, "PRODUCT").matchAll(/"([^"]+)":\s*\{\s*category:\s*"(\w+)",\s*name:\s*"([^"]+)"\s*\}/g)].map(
    (m) => [m[1], { category: m[2], name: m[3] }],
  ),
);

// ── 비교 ────────────────────────────────────────────────────────────────────

const problems = [];

function compare(label, app, server, same, show) {
  for (const key of Object.keys(app)) {
    if (!(key in server)) problems.push(`${label}  앱에만 있음: ${key} ${show(app[key])}`);
    else if (!same(app[key], server[key]))
      problems.push(`${label}  다름: ${key}  앱 ${show(app[key])} / 서버 ${show(server[key])}`);
  }
  for (const key of Object.keys(server)) {
    if (!(key in app)) problems.push(`${label}  서버에만 있음: ${key} ${show(server[key])}`);
  }
}

const counts = [
  ["목적지", appDestinations, serverDestinations],
  ["카테고리", appCategories, serverCategories],
  ["상품", appProducts, serverProducts],
];
for (const [label, app, server] of counts) {
  if (Object.keys(app).length === 0 || Object.keys(server).length === 0) {
    problems.push(`${label}  읽은 개수 0 — 상수 파일 모양이 바뀌었다. 이 스크립트의 정규식을 맞춘다`);
  }
}

compare("목적지", appDestinations, serverDestinations, (a, b) => a === b, (v) => `'${v}'`);
compare("카테고리", appCategories, serverCategories, (a, b) => a === b, (v) => `'${v}'`);
compare(
  "상품",
  appProducts,
  serverProducts,
  (a, b) => a.category === b.category && a.name === b.name,
  (v) => `${v.category} '${v.name}'`,
);

const summary = counts.map(([label, app]) => `${label} ${Object.keys(app).length}`).join(" · ");
if (problems.length === 0) {
  console.log(`reference.ts 가 앱 상수와 같습니다. (${summary}) 그대로 배포하면 됩니다.`);
} else {
  console.log(`reference.ts 가 앱 상수와 다릅니다. 맞춘 뒤 배포하세요. (${summary})\n`);
  for (const line of problems) console.log(`  ${line}`);
  process.exitCode = 1;
}
