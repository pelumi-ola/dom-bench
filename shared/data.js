// Shared by all four apps so every framework does exactly the same work.
export const PRIORITIES = ["Low", "Medium", "High"];

export function makeTasks(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: offset + i + 1,
    name: `Task ${offset + i + 1}`,
    priority: PRIORITIES[(offset + i) % 3],
  }));
}

export const editedName = (name) => `${name} (edited)`;
export const nextPriority = (p) => PRIORITIES[(PRIORITIES.indexOf(p) + 1) % 3];

// Every app registers an object with these four async operations on window.bench.
// Each promise resolves only AFTER the framework has flushed its DOM updates.
//   reset()   -> remove every task
//   render(n) -> replace the list with n freshly generated tasks
//   update(n) -> edit name + priority of the first n tasks
//   remove(n) -> delete the first n tasks
export function installBench(impl) {
  window.bench = impl;
}
