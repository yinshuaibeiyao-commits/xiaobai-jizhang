export type EntryType = 'expense' | 'income'

export interface Transaction {
  id: string
  type: EntryType
  amount: number
  categoryL1: string
  categoryL2: string
  date: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface TransactionInput {
  type: EntryType
  amount: number
  categoryL1: string
  categoryL2: string
  date: string
  note?: string
}

export interface TransactionFilter {
  type?: EntryType
  categoryL1?: string
  categoryL2?: string
  startDate?: string
  endDate?: string
}

export interface CustomCategory {
  id: string
  type: EntryType
  name: string
  children: string[]
}

export interface CustomCategoryInput {
  type: EntryType
  name: string
  children: string[]
}

export interface CustomCategoryUpdate {
  name: string
  children: string[]
  renames: Array<{ from: string; to: string }>
}

export interface XiaobaiApi {
  createTransaction(input: TransactionInput): Promise<Transaction>
  listTransactions(filter?: TransactionFilter): Promise<Transaction[]>
  updateTransaction(id: string, input: TransactionInput): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>
  listCustomCategories(): Promise<CustomCategory[]>
  createCustomCategory(input: CustomCategoryInput): Promise<CustomCategory>
  updateCustomCategory(id: string, input: CustomCategoryUpdate): Promise<CustomCategory>
  deleteCustomCategory(id: string): Promise<void>
}
