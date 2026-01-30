import Dexie, { Table } from "dexie";

export interface Group {
  id: string;
  name: string;
  currency: string;
  createdAt: number;
  closedAt?: number;
  isClosed: boolean;
}

export interface Person {
  id: string;
  groupId: string;
  name: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amountMinor: number;
  currency: string;
  date: string;
  paidByPersonId: string;
  splitMethod: "equal" | "exact" | "percentage" | "shares";
  createdAt: number;
  updatedAt: number;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  personId: string;
  value: number;
  amountMinor: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  createdAt: number;
  transactions: SettlementTransaction[];
}

export interface SettlementTransaction {
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
}

export class SplitcitoDatabase extends Dexie {
  groups!: Table<Group>;
  persons!: Table<Person>;
  expenses!: Table<Expense>;
  expenseSplits!: Table<ExpenseSplit>;
  settlements!: Table<Settlement>;

  constructor() {
    super("SplitcitoDatabase");
    this.version(1).stores({
      groups: "id, createdAt",
      persons: "id, groupId, [groupId+createdAt]",
      expenses: "id, groupId, date, [groupId+date]",
      expenseSplits: "id, expenseId, personId, [expenseId+personId]",
      settlements: "id, groupId, createdAt",
    });
  }
}

export const db = new SplitcitoDatabase();
