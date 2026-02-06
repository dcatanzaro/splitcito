"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { db, Group, Person, Expense, ExpenseSplit } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

type SplitMethod = "equal" | "exact" | "percentage";

interface SplitEntry {
  personId: string;
  value: string;
  amountMinor: number;
}

export default function EditExpensePageClient() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const expenseId = params.expenseId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [groupId, expenseId]);

  useEffect(() => {
    if (persons.length > 0 && !paidBy) {
      setPaidBy(persons[0].id);
    }
  }, [persons, paidBy]);

  useEffect(() => {
    if (!isLoading) {
      calculateSplits();
    }
  }, [amount, splitMethod]);

  async function loadData() {
    try {
      const [groupData, personsData, expenseData, expenseSplitsData] = await Promise.all([
        db.groups.get(groupId),
        db.persons.where("groupId").equals(groupId).toArray(),
        db.expenses.get(expenseId),
        db.expenseSplits.where("expenseId").equals(expenseId).toArray(),
      ]);

      if (!groupData) {
        router.push("/");
        return;
      }

      if (!expenseData) {
        router.push(`/groups/${groupId}`);
        return;
      }

      setGroup(groupData);
      setPersons(personsData);
      setExpense(expenseData);
      setDescription(expenseData.description);
      setAmount((expenseData.amountMinor / 100).toFixed(2));
      setDate(expenseData.date);
      setPaidBy(expenseData.paidByPersonId);
      setSplitMethod(expenseData.splitMethod as SplitMethod);

      // Initialize splits from existing expense splits
      const splitMap = new Map(expenseSplitsData.map((s) => [s.personId, s]));
      setSplits(
        personsData.map((p) => {
          const existingSplit = splitMap.get(p.id);
          return {
            personId: p.id,
            value: existingSplit ? existingSplit.value.toString() : "",
            amountMinor: existingSplit ? existingSplit.amountMinor : 0,
          };
        }),
      );
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function calculateSplits() {
    const amountMinor = Math.round(parseFloat(amount || "0") * 100);
    if (amountMinor <= 0) {
      setSplits((prev) => prev.map((s) => ({ ...s, amountMinor: 0 })));
      return;
    }

    const selectedPersons = splits.filter(
      (s) => s.value !== "0" && s.value !== "",
    );

    if (splitMethod === "equal") {
      const count = selectedPersons.length || persons.length;
      const perPerson = Math.floor(amountMinor / count);
      const remainder = amountMinor - perPerson * count;

      setSplits((prev) =>
        prev.map((s, index) => ({
          ...s,
          value: "",
          amountMinor: index < remainder ? perPerson + 1 : perPerson,
        })),
      );
    } else if (splitMethod === "exact") {
      setSplits((prev) =>
        prev.map((s) => ({
          ...s,
          amountMinor: Math.round(parseFloat(s.value || "0") * 100),
        })),
      );
    } else if (splitMethod === "percentage") {
      const totalPercentage = selectedPersons.reduce(
        (sum, s) => sum + parseFloat(s.value || "0"),
        0,
      );
      if (totalPercentage > 0) {
        setSplits((prev) =>
          prev.map((s) => ({
            ...s,
            amountMinor: Math.round(
              (parseFloat(s.value || "0") / 100) * amountMinor,
            ),
          })),
        );
      }
    }
  }

  function updateSplitValue(personId: string, value: string) {
    setSplits((prev) =>
      prev.map((s) => (s.personId === personId ? { ...s, value } : s)),
    );
  }

  function getTotalSplit(): number {
    return splits.reduce((sum, s) => sum + s.amountMinor, 0);
  }

  function getSplitDifference(): number {
    const amountMinor = Math.round(parseFloat(amount || "0") * 100);
    return amountMinor - getTotalSplit();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const amountMinor = Math.round(parseFloat(amount) * 100);
    if (amountMinor <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!description.trim()) {
      setError("Please enter a description");
      return;
    }

    if (!paidBy) {
      setError("Please select who paid");
      return;
    }

    const splitDiff = getSplitDifference();
    if (Math.abs(splitDiff) > 1) {
      setError(
        `Split amounts don't add up. Difference: ${(splitDiff / 100).toFixed(2)}`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedExpense: Expense = {
        ...expense!,
        description: description.trim(),
        amountMinor,
        date,
        paidByPersonId: paidBy,
        splitMethod,
        updatedAt: Date.now(),
      };

      const splitEntries: ExpenseSplit[] = splits
        .filter((s) => s.amountMinor > 0)
        .map((s) => ({
          id: uuidv4(),
          expenseId: expenseId,
          personId: s.personId,
          value: parseFloat(s.value) || 0,
          amountMinor: s.amountMinor,
        }));

      await db.transaction("rw", db.expenses, db.expenseSplits, async () => {
        await db.expenses.update(expenseId, updatedExpense);
        await db.expenseSplits.where("expenseId").equals(expenseId).delete();
        await db.expenseSplits.bulkAdd(splitEntries);
      });

      router.push(`/groups/${groupId}`);
    } catch (err) {
      console.error("Failed to update expense:", err);
      setError("Failed to update expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !group) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  if (persons.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <Receipt className="mx-auto mb-4 h-12 w-12 text-slate-400" />
        <p className="mb-2 text-lg font-medium text-slate-900">
          No members yet
        </p>
        <p className="mb-6 text-slate-500">
          Add members to the group before editing expenses
        </p>
        <Link
          href={`/groups/${groupId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
        >
          Go to Group
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/groups/${groupId}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Edit Expense</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Dinner, Taxi, Groceries"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="min-w-0">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Amount ({group.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-2 py-3 sm:px-4 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div className="min-w-0 overflow-hidden">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="date-input-mobile w-full min-w-0 rounded-lg border border-slate-300 px-2 py-3 sm:px-4 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Paid by
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              >
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Split Method
          </h2>

          <div className="mb-4 flex gap-2">
            {[
              { id: "equal", label: "Equal" },
              { id: "exact", label: "Exact" },
              { id: "percentage", label: "%" },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setSplitMethod(method.id as SplitMethod)}
                className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                  splitMethod === method.id
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {persons.map((person) => {
              const split = splits.find((s) => s.personId === person.id);
              return (
                <div
                  key={person.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                >
                  <span className="font-medium text-slate-900">
                    {person.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {splitMethod !== "equal" && (
                      <input
                        type="number"
                        step={splitMethod === "percentage" ? "1" : "0.01"}
                        min="0"
                        value={split?.value || ""}
                        onChange={(e) =>
                          updateSplitValue(person.id, e.target.value)
                        }
                        placeholder={
                          splitMethod === "percentage" ? "%" : "0.00"
                        }
                        className="w-24 rounded border border-slate-300 px-3 py-1 text-right focus:border-emerald-500 focus:outline-none"
                      />
                    )}
                    <span className="w-20 text-right font-medium text-slate-700">
                      {((split?.amountMinor || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-100 p-3">
            <span className="font-medium text-slate-700">Total Split</span>
            <div className="text-right">
              <span
                className={`text-lg font-bold ${
                  Math.abs(getSplitDifference()) <= 1
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {(getTotalSplit() / 100).toFixed(2)}
              </span>
              {Math.abs(getSplitDifference()) > 1 && (
                <p className="text-sm text-red-500">
                  Diff: {(getSplitDifference() / 100).toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
