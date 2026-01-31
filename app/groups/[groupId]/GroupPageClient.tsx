"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Users, Receipt, BarChart3, Lock } from "lucide-react";
import { db, Group, Person, Expense, ExpenseSplit } from "@/lib/db";
import { formatCurrency } from "@/lib/settlement";
import { MembersTab } from "./MembersTab";
import { ExpensesTab } from "./ExpensesTab";
import { DashboardTab } from "./DashboardTab";

type Tab = "dashboard" | "expenses" | "members";

export default function GroupPageClient() {
  const params = useParams();
  const groupId = params.groupId as string;
  
  const [group, setGroup] = useState<Group | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (groupId) {
      loadData();
    }
  }, [groupId]);

  async function loadData() {
    try {
      const [groupData, personsData, expensesData] = await Promise.all([
        db.groups.get(groupId),
        db.persons.where("groupId").equals(groupId).toArray(),
        db.expenses.where("groupId").equals(groupId).reverse().sortBy("date"),
      ]);

      if (groupData) {
        setGroup(groupData);
        setPersons(personsData);
        setExpenses(expensesData);

        const expenseIds = expensesData.map((e) => e.id);
        if (expenseIds.length > 0) {
          const splitsData = await db.expenseSplits
            .where("expenseId")
            .anyOf(expenseIds)
            .toArray();
          setSplits(splitsData);
        }
      }
    } catch (error) {
      console.error("Failed to load group data:", error);
    } finally {
      setIsLoading(false);
    }
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
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-white"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountMinor, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
            <p className="text-slate-500">
              {group.currency} • {persons.length} members • {expenses.length} expenses
            </p>
          </div>
          {group.isClosed && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              <Lock className="h-4 w-4" />
              Closed
            </span>
          )}
        </div>

        <div className="mt-4 rounded-xl bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">Total Expenses</p>
          <p className="text-3xl font-bold text-emerald-900">
            {formatCurrency(totalExpenses, group.currency)}
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-0 overflow-x-auto border-b border-slate-200 scrollbar-hide">
        {[
          { id: "dashboard", label: "Dashboard", icon: BarChart3 },
          { id: "expenses", label: "Expenses", icon: Receipt },
          { id: "members", label: "Members", icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex shrink-0 items-center gap-1 border-b-2 px-3 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "dashboard" && (
          <DashboardTab
            group={group}
            persons={persons}
            expenses={expenses}
            splits={splits}
            onRefresh={loadData}
          />
        )}
        {activeTab === "expenses" && (
          <ExpensesTab
            group={group}
            persons={persons}
            expenses={expenses}
            onRefresh={loadData}
          />
        )}
        {activeTab === "members" && (
          <MembersTab
            group={group}
            persons={persons}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  );
}
