"use client";

import { useState } from "react";
import { Download, Upload, Trash2 } from "lucide-react";
import { db } from "@/lib/db";

export function DataManager() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function exportData() {
    setIsExporting(true);
    try {
      const [groups, persons, expenses, expenseSplits, settlements] = await Promise.all([
        db.groups.toArray(),
        db.persons.toArray(),
        db.expenses.toArray(),
        db.expenseSplits.toArray(),
        db.settlements.toArray(),
      ]);

      const data = {
        version: 1,
        exportedAt: Date.now(),
        groups,
        persons,
        expenses,
        expenseSplits,
        settlements,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `splitcito-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export data:", error);
      alert("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  }

  async function importData(file: File) {
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.groups || !Array.isArray(data.groups)) {
        throw new Error("Invalid backup file");
      }

      if (!confirm("This will replace all existing data. Are you sure?")) {
        return;
      }

      await db.transaction("rw", [db.groups, db.persons, db.expenses, db.expenseSplits, db.settlements], async () => {
        await db.groups.clear();
        await db.persons.clear();
        await db.expenses.clear();
        await db.expenseSplits.clear();
        await db.settlements.clear();

        if (data.groups.length > 0) await db.groups.bulkAdd(data.groups);
        if (data.persons?.length > 0) await db.persons.bulkAdd(data.persons);
        if (data.expenses?.length > 0) await db.expenses.bulkAdd(data.expenses);
        if (data.expenseSplits?.length > 0) await db.expenseSplits.bulkAdd(data.expenseSplits);
        if (data.settlements?.length > 0) await db.settlements.bulkAdd(data.settlements);
      });

      alert("Data imported successfully!");
      window.location.reload();
    } catch (error) {
      console.error("Failed to import data:", error);
      alert("Failed to import data. Please check the file format.");
    } finally {
      setIsImporting(false);
    }
  }

  async function clearAllData() {
    if (!confirm("WARNING: This will delete ALL data permanently. Are you absolutely sure?")) {
      return;
    }
    if (!confirm("This action cannot be undone. Type 'DELETE' to confirm.")) {
      return;
    }

    try {
      await db.delete();
      alert("All data cleared. The page will reload.");
      window.location.reload();
    } catch (error) {
      console.error("Failed to clear data:", error);
      alert("Failed to clear data");
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Data Management</h2>

      <div className="space-y-3">
        <button
          onClick={exportData}
          disabled={isExporting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export Backup"}
        </button>

        <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 font-medium text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-600">
          <Upload className="h-4 w-4" />
          {isImporting ? "Importing..." : "Import Backup"}
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importData(file);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        <hr className="my-4 border-slate-200" />

        <button
          onClick={clearAllData}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Data
        </button>
      </div>
    </div>
  );
}
