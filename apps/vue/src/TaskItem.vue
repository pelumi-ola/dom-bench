<script setup>
import { ref } from "vue";
import { PRIORITIES } from "../../../shared/data.js";
const props = defineProps({ task: Object });
const emit = defineEmits(["save", "remove"]);
const editing = ref(false);
const name = ref("");
const priority = ref("");
function startEdit() { name.value = props.task.name; priority.value = props.task.priority; editing.value = true; }
function save() { emit("save", props.task.id, name.value, priority.value); editing.value = false; }
</script>

<template>
  <li class="task" v-if="editing">
    <input class="name" v-model="name" />
    <select v-model="priority"><option v-for="p in PRIORITIES" :key="p">{{ p }}</option></select>
    <button class="primary" @click="save">Save</button>
    <button @click="editing = false">Cancel</button>
  </li>
  <li class="task" v-else>
    <span class="title">{{ task.name }}</span>
    <span :class="['badge', task.priority]">{{ task.priority }}</span>
    <button @click="startEdit">Edit</button>
    <button @click="emit('remove', task.id)">Delete</button>
  </li>
</template>
