"use client";

import { useState } from "react";
import { Plus, X, Edit2, Check } from "lucide-react";
import { db, Group, Person } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

interface MembersTabProps {
  group: Group;
  persons: Person[];
  onRefresh: () => void;
}

export function MembersTab({ group, persons, onRefresh }: MembersTabProps) {
  const [newMemberName, setNewMemberName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    try {
      const person: Person = {
        id: uuidv4(),
        groupId: group.id,
        name: newMemberName.trim(),
        createdAt: Date.now(),
      };

      await db.persons.add(person);
      setNewMemberName("");
      onRefresh();
    } catch (error) {
      console.error("Failed to add member:", error);
    }
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this member?")) return;

    try {
      await db.persons.delete(id);
      onRefresh();
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  }

  async function startEditing(person: Person) {
    setEditingId(person.id);
    setEditName(person.name);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;

    try {
      await db.persons.update(editingId, { name: editName.trim() });
      setEditingId(null);
      setEditName("");
      onRefresh();
    } catch (error) {
      console.error("Failed to update member:", error);
    }
  }

  return (
    <div className="space-y-6">
      {!group.isClosed && (
        <form onSubmit={addMember} className="flex gap-2">
          <input
            type="text"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Add new member..."
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            disabled={!newMemberName.trim()}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
      )}

      <div className="space-y-2">
        {persons.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No members yet. Add members to start splitting expenses.
          </p>
        ) : (
          persons.map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm"
            >
              {editingId === person.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-slate-300 px-3 py-1 focus:border-emerald-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={saveEdit}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-slate-900">{person.name}</span>
                  {!group.isClosed && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditing(person)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeMember(person.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
