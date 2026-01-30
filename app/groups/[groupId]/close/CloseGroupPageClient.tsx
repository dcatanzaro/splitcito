"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Lock, MessageCircle, AlertTriangle } from "lucide-react";
import { db, Group, Person, Expense, ExpenseSplit, Settlement } from "@/lib/db";
import {
  calculateBalances,
  simplifyDebts,
  formatCurrency,
  generateWhatsAppMessage,
} from "@/lib/settlement";
import { v4 as uuidv4 } from "uuid";

export default function CloseGroupPageClient() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId]);

  async function loadData() {
    try {
      const [groupData, personsData, expensesData] = await Promise.all([
        db.groups.get(groupId),
        db.persons.where("groupId").equals(groupId).toArray(),
        db.expenses.where("groupId").equals(groupId).toArray(),
      ]);

      if (groupData) {
        setGroup(groupData);
        setPersons(personsData);
        setExpenses(expensesData);

        if (expensesData.length > 0) {
          const expenseIds = expensesData.map((e) => e.id);
          const splitsData = await db.expenseSplits
            .where("expenseId")
            .anyOf(expenseIds)
            .toArray();
          setSplits(splitsData);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCloseGroup() {
    if (!confirm("Are you sure you want to close this group? This action cannot be undone.")) {
      return;
    }

    setIsClosing(true);
    try {
      const balances = calculateBalances(expenses, splits, persons);
      const transactions = simplifyDebts(balances);

      const settlement: Settlement = {
        id: uuidv4(),
        groupId,
        createdAt: Date.now(),
        transactions: transactions.map((t) => ({
          fromPersonId: t.fromPersonId,
          toPersonId: t.toPersonId,
          amountMinor: t.amountMinor,
        })),
      };

      await db.transaction("rw", [db.groups, db.settlements], async () => {
        await db.groups.update(groupId, {
          isClosed: true,
          closedAt: Date.now(),
        });
        await db.settlements.add(settlement);
      });

      router.push(`/groups/${groupId}`);
    } catch (error) {
      console.error("Failed to close group:", error);
      alert("Failed to close group. Please try again.");
    } finally {
      setIsClosing(false);
    }
  }

  function copyToClipboard() {
    const balances = calculateBalances(expenses, splits, persons);
    const transactions = simplifyDebts(balances);
    const message = generateWhatsAppMessage(
      group?.name || "",
      transactions,
      balances,
      group?.currency || "USD"
    );
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-lg text-slate-600">Group not found</p>
      </div>
    );
  }

  if (group.isClosed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <Lock className="mx-auto mb-4 h-12 w-12 text-slate-400" />
        <p className="mb-2 text-lg font-medium text-slate-900">This group is already closed</p>
        <Link
          href={`/groups/${groupId}`}
          className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-white"
        >
          Go to Group
        </Link>
      </div>
    );
  }

  const balances = calculateBalances(expenses, splits, persons);
  const transactions = simplifyDebts(balances);
  const message = generateWhatsAppMessage(
    group.name,
    transactions,
    balances,
    group.currency
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/groups/${groupId}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Close Group</h1>
      </div>

      <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">Warning</p>
            <p className="text-sm text-amber-800">
              Closing a group will lock all editing. You won't be able to add, edit, or delete
              expenses or members after closing. Make sure everything is correct before proceeding.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Final Balances</h2>
        <div className="space-y-2">
          {balances.map((balance) => (
            <div
              key={balance.personId}
              className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
            >
              <span className="font-medium text-slate-900">{balance.personName}</span>
              <span
                className={`font-bold ${
                  balance.netMinor > 0
                    ? "text-emerald-600"
                    : balance.netMinor < 0
                    ? "text-red-500"
                    : "text-slate-500"
                }`}
              >
                {balance.netMinor > 0 ? "+" : ""}
                {formatCurrency(balance.netMinor, group.currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Suggested Settlements</h2>
        {transactions.length === 0 ? (
          <p className="text-slate-500">All settled up! No payments needed.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-emerald-50 p-3"
              >
                <span className="text-slate-700">
                  <span className="font-semibold text-slate-900">{tx.fromPersonName}</span>{" "}
                  owes{" "}
                  <span className="font-semibold text-slate-900">{tx.toPersonName}</span>
                </span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(tx.amountMinor, group.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl bg-slate-100 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <MessageCircle className="h-5 w-5 text-green-600" />
          WhatsApp Message
        </h3>
        <pre className="mb-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-slate-700">
          {message}
        </pre>
        <button
          onClick={copyToClipboard}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy for WhatsApp
            </>
          )}
        </button>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/groups/${groupId}`}
          className="flex-1 rounded-lg bg-slate-200 px-4 py-3 text-center font-medium text-slate-700 transition-colors hover:bg-slate-300"
        >
          Cancel
        </Link>
        <button
          onClick={handleCloseGroup}
          disabled={isClosing}
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isClosing ? "Closing..." : "Close Group"}
        </button>
      </div>
    </div>
  );
}
