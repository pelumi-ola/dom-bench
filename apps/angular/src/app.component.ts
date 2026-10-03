import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
// @ts-ignore - shared plain-JS helpers
import { PRIORITIES, makeTasks, editedName, nextPriority, installBench } from "../../../shared/data.js";

interface Task { id: number; name: string; priority: string; }

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="app">
    <h1>To-do list — Angular</h1>
    <p class="sub">{{ tasks.length }} tasks</p>
    <form class="add" (ngSubmit)="add()">
      <input class="name" name="name" placeholder="Task name" [(ngModel)]="name" />
      <select name="priority" [(ngModel)]="priority">
        <option *ngFor="let p of priorities" [value]="p">{{ p }}</option>
      </select>
      <button class="primary">Add</button>
    </form>
    <div *ngIf="tasks.length === 0" class="empty">No tasks yet</div>
    <ul *ngIf="tasks.length > 0" class="tasks">
      <li class="task" *ngFor="let t of tasks; trackBy: trackById">
        <ng-container *ngIf="editingId === t.id; else view">
          <input class="name" [(ngModel)]="draftName" />
          <select [(ngModel)]="draftPriority">
            <option *ngFor="let p of priorities" [value]="p">{{ p }}</option>
          </select>
          <button class="primary" (click)="save(t)">Save</button>
          <button (click)="editingId = null">Cancel</button>
        </ng-container>
        <ng-template #view>
          <span class="title">{{ t.name }}</span>
          <span class="badge {{ t.priority }}">{{ t.priority }}</span>
          <button (click)="startEdit(t)">Edit</button>
          <button (click)="remove(t.id)">Delete</button>
        </ng-template>
      </li>
    </ul>
  </div>`,
})
export class AppComponent implements OnInit {
  priorities: string[] = PRIORITIES;
  tasks: Task[] = [];
  name = "";
  priority = "Medium";
  editingId: number | null = null;
  draftName = "";
  draftPriority = "Medium";
  private nextId = 1_000_000;

  constructor(private cdr: ChangeDetectorRef) {}

  trackById = (_: number, t: Task) => t.id;

  add() {
    if (!this.name.trim()) return;
    this.tasks = [...this.tasks, { id: this.nextId++, name: this.name.trim(), priority: this.priority }];
    this.name = "";
  }
  startEdit(t: Task) { this.editingId = t.id; this.draftName = t.name; this.draftPriority = t.priority; }
  save(t: Task) { t.name = this.draftName; t.priority = this.draftPriority; this.editingId = null; }
  remove(id: number) { this.tasks = this.tasks.filter((x) => x.id !== id); }

  ngOnInit() {
    // detectChanges() runs change detection synchronously for this component tree
    const sync = () => { this.cdr.detectChanges(); return Promise.resolve(); };
    installBench({
      reset: () => { this.tasks = []; return sync(); },
      render: (n: number) => { this.tasks = makeTasks(n); return sync(); },
      update: (n: number) => {
        for (let i = 0; i < n; i++) { const t = this.tasks[i]; t.name = editedName(t.name); t.priority = nextPriority(t.priority); }
        return sync();
      },
      remove: (n: number) => { this.tasks = this.tasks.slice(n); return sync(); },
    });
  }
}
