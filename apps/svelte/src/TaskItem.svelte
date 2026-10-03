<script>
  import { PRIORITIES } from "../../../shared/data.js";
  let { task, onsave, onremove } = $props();
  let editing = $state(false);
  let name = $state("");
  let priority = $state("");
  function startEdit() { name = task.name; priority = task.priority; editing = true; }
  function save() { onsave(task.id, name, priority); editing = false; }
</script>

{#if editing}
  <li class="task">
    <input class="name" bind:value={name} />
    <select bind:value={priority}>{#each PRIORITIES as p (p)}<option>{p}</option>{/each}</select>
    <button class="primary" onclick={save}>Save</button>
    <button onclick={() => (editing = false)}>Cancel</button>
  </li>
{:else}
  <li class="task">
    <span class="title">{task.name}</span>
    <span class="badge {task.priority}">{task.priority}</span>
    <button onclick={startEdit}>Edit</button>
    <button onclick={() => onremove(task.id)}>Delete</button>
  </li>
{/if}
