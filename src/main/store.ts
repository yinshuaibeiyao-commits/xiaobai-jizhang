import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import type { TransactionFilter, TransactionInput, Transaction } from '@shared/types'

interface StoreData {
  transactions: Transaction[]
}

let dataPath = ''
let transactions: Transaction[] = []

function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100
}

function persist(): void {
  const data: StoreData = { transactions }
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

export function initStore(): void {
  dataPath = join(app.getPath('userData'), 'xiaobai-jizhang.json')
  try {
    const raw = readFileSync(dataPath, 'utf-8')
    const parsed = JSON.parse(raw) as { transactions?: Transaction[]; expenses?: Transaction[] }
    // 兼容旧数据：旧文件用 expenses 字段，且记录无 type 字段，默认视为支出
    const list = parsed.transactions ?? parsed.expenses ?? []
    transactions = list.map((t) => ({
      ...t,
      type: t.type === 'income' ? 'income' : 'expense'
    }))
  } catch {
    transactions = []
  }
}

export function createTransaction(input: TransactionInput): Transaction {
  const now = new Date().toISOString()
  const record: Transaction = {
    id: randomUUID(),
    type: input.type,
    amount: normalizeAmount(input.amount),
    categoryL1: input.categoryL1,
    categoryL2: input.categoryL2,
    date: input.date,
    note: input.note ?? '',
    createdAt: now,
    updatedAt: now
  }
  transactions.push(record)
  persist()
  return record
}

export function listTransactions(filter: TransactionFilter = {}): Transaction[] {
  const filtered = transactions.filter((t) => {
    if (filter.type && t.type !== filter.type) return false
    if (filter.categoryL1 && t.categoryL1 !== filter.categoryL1) return false
    if (filter.categoryL2 && t.categoryL2 !== filter.categoryL2) return false
    if (filter.startDate && t.date < filter.startDate) return false
    if (filter.endDate && t.date > filter.endDate) return false
    return true
  })
  return filtered.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function updateTransaction(id: string, input: TransactionInput): Transaction {
  const idx = transactions.findIndex((t) => t.id === id)
  if (idx === -1) {
    throw new Error('记录不存在')
  }
  const updated: Transaction = {
    ...transactions[idx],
    type: input.type,
    amount: normalizeAmount(input.amount),
    categoryL1: input.categoryL1,
    categoryL2: input.categoryL2,
    date: input.date,
    note: input.note ?? '',
    updatedAt: new Date().toISOString()
  }
  transactions[idx] = updated
  persist()
  return updated
}

export function deleteTransaction(id: string): void {
  transactions = transactions.filter((t) => t.id !== id)
  persist()
}
