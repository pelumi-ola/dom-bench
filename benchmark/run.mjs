// Benchmarks React / Angular / Vue / Svelte to-do apps in headless Chromium.
//   node run.mjs                 (defaults)    ITER=30 WARMUP=5 node run.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORKS = ["react", "angular", "vue", "svelte"];
const SIZES = [100, 500, 1000];
const ITER = +process.env.ITER || 20;       // measured iterations per size
const WARMUP = +process.env.WARMUP || 5;    // discarded iterations (JIT warm-up)
const COLD_RUNS = +process.env.COLD || 10;  // fresh page loads for the cold-start test
const MEM_RUNS = +process.env.MEM || 5;
const OPS_N = 50;                           // tasks updated / deleted

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const stats = (a) => ({ median: median(a), mean: mean(a), sd: sd(a), min: Math.min(...a), p90: q(a, 0.9), n: a.length });

// Runs inside the page. Timer covers: JS work + framework flush + forced style/layout.
// (Paint/compositing is excluded to avoid 16 ms vsync quantisation noise.)
const PAGE_FN = async ([op, n]) => {
  const t0 = performance.now();
  await window.bench[op](n);
  void document.body.offsetHeight;           // force synchronous style recalculation + layout
  return performance.now() - t0;
};

async function open(browser, base, fw) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/${fw}/`);
  await page.waitForFunction(() => window.bench, null, { timeout: 15000 });
  return { ctx, page, errors };
}
const count = (page) => page.evaluate(() => document.querySelectorAll("li.task").length);
const gc = async (cdp) => { await cdp.send("HeapProfiler.collectGarbage"); await cdp.send("HeapProfiler.collectGarbage"); };
const heap = async (cdp) => (await cdp.send("Runtime.getHeapUsage")).usedSize;

async function verify(page) {            // correctness check so we never time a broken app
  await page.evaluate(() => window.bench.reset());
  await page.evaluate(() => window.bench.render(100));
  if ((await count(page)) !== 100) throw new Error("render(100) did not produce 100 rows");
  await page.evaluate(() => window.bench.update(50));
  const first = await page.evaluate(() => document.querySelector("li.task .title").textContent);
  if (!first.endsWith("(edited)")) throw new Error("update did not change DOM text: " + first);
  await page.evaluate(() => window.bench.remove(50));
  if ((await count(page)) !== 50) throw new Error("remove(50) did not leave 50 rows");
  await page.evaluate(() => window.bench.reset());
  if ((await count(page)) !== 0) throw new Error("reset did not clear rows");
}

function bundleSize(fw) {
  const dist = path.resolve(here, "../apps", fw, "dist");
  let raw = 0, gz = 0;
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css)$/.test(f)) { const b = fs.readFileSync(p); raw += b.length; gz += zlib.gzipSync(b).length; } } };
  walk(dist);
  return { rawKB: raw / 1024, gzipKB: gz / 1024 };
}

const { server, port } = await startServer();
const base = `http://localhost:${port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--enable-precise-memory-info", "--js-flags=--expose-gc", "--disable-background-timer-throttling"],
});
console.log("Chromium", browser.version(), `| ITER=${ITER} WARMUP=${WARMUP}`);

const results = { meta: { chromium: browser.version(), iterations: ITER, warmup: WARMUP, coldRuns: COLD_RUNS, opsN: OPS_N, date: new Date().toISOString(), node: process.version }, frameworks: {} };

for (const fw of FRAMEWORKS) {
  console.log(`\n== ${fw}`);
  const out = { render: {}, update: {}, remove: {}, cold: null, memory: null, bundle: bundleSize(fw) };

  // ---- warm benchmark: one page, WARMUP + ITER passes of (render N -> update 50 -> remove 50)
  const { ctx, page, errors } = await open(browser, base, fw);
  await verify(page);
  for (const N of SIZES) {
    const r = [], u = [], d = [];
    for (let i = 0; i < WARMUP + ITER; i++) {
      await page.evaluate(PAGE_FN, ["reset", 0]);
      const tr = await page.evaluate(PAGE_FN, ["render", N]);
      const tu = await page.evaluate(PAGE_FN, ["update", OPS_N]);
      const td = await page.evaluate(PAGE_FN, ["remove", OPS_N]);
      if (i >= WARMUP) { r.push(tr); u.push(tu); d.push(td); }
    }
    out.render[N] = stats(r); out.update[N] = stats(u); out.remove[N] = stats(d);
    console.log(`  N=${N}: render ${out.render[N].median.toFixed(1)} ms | update50 ${out.update[N].median.toFixed(1)} ms | delete50 ${out.remove[N].median.toFixed(1)} ms`);
  }
  if (errors.length) console.warn("  page errors:", errors);
  await ctx.close();

  // ---- cold start: very first render of 1000 rows on a fresh page (includes JIT warm-up)
  const cold = [];
  for (let i = 0; i < COLD_RUNS; i++) {
    const c = await open(browser, base, fw);
    cold.push(await c.page.evaluate(PAGE_FN, ["render", 1000]));
    await c.ctx.close();
  }
  out.cold = stats(cold);
  console.log(`  cold render 1000: median ${out.cold.median.toFixed(1)} ms`);

  // ---- memory: retained JS heap + DOM nodes with 1000 rows (after forced GC) minus empty-list baseline
  const mem = [], nodes = [];
  for (let i = 0; i < MEM_RUNS; i++) {
    const c = await open(browser, base, fw);
    const cdp = await c.ctx.newCDPSession(c.page);
    await cdp.send("HeapProfiler.enable");
    await c.page.evaluate(PAGE_FN, ["render", 10]);      // touch code paths
    await c.page.evaluate(PAGE_FN, ["reset", 0]);
    await gc(cdp); const base0 = await heap(cdp);
    await c.page.evaluate(PAGE_FN, ["render", 1000]);
    await gc(cdp); const with1000 = await heap(cdp);
    mem.push((with1000 - base0) / 1024 / 1024);
    nodes.push(await c.page.evaluate(() => document.getElementsByTagName("*").length));
    await c.ctx.close();
  }
  out.memory = { heapDeltaMB: stats(mem), domNodes: median(nodes) };
  console.log(`  memory (1000 rows): +${out.memory.heapDeltaMB.median.toFixed(2)} MB heap, ${out.memory.domNodes} DOM elements`);

  results.frameworks[fw] = out;
}

await browser.close();
server.close();
fs.mkdirSync(path.join(here, "../results"), { recursive: true });
fs.writeFileSync(path.join(here, "../results/results.json"), JSON.stringify(results, null, 2));
console.log("\nSaved results/results.json");
