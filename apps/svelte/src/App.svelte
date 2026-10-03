<script>
  import { onMount, flushSync } from "svelte";
  import TaskItem from "./TaskItem.svelte";
  import { PRIORITIES, makeTasks, editedName, nextPriority, installBench } from "../../../shared/data.js";

  let tasks = $state([]);       // fine-grained signals: only touched fields update
  let name = $state("");
  let priority = $state("Medium");
  let nextId = 1_000_000;

  function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    tasks.push({ id: nextId++, name: name.trim(), priority });
    name = "";
  }
  function save(id, n, p) {
    const t = tasks.find((x) => x.id === id);
    if (t) { t.name = n; t.priority = p; }
  }
  function remove(id) { tasks = tasks.filter((x) => x.id !== id); }

  onMount(() => {
    // flushSync() applies pending DOM updates synchronously
    installBench({
      reset: () => { tasks = []; flushSync(); return Promise.resolve(); },
      render: (n) => { tasks = makeTasks(n); flushSync(); return Promise.resolve(); },
      update: (n) => {
        for (let i = 0; i < n; i++) { const t = tasks[i]; t.name = editedName(t.name); t.priority = nextPriority(t.priority); }
        flushSync(); return Promise.resolve();
      },
      remove: (n) => { tasks.splice(0, n); flushSync(); return Promise.resolve(); },
    });
  });
</script>

<div class="app">
  <h1>To-do list — Svelte</h1>
  <p class="sub">{tasks.length} tasks</p>
  <form class="add" onsubmit={add}>
    <input class="name" placeholder="Task name" bind:value={name} />
    <select bind:value={priority}>{#each PRIORITIES as p (p)}<option>{p}</option>{/each}</select>
    <button class="primary">Add</button>
  </form>
  {#if tasks.length === 0}
    <div class="empty">No tasks yet</div>
  {:else}
    <ul class="tasks">
      {#each tasks as t (t.id)}
        <TaskItem task={t} onsave={save} onremove={remove} />
      {/each}
    </ul>
  {/if}
</div>
