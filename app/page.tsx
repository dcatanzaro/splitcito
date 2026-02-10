"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Users, Trash2, ChevronRight, Settings } from "lucide-react";
import { db, Group } from "@/lib/db";
import { DataManager } from "@/components/DataManager";

export default function HomePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const allGroups = await db.groups.orderBy("createdAt").reverse().toArray();
      setGroups(allGroups);
    } catch (error) {
      console.error("Failed to load groups:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm("Are you sure you want to delete this group?")) return;
    
    try {
      await db.transaction("rw", db.groups, db.persons, db.expenses, db.expenseSplits, async () => {
        await db.groups.delete(id);
        await db.persons.where("groupId").equals(id).delete();
        const expenseIds = await db.expenses.where("groupId").equals(id).primaryKeys();
        await db.expenses.where("groupId").equals(id).delete();
        await db.expenseSplits.where("expenseId").anyOf(expenseIds).delete();
      });
      await loadGroups();
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your Groups</h1>
        <Link
          href="/groups/new"
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          New Group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <p className="mb-2 text-lg font-medium text-slate-900">No groups yet</p>
          <p className="mb-6 text-slate-500">Create a group to start splitting expenses</p>
          <Link
            href="/groups/new"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Create First Group
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.id}
              className="group flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <Link
                href={`/groups/${group.id}`}
                className="flex flex-1 items-center gap-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Users className="h-6 w-6 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{group.name}</h3>
                  <p className="text-sm text-slate-500">
                    {group.currency} • Created {new Date(group.createdAt).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </Link>
              
              <button
                onClick={() => deleteGroup(group.id)}
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 opacity-100 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12">
        <DataManager />
      </div>
    </div>
  );
}
