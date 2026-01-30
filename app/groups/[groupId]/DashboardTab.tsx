"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRightLeft, Check, Copy, Lock, MessageCircle } from "lucide-react";
import { Group, Person, Expense, ExpenseSplit, Settlement } from "@/lib/db";
import {
  calculateBalances,
  simplifyDebts,
  formatCurrency,
  generateWhatsAppMessage,
} from "@/lib/settlement";
import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

interface DashboardTabProps {
  group: Group;
  persons: Person[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  onRefresh: () => void;
}

export function DashboardTab({
  group,
  persons,
  expenses,
  splits,
  onRefresh,
}: DashboardTabProps) {
  const [balances, setBalances] = useState<ReturnType<typeof calculateBalances>>(
    []
  );
  const [transactions, setTransactions] = useState<
    ReturnType<typeof simplifyDebts>
  >([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const bal = calculateBalances(expenses, splits, persons);
    setBalances(bal);
    setTransactions(simplifyDebts(bal));
  }, [expenses, splits, persons]);

  async function closeGroup() {
    if (!confirm("Close this group? This will lock all editing.")) return;

    try {
      const settlement: Settlement = {
        id: uuidv4(),
        groupId: group.id,
        createdAt: Date.now(),
        transactions: transactions.map((t) => ({
          fromPersonId: t.fromPersonId,
          toPersonId: t.toPersonId,
          amountMinor: t.amountMinor,
        })),
      };

      await db.transaction("rw", db.groups, db.settlements, async () => {
        await db.groups.update(group.id, {
          isClosed: true,
          closedAt: Date.now(),
        });
        await db.settlements.add(settlement);
      });

      onRefresh();
    } catch (error) {
      console.error("Failed to close group:", error);
    }
  }

  function copyToClipboard() {
    const message = generateWhatsAppMessage(
      group.name,
      transactions,
      balances,
      group.currency
    );
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const message = generateWhatsAppMessage(
    group.name,
    transactions,
    balances,
    group.currency
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <ArrowRightLeft className="h-5 w-5 text-emerald-500" />
          Balances
        </h2>

        {balances.length === 0 ? (
          <p className="text-slate-500">Add members and expenses to see balances</p>
        ) : (
          <div className="space-y-2">
            {balances.map((balance) => (
              <div
                key={balance.personId}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
              >
                <span className="font-medium text-slate-900">
                  {balance.personName}
                </span>
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
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Check className="h-5 w-5 text-emerald-500" />
          Suggested Settlements
        </h2>

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
                  <span className="font-semibold text-slate-900">
                    {tx.fromPersonName}
                  </span>{" "}
                  owes{" "}
                  <span className="font-semibold text-slate-900">
                    {tx.toPersonName}
                  </span>
                </span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(tx.amountMinor, group.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!group.isClosed && expenses.length > 0 && (
        <>
          <div className="rounded-xl bg-slate-100 p-4">
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

          <Link
            href={`/groups/${group.id}/close`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-900"
          >
            <Lock className="h-4 w-4" />
            Close Group
          </Link>
        </>
      )}

      {group.isClosed && (
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="font-medium text-slate-900">This group is closed</p>
          <p className="text-sm text-slate-500">
            No further edits can be made
          </p>
        </div>
      )}
    </div>
  );
}
