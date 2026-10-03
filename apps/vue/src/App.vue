<script setup>
import { ref, nextTick, onMounted } from "vue";
import TaskItem from "./TaskItem.vue";
import { PRIORITIES, makeTasks, editedName, nextPriority, installBench } from "../../../shared/data.js";

const tasks = ref([]);          // deep reactive: Vue tracks per-property access
const name = ref("");
const priority = ref("Medium");
let nextId = 1_000_000;

function add() {
  if (!name.value.trim()) return;
  tasks.value.push({ id: nextId++, name: name.value.trim(), priority: priority.value });
  name.value = "";
}
function save(id, n, p) {
  const t = tasks.value.find((x) => x.id === id);
  if (t) { t.name = n; t.priority = p; }
}
function remove(id) { tasks.value = tasks.value.filter((x) => x.id !== id); }

onMounted(() => {
  // nextTick() resolves after Vue has flushed its queued DOM updates
  installBench({
    reset: async () => { tasks.value = []; await nextTick(); },
    render: async (n) => { tasks.value = makeTasks(n); await nextTick(); },
    update: async (n) => {
      for (let i = 0; i < n; i++) { const t = tasks.value[i]; t.name = editedName(t.name); t.priority = nextPriority(t.priority); }
      await nextTick();
    },
    remove: async (n) => { tasks.value.splice(0, n); await nextTick(); },
  });
});
</script>

<template>
  <div class="app">
    <h1>To-do list — Vue</h1>
    <p class="sub">{{ tasks.length }} tasks</p>
    <form class="add" @submit.prevent="add">
      <input class="name" placeholder="Task name" v-model="name" />
      <select v-model="priority"><option v-for="p in PRIORITIES" :key="p">{{ p }}</option></select>
      <button class="primary">Add</button>
    </form>
    <div v-if="tasks.length === 0" class="empty">No tasks yet</div>
    <ul v-else class="tasks">
      <TaskItem v-for="t in tasks" :key="t.id" :task="t" @save="save" @remove="remove" />
    </ul>
  </div>
</template>
