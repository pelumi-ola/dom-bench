# Front-End Framework DOM Benchmark: React vs Angular vs Vue vs Svelte

The same to-do list app built four times, then benchmarked on rendering, updating and deleting DOM nodes.

| Deliverable | Location |
|---|---|
| React app | [`apps/react`](apps/react) (React 19, Vite) |
| Angular app | [`apps/angular`](apps/angular) (Angular 20, standalone, `*ngFor`/`*ngIf`, `[(ngModel)]`) |
| Vue app | [`apps/vue`](apps/vue) (Vue 3.5, `<script setup>`, `v-for`/`v-model`) |
| Svelte app | [`apps/svelte`](apps/svelte) (Svelte 5, runes) |
| Benchmark results (tables + charts) | [`results/RESULTS.md`](results/RESULTS.md), raw data in [`results/results.json`](results/results.json) |
| Reflection report | [`REFLECTION.md`](REFLECTION.md) |

## Features (identical in all four apps)

- Add a task (name + priority: Low / Medium / High)
- View all tasks with a coloured priority badge
- Edit a task's name or priority inline (Save / Cancel)
- Delete a task

Shared code lives in [`shared/`](shared): the CSS, the deterministic task generator, and the `window.bench` contract every app implements. This guarantees all four do exactly the same work.

## Results summary

Headless Chromium 141, median of 30 iterations after 5 warm-ups (ms). Full tables, standard deviations and charts are in [`results/RESULTS.md`](results/RESULTS.md).

| Metric | React | Angular | Vue | Svelte |
|---|---|---|---|---|
| Render 100 tasks | **5.8** | 5.9 | 7.4 | 6.5 |
| Render 500 tasks | **22.2** | 26.1 | 25.5 | 28.4 |
| Render 1000 tasks | **37.6** | 47.9 | 43.9 | 50.1 |
| Update 50 tasks (of 1000) | 2.7 | 2.8 | 2.3 | **2.2** |
| Delete 50 tasks (of 1000) | **1.7** | 2.0 | 3.8 | 4.2 |
| Cold first render, 1000 tasks | **84.9** | 152.0 | 124.1 | 130.5 |
| Retained JS heap, 1000 rows (MB) | **1.70** | 3.10 | 3.80 | 3.60 |
| Bundle, gzip (KB) | 69.0 | 64.7 | 27.2 | **15.6** |

![render](results/render.svg)
![update and delete](results/update-delete.svg)

**Read these with care:** the differences are a few milliseconds and several update/delete gaps are within one standard deviation. Two complete runs of the suite agreed closely (cold render within 3%), but this is one machine, one headless browser and one implementation per framework.

## How the benchmark works

[`benchmark/run.mjs`](benchmark/run.mjs) serves each production build, opens it in headless Chromium (Playwright) and calls `window.bench.*`:

| Operation | What it does |
|---|---|
| `render(n)` | Replace the list with `n` new tasks (n = 100, 500, 1000) |
| `update(50)` | Change name and priority of the first 50 tasks |
| `remove(50)` | Delete the first 50 tasks |

- **What is timed:** `performance.now()` around the operation, the framework's own DOM flush (`flushSync` / `nextTick` / `detectChanges`), and a forced style + layout (`document.body.offsetHeight`). Paint is excluded because it is quantised to the 16 ms frame and would add noise.
- **Warm runs:** one page per framework, 5 discarded warm-up iterations, then 30 measured iterations per list size (`reset -> render N -> update 50 -> delete 50`).
- **Cold start:** first render of 1000 tasks on a freshly loaded page, 15 runs (includes JIT warm-up).
- **Memory:** JS heap (`Runtime.getHeapUsage` via CDP) after forced garbage collection, with 1000 rows minus an empty-list baseline, median of 7 fresh pages. This excludes native DOM memory; DOM element counts are reported separately.
- **Correctness:** before timing, the runner checks each app really renders 100 rows, that updates change the DOM text and that deletes remove rows.
- **Production builds** are measured (not dev servers). Bundle size is gzip of all JS and CSS.

## Run it yourself

Requires Node 20+.

```bash
npm run install:all                      # install the four apps + benchmark runner
npx --prefix benchmark playwright install chromium   # first time only
npm run build:all                        # production builds into apps/*/dist
npm run bench                            # run benchmark and regenerate results/
```

Tuning: `ITER=50 WARMUP=10 COLD=20 MEM=10 npm run bench`. If Playwright cannot find a browser, set `CHROME_PATH=/path/to/chrome`.

To try an app by hand: `cd apps/react && npm run dev` (same for `vue` and `svelte`; use `npm start` for Angular).

## Implementation notes per framework

- **React:** state in `useState`; `TaskItem` wrapped in `memo` with `useCallback` handlers so only changed rows re-render; list keyed by id.
- **Angular:** `*ngFor` with `trackBy`, `*ngIf` for empty state and edit mode, `[(ngModel)]` two-way binding, default (zone.js) change detection.
- **Vue:** deep-reactive `ref` array, `v-for` with `:key`, `v-model`, a `TaskItem` component with props/emits.
- **Svelte:** `$state` runes, keyed `{#each}`, `bind:value`, `TaskItem` component with callback props.

## Limitations

- Implementations follow each framework's idiomatic style; heavier tuning (e.g. Angular `OnPush`/signals, Vue `shallowRef`, Svelte raw arrays) would change the numbers.
- Results are specific to the machine used. Re-run on your own computer and report that if you can.
