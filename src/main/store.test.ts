import { beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'path'

// 用 vi.hoisted 创建可在 vi.mock 工厂里引用的共享状态（避免 import 提升导致 TDZ 报错）
const mem = vi.hoisted(() => ({ files: new Map<string, string>() }))

// store.ts 依赖 electron 与 fs，这里用内存实现替换，避免触碰真实文件系统
vi.mock('electron', () => ({
  app: { getPath: () => '/fake/userData' }
}))

vi.mock('fs', () => ({
  readFileSync: (p: string) => {
    const data = mem.files.get(p)
    if (data === undefined) throw new Error('ENOENT')
    return data
  },
  writeFileSync: (p: string, data: string) => {
    mem.files.set(p, data)
  }
}))

import {
  initStore,
  createTransaction,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  createCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
  listCustomCategories
} from './store'
import type { TransactionInput } from '@shared/types'

function expense(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    type: 'expense',
    amount: 10,
    categoryL1: '餐饮',
    categoryL2: '外卖',
    date: '2026-08-27',
    ...overrides
  }
}

// 与 store.ts 里 initStore 计算出的数据文件路径保持一致
function dataPath(): string {
  return join('/fake/userData', 'xiaobai-jizhang.json')
}

beforeEach(() => {
  mem.files.clear()
  initStore()
})

describe('createTransaction / listTransactions', () => {
  it('创建记录并回读', () => {
    const t = createTransaction(expense())
    expect(t.id).toBeTruthy()
    expect(t.amount).toBe(10)
    expect(t.note).toBe('')
    expect(t.type).toBe('expense')
    expect(listTransactions()).toHaveLength(1)
  })

  it('金额四舍五入到分（消除浮点误差）', () => {
    const t = createTransaction(expense({ amount: 0.1 + 0.2 }))
    expect(t.amount).toBe(0.3)
  })

  it('按类型 / 分类 / 日期区间筛选', () => {
    createTransaction(expense({ amount: 5, date: '2026-08-01', categoryL2: '早餐' }))
    createTransaction(expense({ amount: 8, date: '2026-08-02', categoryL2: '午餐' }))
    createTransaction({ type: 'income', amount: 100, categoryL1: '工资', categoryL2: '工资', date: '2026-08-03' })

    expect(listTransactions({ type: 'income' })).toHaveLength(1)
    expect(listTransactions({ categoryL2: '早餐' })).toHaveLength(1)
    expect(listTransactions({ startDate: '2026-08-02', endDate: '2026-08-02' })).toHaveLength(1)
  })

  it('列表按日期倒序排列', () => {
    createTransaction(expense({ amount: 1, date: '2026-08-01' }))
    createTransaction(expense({ amount: 2, date: '2026-08-03' }))
    createTransaction(expense({ amount: 3, date: '2026-08-02' }))
    expect(listTransactions().map((t) => t.date)).toEqual(['2026-08-03', '2026-08-02', '2026-08-01'])
  })
})

describe('updateTransaction / deleteTransaction', () => {
  it('更新记录', () => {
    const t = createTransaction(expense({ amount: 10 }))
    const updated = updateTransaction(t.id, expense({ amount: 20, note: '改' }))
    expect(updated.amount).toBe(20)
    expect(updated.note).toBe('改')
    expect(listTransactions()[0].amount).toBe(20)
  })

  it('更新不存在的记录抛错', () => {
    expect(() => updateTransaction('nope', expense())).toThrow('记录不存在')
  })

  it('删除记录', () => {
    const t = createTransaction(expense())
    deleteTransaction(t.id)
    expect(listTransactions()).toHaveLength(0)
  })
})

describe('自定义分类', () => {
  it('创建自定义分类并去重去空', () => {
    const c = createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮', '猫粮', '  ', '狗粮'] })
    expect(c.children).toEqual(['猫粮', '狗粮'])
  })

  it('名称为空抛错', () => {
    expect(() => createCustomCategory({ type: 'expense', name: '  ', children: ['x'] })).toThrow('分类名称不能为空')
  })

  it('小类为空抛错', () => {
    expect(() => createCustomCategory({ type: 'expense', name: '宠物', children: [] })).toThrow('至少需要添加一个小类')
  })

  it('与预置分类重名抛错', () => {
    expect(() => createCustomCategory({ type: 'expense', name: '餐饮', children: ['x'] })).toThrow('不能使用预置分类的名称')
  })

  it('删除仍被流水使用的分类抛错', () => {
    const c = createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮'] })
    createTransaction(expense({ categoryL1: '宠物', categoryL2: '猫粮' }))
    expect(() => deleteCustomCategory(c.id)).toThrow('仍被使用')
  })

  it('改名并重命名小类后级联更新流水', () => {
    const c = createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮'] })
    createTransaction(expense({ categoryL1: '宠物', categoryL2: '猫粮' }))
    updateCustomCategory(c.id, { name: '萌宠', children: ['主食', '狗粮'], renames: [{ from: '猫粮', to: '主食' }] })
    const after = listTransactions()[0]
    expect(after.categoryL1).toBe('萌宠')
    expect(after.categoryL2).toBe('主食')
  })
})

describe('自定义分类的边界校验', () => {
  it('更新不存在的分类抛错', () => {
    expect(() => updateCustomCategory('nope', { name: 'x', children: ['y'], renames: [] })).toThrow('分类不存在')
  })

  it('删除不存在的分类抛错', () => {
    expect(() => deleteCustomCategory('nope')).toThrow('分类不存在')
  })

  it('删除仍被流水使用的小类抛错', () => {
    const c = createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮', '狗粮'] })
    createTransaction(expense({ categoryL1: '宠物', categoryL2: '猫粮' }))
    expect(() => updateCustomCategory(c.id, { name: '宠物', children: ['狗粮'], renames: [] })).toThrow('仍被使用')
  })

  it('小类改名目标重复时抛错', () => {
    const c = createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮', '狗粮'] })
    expect(() =>
      updateCustomCategory(c.id, {
        name: '宠物',
        children: ['主食'],
        renames: [
          { from: '猫粮', to: '主食' },
          { from: '狗粮', to: '主食' }
        ]
      })
    ).toThrow('小类名称重复')
  })
})

describe('initStore 兼容旧数据', () => {
  it('读取旧版 expenses 字段并默认视为支出', () => {
    mem.files.set(
      dataPath(),
      JSON.stringify({
        expenses: [{ id: 'legacy-1', amount: 5, categoryL1: '餐饮', categoryL2: '外卖', date: '2026-08-01' }]
      })
    )
    initStore()
    const list = listTransactions()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('legacy-1')
    expect(list[0].type).toBe('expense')
  })

  it('旧记录带 income 类型时保留为收入', () => {
    mem.files.set(
      dataPath(),
      JSON.stringify({
        transactions: [{ id: 't1', type: 'income', amount: 100, categoryL1: '工资', categoryL2: '工资', date: '2026-08-01' }]
      })
    )
    initStore()
    expect(listTransactions()[0].type).toBe('income')
  })

  it('数据文件损坏时回退为空数据', () => {
    mem.files.set(dataPath(), 'not-valid-json{{{')
    initStore()
    expect(listTransactions()).toHaveLength(0)
    expect(listCustomCategories()).toHaveLength(0)
  })
})

describe('自定义分类的删除与重名', () => {
  it('成功删除自定义分类', () => {
    const c = createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮'] })
    deleteCustomCategory(c.id)
    expect(listCustomCategories()).toHaveLength(0)
  })

  it('创建重名的自定义分类抛错', () => {
    createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮'] })
    expect(() => createCustomCategory({ type: 'expense', name: '宠物', children: ['狗粮'] })).toThrow('已存在')
  })

  it('改名为已存在的分类名抛错', () => {
    createCustomCategory({ type: 'expense', name: '宠物', children: ['猫粮'] })
    const other = createCustomCategory({ type: 'expense', name: '萌宠', children: ['狗粮'] })
    expect(() => updateCustomCategory(other.id, { name: '宠物', children: ['狗粮'], renames: [] })).toThrow('已存在')
  })
})
