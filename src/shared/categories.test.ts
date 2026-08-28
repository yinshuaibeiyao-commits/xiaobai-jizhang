import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  presetCategoriesFor,
  presetL1Names,
  mergedCategories,
  subcategoriesOf
} from './categories'
import type { CustomCategory } from './types'

describe('presetCategoriesFor', () => {
  it('支出类型返回支出分类', () => {
    expect(presetCategoriesFor('expense')).toEqual(EXPENSE_CATEGORIES)
  })

  it('收入类型返回收入分类', () => {
    expect(presetCategoriesFor('income')).toEqual(INCOME_CATEGORIES)
  })
})

describe('presetL1Names', () => {
  it('返回支出大类名称列表', () => {
    expect(presetL1Names('expense')).toEqual(EXPENSE_CATEGORIES.map((c) => c.name))
  })

  it('返回收入大类名称列表', () => {
    expect(presetL1Names('income')).toEqual(INCOME_CATEGORIES.map((c) => c.name))
  })
})

describe('mergedCategories', () => {
  it('把自定义分类追加到对应类型的末尾', () => {
    const custom: CustomCategory[] = [
      { id: 'c1', type: 'expense', name: '宠物', children: ['猫粮', '狗粮'] },
      { id: 'c2', type: 'income', name: '彩票', children: ['中奖'] }
    ]
    const merged = mergedCategories(custom)
    expect(merged.expense.at(-1)).toEqual({ name: '宠物', children: ['猫粮', '狗粮'] })
    expect(merged.income.at(-1)).toEqual({ name: '彩票', children: ['中奖'] })
  })

  it('没有自定义分类时不改动预设分类', () => {
    const merged = mergedCategories([])
    expect(merged.expense).toEqual(EXPENSE_CATEGORIES)
    expect(merged.income).toEqual(INCOME_CATEGORIES)
  })
})

describe('subcategoriesOf', () => {
  it('找到大类时返回其子类列表', () => {
    expect(subcategoriesOf(EXPENSE_CATEGORIES, '餐饮')).toEqual([
      '早餐',
      '午餐',
      '晚餐',
      '外卖',
      '零食饮料',
      '聚餐'
    ])
  })

  it('找不到大类时返回空数组', () => {
    expect(subcategoriesOf(EXPENSE_CATEGORIES, '不存在的分类')).toEqual([])
  })
})
