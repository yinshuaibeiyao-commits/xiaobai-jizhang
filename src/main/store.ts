import { app } from 'electron'
import { join } from 'path'
import { copyFileSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { presetCategoriesFor, presetL1Names } from '@shared/categories'
import type {
  TransactionFilter,
  TransactionInput,
  Transaction,
  CustomCategory,
  CustomCategoryInput,
  CustomCategoryUpdate
} from '@shared/types'

// 数据文件里存的内容：全部流水 + 用户自建的自定义分类
interface StoreData {
  transactions: Transaction[]
  customCategories: CustomCategory[]
}

type NormalizedTransactionInput = Omit<TransactionInput, 'note'> & { note: string }

export interface StoreInitResult {
  recovered: boolean
  backupPath?: string
}

// 模块级状态：数据文件路径 + 内存中的流水/自定义分类（进程运行期间常驻内存，增删改后同步落盘）
let dataPath = ''
let transactions: Transaction[] = []
let customCategories: CustomCategory[] = []

// 把金额规整到「分」——四舍五入到 2 位小数，消除浮点误差（例如 0.1 + 0.2 = 0.3000...004）
function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('金额必须是大于 0 的有效数字')
  }
  if (amount > 99_999_999.99) {
    throw new Error('金额超出允许范围')
  }
  return Math.round(amount * 100) / 100
}

function requireText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${label}格式无效`)
  const text = value.trim()
  if (!text) throw new Error(`${label}不能为空`)
  if (text.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符`)
  return text
}

function requireDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label}格式无效`)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label}不是有效日期`)
  }
  return value
}

function requireId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new Error('记录标识无效')
  }
  return value
}

function normalizeChildren(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((child) => typeof child !== 'string')) {
    throw new Error('小类格式无效')
  }
  if (value.length > 100) throw new Error('小类数量不能超过 100 个')
  const children = uniqueStrings(
    value.map((child) => child.trim()).filter(Boolean).map((child) => requireText(child, '小类名称', 40))
  )
  if (children.length === 0) throw new Error('至少需要添加一个小类')
  return children
}

function normalizeRenames(value: unknown): Array<{ from: string; to: string }> {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 100) throw new Error('小类改名数据格式无效')
  return value.map((rename) => {
    if (!rename || typeof rename !== 'object') throw new Error('小类改名数据格式无效')
    const candidate = rename as { from?: unknown; to?: unknown }
    return {
      from: requireText(candidate.from, '原小类名称', 40),
      to: requireText(candidate.to, '新小类名称', 40)
    }
  })
}

function normalizeTransactionInput(input: TransactionInput): NormalizedTransactionInput {
  if (!input || typeof input !== 'object') throw new Error('流水数据格式无效')
  if (input.type !== 'expense' && input.type !== 'income') throw new Error('收支类型无效')
  const note = input.note ?? ''
  if (typeof note !== 'string' || note.length > 500) throw new Error('备注不能超过 500 个字符')
  const categoryL1 = requireText(input.categoryL1, '一级分类', 40)
  const categoryL2 = requireText(input.categoryL2, '二级分类', 40)
  const availableCategories = [
    ...presetCategoriesFor(input.type),
    ...customCategories
      .filter((category) => category.type === input.type)
      .map((category) => ({ name: category.name, children: category.children }))
  ]
  const category = availableCategories.find((candidate) => candidate.name === categoryL1)
  if (!category || !category.children.includes(categoryL2)) {
    throw new Error('所选分类不存在或与收支类型不匹配')
  }
  return {
    type: input.type,
    amount: normalizeAmount(input.amount),
    categoryL1,
    categoryL2,
    date: requireDate(input.date, '记账日期'),
    note: note.trim()
  }
}

function normalizeFilter(filter: TransactionFilter): TransactionFilter {
  if (!filter || typeof filter !== 'object') throw new Error('筛选条件格式无效')
  const normalized: TransactionFilter = {}
  if (filter.type) {
    if (filter.type !== 'expense' && filter.type !== 'income') throw new Error('筛选类型无效')
    normalized.type = filter.type
  }
  if (filter.categoryL1) normalized.categoryL1 = requireText(filter.categoryL1, '一级分类', 40)
  if (filter.categoryL2) normalized.categoryL2 = requireText(filter.categoryL2, '二级分类', 40)
  if (filter.startDate) normalized.startDate = requireDate(filter.startDate, '开始日期')
  if (filter.endDate) normalized.endDate = requireDate(filter.endDate, '结束日期')
  if (normalized.startDate && normalized.endDate && normalized.startDate > normalized.endDate) {
    throw new Error('开始日期不能晚于结束日期')
  }
  return normalized
}

// 先完整写入临时文件，再原子替换正式文件；写入失败时旧数据仍然保留。
function persist(): void {
  const data: StoreData = { transactions, customCategories }
  const tempPath = `${dataPath}.tmp`
  writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8')
  try {
    renameSync(tempPath, dataPath)
  } catch (error) {
    try {
      unlinkSync(tempPath)
    } catch {
      // 清理临时文件失败不应覆盖原始写入错误。
    }
    throw error
  }
}

// 字符串数组去重并保留顺序
function uniqueStrings(list: string[]): string[] {
  return Array.from(new Set(list))
}

function isMissingFile(error: unknown): boolean {
  const fsError = error as NodeJS.ErrnoException
  return fsError?.code === 'ENOENT' || fsError?.message?.includes('ENOENT') === true
}

// 启动时初始化：定位数据文件、读入内存；旧数据兼容，损坏文件先备份再恢复为空库。
export function initStore(): StoreInitResult {
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
    return { recovered: false }
  } catch (error) {
    transactions = []
    customCategories = []
    if (isMissingFile(error)) return { recovered: false }

    const backupPath = `${dataPath}.corrupt-${Date.now()}.bak`
    copyFileSync(dataPath, backupPath)
    return { recovered: true, backupPath }
  }
}

// 新增一条流水：生成唯一 id、规整金额、记录创建/更新时间，写入内存并落盘，返回该记录
export function createTransaction(input: TransactionInput): Transaction {
  const safe = normalizeTransactionInput(input)
  const now = new Date().toISOString()
  const record: Transaction = {
    id: randomUUID(),
    ...safe,
    createdAt: now,
    updatedAt: now
  }
  transactions.push(record)
  persist()
  return record
}

// 按条件筛选流水并按时间倒序返回；不传筛选条件时返回全部
export function listTransactions(filter: TransactionFilter = {}): Transaction[] {
  const safeFilter = normalizeFilter(filter)
  const filtered = transactions.filter((t) => {
    // 每个筛选条件都是可选的：没传（空值）就跳过该条件的判断
    if (safeFilter.type && t.type !== safeFilter.type) return false
    if (safeFilter.categoryL1 && t.categoryL1 !== safeFilter.categoryL1) return false
    if (safeFilter.categoryL2 && t.categoryL2 !== safeFilter.categoryL2) return false
    if (safeFilter.startDate && t.date < safeFilter.startDate) return false
    if (safeFilter.endDate && t.date > safeFilter.endDate) return false
    return true
  })
  // 先按日期倒序；同一天的多笔再按创建时间倒序（新记的排前面）
  return filtered.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.createdAt.localeCompare(a.createdAt)
  })
}

// 修改指定 id 的流水：找不到则抛错，否则覆盖字段、更新 updatedAt 并落盘
export function updateTransaction(id: string, input: TransactionInput): Transaction {
  const safeId = requireId(id)
  const safe = normalizeTransactionInput(input)
  const idx = transactions.findIndex((t) => t.id === safeId)
  if (idx === -1) {
    throw new Error('记录不存在')
  }
  const updated: Transaction = {
    ...transactions[idx],
    ...safe,
    updatedAt: new Date().toISOString()
  }
  transactions[idx] = updated
  persist()
  return updated
}

// 删除指定 id 的流水并落盘
export function deleteTransaction(id: string): void {
  const safeId = requireId(id)
  transactions = transactions.filter((t) => t.id !== safeId)
  persist()
}

// 返回自定义分类的副本，避免外部直接改动内部数组
export function listCustomCategories(): CustomCategory[] {
  return customCategories.slice()
}

// 新增自定义分类：校验名称 / 小类 / 重名后写入内存并落盘
export function createCustomCategory(input: CustomCategoryInput): CustomCategory {
  if (!input || typeof input !== 'object') throw new Error('分类数据格式无效')
  if (input.type !== 'expense' && input.type !== 'income') throw new Error('分类类型无效')
  const name = requireText(input.name, '分类名称', 40)
  const children = normalizeChildren(input.children)
  // 逐项校验，不合法直接抛错，由上层（IPC）转成对用户的提示
  if (presetL1Names(input.type).includes(name)) throw new Error('不能使用预置分类的名称')
  if (customCategories.some((c) => c.type === input.type && c.name === name)) {
    throw new Error(`分类「${name}」已存在`)
  }
  const category: CustomCategory = { id: randomUUID(), type: input.type, name, children }
  customCategories.push(category)
  persist()
  return category
}

// 修改自定义分类：支持改一级名、改小类名（小类改名通过 renames 级联改写历史流水）
export function updateCustomCategory(id: string, input: CustomCategoryUpdate): CustomCategory {
  const safeId = requireId(id)
  if (!input || typeof input !== 'object') throw new Error('分类数据格式无效')
  const idx = customCategories.findIndex((c) => c.id === safeId)
  if (idx === -1) throw new Error('分类不存在')
  const old = customCategories[idx]

  const name = requireText(input.name, '分类名称', 40)
  const children = normalizeChildren(input.children)

  // 只有一级名发生变化时，才需要检查是否与预置分类或其它自定义分类重名
  if (name !== old.name) {
    if (presetL1Names(old.type).includes(name)) throw new Error('不能使用预置分类的名称')
    if (customCategories.some((c) => c.type === old.type && c.name === name && c.id !== safeId)) {
      throw new Error(`分类「${name}」已存在`)
    }
  }

  // renames 是「旧小类名 → 新小类名」的映射，用来级联改写历史流水里的小类名
  const renames = normalizeRenames(input.renames).filter((rename) => rename.from !== rename.to)
  for (const r of renames) {
    if (!old.children.includes(r.from)) throw new Error('要修改的小类不存在')
    // 约束：改名后的新小类名必须已存在于最终的 children 列表里，否则等于凭空多出一个小类
    if (!children.includes(r.to)) throw new Error('小类名称无效')
  }
  // from 或 to 不能有重复：否则一条旧记录会对应到两个新名，产生歧义
  const froms = renames.map((r) => r.from)
  const tos = renames.map((r) => r.to)
  if (new Set(froms).size !== froms.length || new Set(tos).size !== tos.length) {
    throw new Error('小类名称重复')
  }

  // 被移除的小类若仍被流水使用则禁止删除，防止历史记录变成「孤儿」
  const renamedFrom = new Set(froms)
  for (const child of old.children) {
    if (children.includes(child) || renamedFrom.has(child)) continue
    const used = transactions.some(
      (t) => t.type === old.type && t.categoryL1 === old.name && t.categoryL2 === child
    )
    if (used) throw new Error(`小类「${child}」仍被使用，无法删除`)
  }

  // 级联更新流水记录：一级名统一替换；小类名按 renameMap 逐个映射
  const renameMap = new Map(renames.map((r) => [r.from, r.to]))
  const l1Changed = name !== old.name
  if (l1Changed || renameMap.size > 0) {
    transactions = transactions.map((t) => {
      // 只处理属于该分类、且一级名匹配的流水，其余原样保留
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

// 删除自定义分类：仍被流水使用的分类禁止删除，否则会留下指向不存在分类的历史记录
export function deleteCustomCategory(id: string): void {
  const safeId = requireId(id)
  const category = customCategories.find((c) => c.id === safeId)
  if (!category) throw new Error('分类不存在')
  const used = transactions.some((t) => t.type === category.type && t.categoryL1 === category.name)
  if (used) throw new Error(`分类「${category.name}」仍被使用，无法删除`)
  customCategories = customCategories.filter((c) => c.id !== safeId)
  persist()
}
