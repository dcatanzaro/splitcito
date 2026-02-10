"use client";

import Link from "next/link";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { db, Group, Person, Expense } from "@/lib/db";
import { formatCurrency } from "@/lib/settlement";

interface ExpensesTabProps {
  group: Group;
  persons: Person[];
  expenses: Expense[];
  onRefresh: () => void;
}

export function ExpensesTab({ group, persons, expenses, onRefresh }: ExpensesTabProps) {
  const personMap = new Map(persons.map((p) => [p.id, p.name]));

  async function deleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;

    try {
      await db.transaction("rw", db.expenses, db.expenseSplits, async () => {
        await db.expenses.delete(id);
        await db.expenseSplits.where("expenseId").equals(id).delete();
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  }

  return (
    <div className="space-y-4">
      {!group.isClosed && (
        <Link
          href={`/groups/${group.id}/expenses/new`}
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-600"
        >
          <Plus className="h-5 w-5" />
          Add Expense
        </Link>
      )}

      {expenses.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <Receipt className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <p className="mb-2 text-lg font-medium text-slate-900">No expenses yet</p>
          <p className="mb-6 text-slate-500">Add your first expense to start tracking</p>
          {!group.isClosed && (
            <Link
              href={`/groups/${group.id}/expenses/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add First Expense
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="group rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{expense.description}</p>
                  <p className="text-sm text-slate-500">
                    Paid by {personMap.get(expense.paidByPersonId) || "Unknown"} • {new Date(expense.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(expense.amountMinor, expense.currency)}
                  </span>
                  {!group.isClosed && (
                    <>
                      <Link
                        href={`/groups/${group.id}/expenses/${expense.id}/edit`}
                        className="text-sm text-emerald-600 hover:text-emerald-700"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 opacity-100 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
