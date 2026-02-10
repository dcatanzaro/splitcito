"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Group, Person, Expense, ExpenseSplit } from "./db";
import { Balance, SimplifiedTransaction, formatCurrency } from "./settlement";

interface PDFExportData {
  group: Group;
  persons: Person[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  balances: Balance[];
  transactions: SimplifiedTransaction[];
}

export function exportToPDF(data: PDFExportData) {
  const { group, persons, expenses, splits, balances, transactions } = data;
  const personMap = new Map(persons.map((p) => [p.id, p.name]));
  const expenseSplitsMap = new Map<string, ExpenseSplit[]>();
  
  // Group splits by expense
  splits.forEach((split) => {
    if (!expenseSplitsMap.has(split.expenseId)) {
      expenseSplitsMap.set(split.expenseId, []);
    }
    expenseSplitsMap.get(split.expenseId)!.push(split);
  });

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  
  // Helper to add new page if needed
  let currentY = margin;
  
  function checkPageBreak(requiredSpace: number = 60): number {
    if (currentY + requiredSpace > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }
    return currentY;
  }
  
  function addTitle(text: string, fontSize: number = 18, isCentered: boolean = false) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    
    if (isCentered) {
      const textWidth = doc.getTextWidth(text);
      doc.text(text, (pageWidth - textWidth) / 2, currentY);
    } else {
      doc.text(text, margin, currentY);
    }
    currentY += fontSize * 0.5;
  }
  
  function addSubtitle(text: string, fontSize: number = 11) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(text, margin, currentY);
    currentY += fontSize * 0.5;
  }
  
  function addSpacing(lines: number = 1) {
    currentY += 5 * lines;
  }
  
  function addSeparator() {
    currentY += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;
  }

  // Header
  addTitle(group.name, 22, true);
  addSubtitle(`${group.currency} • ${persons.length} members • ${expenses.length} expenses`, 11);
  currentY += 5;
  
  // Total Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountMinor, 0);
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 20, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text("Total Expenses", margin + 5, currentY + 7);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(totalExpenses, group.currency), margin + 5, currentY + 16);
  currentY += 25;

  // Group Info
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, currentY);
  currentY += 8;
  addSeparator();

  // Suggested Settlements
  checkPageBreak(40);
  addTitle("Suggested Settlements", 14);
  addSpacing(0.5);
  
  if (transactions.length === 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("All settled up! No payments needed.", margin, currentY);
    currentY += 8;
  } else {
    const settlementData = transactions.map((tx) => [
      tx.fromPersonName,
      "owes",
      tx.toPersonName,
      formatCurrency(tx.amountMinor, group.currency),
    ]);
    
    autoTable(doc, {
      head: [["From", "", "To", "Amount"]],
      body: settlementData,
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: [16, 185, 129], // emerald-500
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 10,
      },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "center", cellWidth: 15 },
        3: { fontStyle: "bold", textColor: [4, 120, 87] },
      },
      alternateRowStyles: {
        fillColor: [236, 253, 245], // emerald-50
      },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Balances
  checkPageBreak(40);
  addTitle("Balances", 14);
  addSpacing(0.5);
  
  if (balances.length === 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("No balances to display.", margin, currentY);
    currentY += 8;
  } else {
    interface BalanceRow {
      personName: string;
      paid: string;
      owed: string;
      netStatus: string;
      netMinor: number;
    }

    const balanceData: BalanceRow[] = balances.map((balance) => {
      const net = balance.netMinor;
      let status = "Settled";
      
      if (net > 0) {
        status = `+${formatCurrency(net, group.currency)}`;
      } else if (net < 0) {
        status = `-${formatCurrency(Math.abs(net), group.currency)}`;
      }
      
      return {
        personName: balance.personName,
        paid: formatCurrency(balance.paidMinor, group.currency),
        owed: formatCurrency(balance.owedMinor, group.currency),
        netStatus: status,
        netMinor: net,
      };
    });
    
    autoTable(doc, {
      head: [["Member", "Paid", "Owed", "Net Balance"]],
      body: balanceData.map(row => [row.personName, row.paid, row.owed, row.netStatus]),
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: [71, 85, 105], // slate-600
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 10,
      },
      columnStyles: {
        0: { fontStyle: "bold" },
        3: { fontStyle: "bold" },
      },
      didParseCell: function (data) {
        if (data.section === "body" && data.column.index === 3 && data.row.index !== undefined) {
          const rowData = balanceData[data.row.index];
          if (rowData.netMinor > 0) {
            data.cell.styles.textColor = [16, 185, 129] as [number, number, number];
          } else if (rowData.netMinor < 0) {
            data.cell.styles.textColor = [239, 68, 68] as [number, number, number];
          } else {
            data.cell.styles.textColor = [100, 100, 100] as [number, number, number];
          }
        }
      },
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Expenses Detail
  if (expenses.length > 0) {
    checkPageBreak(40);
    addTitle("Expenses Detail", 14);
    addSpacing(0.5);
    
    expenses.forEach((expense, index) => {
      checkPageBreak(50);
      
      // Expense header
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 25, 2, 2, "F");
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`${index + 1}. ${expense.description}`, margin + 5, currentY + 8);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const paidBy = personMap.get(expense.paidByPersonId) || "Unknown";
      const date = new Date(expense.createdAt).toLocaleDateString("es-AR");
      doc.text(`Paid by ${paidBy} • ${date}`, margin + 5, currentY + 16);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      const amountText = formatCurrency(expense.amountMinor, expense.currency);
      const amountWidth = doc.getTextWidth(amountText);
      doc.text(amountText, pageWidth - margin - amountWidth - 5, currentY + 12);
      
      currentY += 30;
      
      // Show splits if not all members are selected
      const expenseSplits = expenseSplitsMap.get(expense.id) || [];
      const allMembersSelected = expenseSplits.length === persons.length;
      
      if (!allMembersSelected && expenseSplits.length > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Split between:", margin + 10, currentY);
        currentY += 5;
        
        const splitData = expenseSplits.map((split) => [
          personMap.get(split.personId) || "Unknown",
          formatCurrency(split.amountMinor, expense.currency),
        ]);
        
        autoTable(doc, {
          body: splitData,
          startY: currentY,
          margin: { left: margin + 10, right: margin },
          theme: "plain",
          bodyStyles: {
            fontSize: 9,
            cellPadding: 1,
          },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { fontStyle: "bold" },
          },
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 5;
      }
      
      currentY += 3;
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, margin, pageHeight - 10);
    doc.text("Generated by Splitcito", pageWidth - margin - 40, pageHeight - 10);
  }

  // Save the PDF
  const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, "_")}_summary.pdf`;
  doc.save(fileName);
}
