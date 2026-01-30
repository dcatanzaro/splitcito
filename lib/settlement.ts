import { Expense, ExpenseSplit, Person } from "./db";

export interface Balance {
  personId: string;
  personName: string;
  netMinor: number;
  paidMinor: number;
  owedMinor: number;
}

export interface SimplifiedTransaction {
  fromPersonId: string;
  fromPersonName: string;
  toPersonId: string;
  toPersonName: string;
  amountMinor: number;
}

export function calculateBalances(
  expenses: Expense[],
  splits: ExpenseSplit[],
  persons: Person[]
): Balance[] {
  const personMap = new Map(persons.map((p) => [p.id, p.name]));
  const balances = new Map<
    string,
    { paid: number; owed: number }
  >();

  for (const person of persons) {
    balances.set(person.id, { paid: 0, owed: 0 });
  }

  for (const expense of expenses) {
    const current = balances.get(expense.paidByPersonId);
    if (current) {
      current.paid += expense.amountMinor;
    }
  }

  for (const split of splits) {
    const current = balances.get(split.personId);
    if (current) {
      current.owed += split.amountMinor;
    }
  }

  return persons.map((person) => {
    const balance = balances.get(person.id)!;
    return {
      personId: person.id,
      personName: person.name,
      paidMinor: balance.paid,
      owedMinor: balance.owed,
      netMinor: balance.paid - balance.owed,
    };
  });
}

export function simplifyDebts(
  balances: Balance[]
): SimplifiedTransaction[] {
  const creditors: { personId: string; personName: string; amount: number }[] =
    [];
  const debtors: { personId: string; personName: string; amount: number }[] =
    [];

  for (const balance of balances) {
    if (balance.netMinor > 0) {
      creditors.push({
        personId: balance.personId,
        personName: balance.personName,
        amount: balance.netMinor,
      });
    } else if (balance.netMinor < 0) {
      debtors.push({
        personId: balance.personId,
        personName: balance.personName,
        amount: -balance.netMinor,
      });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions: SimplifiedTransaction[] = [];
  let i = 0,
    j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const payAmount = Math.min(debtor.amount, creditor.amount);

    if (payAmount > 0) {
      transactions.push({
        fromPersonId: debtor.personId,
        fromPersonName: debtor.personName,
        toPersonId: creditor.personId,
        toPersonName: creditor.personName,
        amountMinor: payAmount,
      });
    }

    debtor.amount -= payAmount;
    creditor.amount -= payAmount;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transactions;
}

export function formatCurrency(minor: number, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  });
  return formatter.format(minor / 100);
}

export function generateWhatsAppMessage(
  groupName: string,
  transactions: SimplifiedTransaction[],
  balances: Balance[],
  currency: string
): string {
  let message = `*${groupName}*\n\n`;
  message += "*Settlements:*\n";

  if (transactions.length === 0) {
    message += "All settled up!\n";
  } else {
    for (const tx of transactions) {
      const amount = formatCurrency(tx.amountMinor, currency);
      message += `${tx.fromPersonName} owes ${tx.toPersonName}: ${amount}\n`;
    }
  }

  message += "\n*Balances:*\n";
  for (const balance of balances) {
    const amount = formatCurrency(Math.abs(balance.netMinor), currency);
    if (balance.netMinor > 0) {
      message += `${balance.personName}: +${amount}\n`;
    } else if (balance.netMinor < 0) {
      message += `${balance.personName}: -${amount}\n`;
    } else {
      message += `${balance.personName}: settled\n`;
    }
  }

  return message;
}
