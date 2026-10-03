import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import TaskItem from "./TaskItem.jsx";
import { PRIORITIES, makeTasks, editedName, nextPriority, installBench } from "../../../shared/data.js";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [name, setName] = useState("");
  const [priority, setPriority] = useState("Medium");
  const nextId = useRef(1_000_000);

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setTasks((t) => [...t, { id: nextId.current++, name: name.trim(), priority }]);
    setName("");
  };
  // Stable callbacks so memo() on TaskItem actually works.
  const save = useCallback((id, n, p) =>
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, name: n, priority: p } : x))), []);
  const remove = useCallback((id) => setTasks((t) => t.filter((x) => x.id !== id)), []);

  // ---- benchmark hooks: flushSync forces React to commit to the DOM before returning
  useEffect(() => {
    const sync = (fn) => { flushSync(fn); return Promise.resolve(); };
    installBench({
      reset: () => sync(() => setTasks([])),
      render: (n) => sync(() => setTasks(makeTasks(n))),
      update: (n) => sync(() => setTasks((t) =>
        t.map((x, i) => (i < n ? { ...x, name: editedName(x.name), priority: nextPriority(x.priority) } : x)))),
      remove: (n) => sync(() => setTasks((t) => t.slice(n))),
    });
  }, []);

  return (
    <div className="app">
      <h1>To-do list — React</h1>
      <p className="sub">{tasks.length} tasks</p>
      <form className="add" onSubmit={add}>
        <input className="name" placeholder="Task name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button className="primary">Add</button>
      </form>
      {tasks.length === 0 ? <div className="empty">No tasks yet</div> : (
        <ul className="tasks">
          {tasks.map((t) => <TaskItem key={t.id} task={t} onSave={save} onRemove={remove} />)}
        </ul>
      )}
    </div>
  );
}
