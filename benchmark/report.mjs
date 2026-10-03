// Turns results/results.json into results/RESULTS.md + SVG bar charts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "../results");
const R = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
const FW = ["react", "angular", "vue", "svelte"];
const LABEL = { react: "React", angular: "Angular", vue: "Vue", svelte: "Svelte" };
const COLOR = { react: "#2b9fd9", angular: "#dd0031", vue: "#3fb27f", svelte: "#ff6a2b" };
const SIZES = [100, 500, 1000];
const f1 = (x) => x.toFixed(1);
const fw = (k) => R.frameworks[k];

function bar(title, groups, series, unit, file) {
  // groups: [{label, values:{fw:number}}]
  const W = 760, H = 380, L = 60, B = 60, T = 50, Rm = 20;
  const max = Math.max(...groups.flatMap((g) => FW.map((k) => g.values[k]))) * 1.15;
  const gw = (W - L - Rm) / groups.length, bw = gw / (FW.length + 1);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif" font-size="12">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/><text x="${W / 2}" y="26" text-anchor="middle" font-size="16" font-weight="600">${title}</text>`;
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    s += `<line x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" stroke="#e4e7eb"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" fill="#52606d">${v.toFixed(v < 10 ? 1 : 0)}</text>`;
  }
  s += `<text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" fill="#52606d">${unit}</text>`;
  groups.forEach((g, gi) => {
    FW.forEach((k, ki) => {
      const v = g.values[k], x = L + gi * gw + bw / 2 + ki * bw;
      s += `<rect x="${x}" y="${y(v)}" width="${bw - 3}" height="${H - B - y(v)}" fill="${COLOR[k]}"/>`;
      s += `<text x="${x + (bw - 3) / 2}" y="${y(v) - 4}" text-anchor="middle" font-size="10" fill="#323f4b">${f1(v)}</text>`;
    });
    s += `<text x="${L + gi * gw + gw / 2}" y="${H - B + 18}" text-anchor="middle">${g.label}</text>`;
  });
  FW.forEach((k, i) => {
    const x = W / 2 - 160 + i * 85;
    s += `<rect x="${x}" y="${H - 22}" width="12" height="12" fill="${COLOR[k]}"/><text x="${x + 17}" y="${H - 12}">${LABEL[k]}</text>`;
  });
  fs.writeFileSync(path.join(dir, file), s + "</svg>");
}

bar("Initial render time (median, lower is better)", SIZES.map((n) => ({ label: `${n} tasks`, values: Object.fromEntries(FW.map((k) => [k, fw(k).render[n].median])) })), FW, "milliseconds", "render.svg");
bar("Update 50 tasks / Delete 50 tasks, list of 1000 (median)", [
  { label: "Update 50", values: Object.fromEntries(FW.map((k) => [k, fw(k).update[1000].median])) },
  { label: "Delete 50", values: Object.fromEntries(FW.map((k) => [k, fw(k).remove[1000].median])) }], FW, "milliseconds", "update-delete.svg");
bar("Cold start: first render of 1000 tasks on a fresh page (median)", [
  { label: "Cold render 1000", values: Object.fromEntries(FW.map((k) => [k, fw(k).cold.median])) }], FW, "milliseconds", "cold.svg");
bar("Retained JS heap for 1000 rows (median)", [
  { label: "Heap delta (MB)", values: Object.fromEntries(FW.map((k) => [k, fw(k).memory.heapDeltaMB.median])) }], FW, "MB", "memory.svg");

const best = (get, lowerBetter = true) => { const v = FW.map((k) => [k, get(k)]).sort((a, b) => (lowerBetter ? a[1] - b[1] : b[1] - a[1])); return v[0][0]; };
const cell = (k, v, get) => (k === best(get) ? `**${f1(v)}**` : f1(v));
function table(title, key) {
  let t = `### ${title}\n\n| Tasks | ${FW.map((k) => LABEL[k]).join(" | ")} |\n|---|${FW.map(() => "---").join("|")}|\n`;
  for (const n of SIZES) t += `| ${n} | ${FW.map((k) => cell(k, fw(k)[key][n].median, (z) => fw(z)[key][n].median) + ` ±${f1(fw(k)[key][n].sd)}`).join(" | ")} |\n`;
  return t + "\n";
}
let md = `# Benchmark Results\n\n`;
md += `- Browser: headless Chromium ${R.meta.chromium}, Node ${R.meta.node}, no CPU throttling\n- Each cell: **median of ${R.meta.iterations} iterations** after ${R.meta.warmup} warm-up iterations, in milliseconds, with ±standard deviation. Best per row in bold.\n- Timer covers JS work + the framework's DOM flush + forced style/layout (paint excluded). See the README for the method.\n- Update/delete operate on ${R.meta.opsN} tasks (the first ${R.meta.opsN} rows) of a list that has the given number of tasks.\n- Run date: ${R.meta.date}\n\n`;
md += table("Initial render (ms)", "render") + table(`Update ${R.meta.opsN} tasks (ms)`, "update") + table(`Delete ${R.meta.opsN} tasks (ms)`, "remove");
md += `### Cold start: first render of 1000 tasks on a fresh page (ms)\n\n| | ${FW.map((k) => LABEL[k]).join(" | ")} |\n|---|${FW.map(() => "---").join("|")}|\n| median (n=${R.meta.coldRuns}) | ${FW.map((k) => cell(k, fw(k).cold.median, (z) => fw(z).cold.median)).join(" | ")} |\n\n`;
md += `### Memory and size\n\n| Metric | ${FW.map((k) => LABEL[k]).join(" | ")} |\n|---|${FW.map(() => "---").join("|")}|\n`;
md += `| Retained JS heap, 1000 rows (MB) | ${FW.map((k) => cell(k, fw(k).memory.heapDeltaMB.median, (z) => fw(z).memory.heapDeltaMB.median).replace(/(\d+\.\d)/, (m) => (+m).toFixed(2))).join(" | ")} |\n`;
md += `| DOM elements, 1000 rows | ${FW.map((k) => fw(k).memory.domNodes).join(" | ")} |\n`;
md += `| JS+CSS bundle, gzip (KB) | ${FW.map((k) => cell(k, fw(k).bundle.gzipKB, (z) => fw(z).bundle.gzipKB)).join(" | ")} |\n`;
md += `| JS+CSS bundle, raw (KB) | ${FW.map((k) => f1(fw(k).bundle.rawKB)).join(" | ")} |\n\n`;
md += `## Charts\n\n![render](render.svg)\n\n![update and delete](update-delete.svg)\n\n![cold start](cold.svg)\n\n![memory](memory.svg)\n`;
fs.writeFileSync(path.join(dir, "RESULTS.md"), md);
console.log(md);
