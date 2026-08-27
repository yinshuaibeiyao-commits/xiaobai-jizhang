import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { presetL1Names } from '@shared/categories'
import type {
  TransactionFilter,
  TransactionInput,
  Transaction,
  CustomCategory,
  CustomCategoryInput,
  CustomCategoryUpdate
} from '@shared/types'

interface StoreData {
  transactions: Transaction[]
  customCategories: CustomCategory[]
}

let dataPath = ''
let transactions: Transaction[] = []
let customCategories: CustomCategory[] = []

function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100
}

function persist(): void {
  const data: StoreData = { transactions, customCategories }
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

function uniqueStrings(list: string[]): string[] {
  return Array.from(new Set(list))
}

export function initStore(): void {
  dataPath = join(app.getPath('userData'), 'xiaobai-jizhang.json')
  try {
    const raw = readFileSync(dataPath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      transactions?: Transaction[]
      expenses?: Transaction[]
      customCategories?: CustomCategory[]
    }
    // 兼容旧数据：旧文件用 expenses 字段，且记录无 type 字段，默认视为支出
    const list = parsed.transactions ?? parsed.expenses ?? []
    transactions = list.map((t) => ({
      ...t,
      type: t.type === 'income' ? 'income' : 'expense'
    }))
    customCategories = parsed.customCategories ?? []
  } catch {
    transactions = []
    customCategories = []
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

export function listCustomCategories(): CustomCategory[] {
  return customCategories.slice()
}

export function createCustomCategory(input: CustomCategoryInput): CustomCategory {
  const name = input.name.trim()
  const children = uniqueStrings(input.children.map((s) => s.trim()).filter(Boolean))
  if (!name) throw new Error('分类名称不能为空')
  if (children.length === 0) throw new Error('至少需要添加一个小类')
  if (presetL1Names(input.type).includes(name)) throw new Error('不能使用预置分类的名称')
  if (customCategories.some((c) => c.type === input.type && c.name === name)) {
    throw new Error(`分类「${name}」已存在`)
  }
  const category: CustomCategory = { id: randomUUID(), type: input.type, name, children }
  customCategories.push(category)
  persist()
  return category
}

export function updateCustomCategory(id: string, input: CustomCategoryUpdate): CustomCategory {
  const idx = customCategories.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error('分类不存在')
  const old = customCategories[idx]

  const name = input.name.trim()
  const children = uniqueStrings(input.children.map((s) => s.trim()).filter(Boolean))
  if (!name) throw new Error('分类名称不能为空')
  if (children.length === 0) throw new Error('至少需要添加一个小类')

  if (name !== old.name) {
    if (presetL1Names(old.type).includes(name)) throw new Error('不能使用预置分类的名称')
    if (customCategories.some((c) => c.type === old.type && c.name === name && c.id !== id)) {
      throw new Error(`分类「${name}」已存在`)
    }
  }

  const renames = (input.renames ?? []).filter((r) => r.from && r.to && r.from !== r.to)
  for (const r of renames) {
    if (!old.children.includes(r.from)) throw new Error('要修改的小类不存在')
    if (!children.includes(r.to)) throw new Error('小类名称无效')
  }
  const froms = renames.map((r) => r.from)
  const tos = renames.map((r) => r.to)
  if (new Set(froms).size !== froms.length || new Set(tos).size !== tos.length) {
    throw new Error('小类名称重复')
  }

  // 被移除的小类若仍被流水使用则禁止删除
  const renamedFrom = new Set(froms)
  for (const child of old.children) {
    if (children.includes(child) || renamedFrom.has(child)) continue
    const used = transactions.some(
      (t) => t.type === old.type && t.categoryL1 === old.name && t.categoryL2 === child
    )
    if (used) throw new Error(`小类「${child}」仍被使用，无法删除`)
  }

  // 级联更新流水记录（一级改名 + 二级改名）
  const renameMap = new Map(renames.map((r) => [r.from, r.to]))
  const l1Changed = name !== old.name
  if (l1Changed || renameMap.size > 0) {
    transactions = transactions.map((t) => {
      if (t.type !== old.type || t.categoryL1 !== old.name) return t
      const nextL1 = l1Changed ? name : t.categoryL1
      const nextL2 = renameMap.get(t.categoryL2) ?? t.categoryL2
      if (nextL1 === t.categoryL1 && nextL2 === t.categoryL2) return t
      return { ...t, categoryL1: nextL1, categoryL2: nextL2, updatedAt: new Date().toISOString() }
    })
  }

  const updated: CustomCategory = { ...old, name, children }
  customCategories[idx] = updated
  persist()
  return updated
}

export function deleteCustomCategory(id: string): void {
  const category = customCategories.find((c) => c.id === id)
  if (!category) throw new Error('分类不存在')
  const used = transactions.some((t) => t.type === category.type && t.categoryL1 === category.name)
  if (used) throw new Error(`分类「${category.name}」仍被使用，无法删除`)
  customCategories = customCategories.filter((c) => c.id !== id)
  persist()
}
