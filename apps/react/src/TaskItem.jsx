import { memo, useState } from "react";
import { PRIORITIES } from "../../../shared/data.js";

// memo(): a row only re-renders when ITS task object changes.
function TaskItem({ task, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(task.name);
  const [priority, setPriority] = useState(task.priority);

  if (editing) {
    return (
      <li className="task">
        <input className="name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button className="primary" onClick={() => { onSave(task.id, name, priority); setEditing(false); }}>Save</button>
        <button onClick={() => setEditing(false)}>Cancel</button>
      </li>
    );
  }
  return (
    <li className="task">
      <span className="title">{task.name}</span>
      <span className={`badge ${task.priority}`}>{task.priority}</span>
      <button onClick={() => { setName(task.name); setPriority(task.priority); setEditing(true); }}>Edit</button>
      <button onClick={() => onRemove(task.id)}>Delete</button>
    </li>
  );
}
export default memo(TaskItem);
