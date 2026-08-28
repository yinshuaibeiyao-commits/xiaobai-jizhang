import type { CustomCategory, EntryType } from './types'

export interface CategoryNode {
  name: string
  children: string[]
}

export const EXPENSE_CATEGORIES: CategoryNode[] = [
  { name: '餐饮', children: ['早餐', '午餐', '晚餐', '外卖', '零食饮料', '聚餐'] },
  { name: '交通', children: ['公交地铁', '打车', '加油充电', '停车', '火车飞机', '共享单车'] },
  { name: '购物', children: ['服饰鞋包', '数码家电', '日用百货', '美妆护肤'] },
  { name: '居住', children: ['房租', '水电燃气', '物业费', '家居维修', '话费宽带'] },
  { name: '娱乐', children: ['电影演出', '游戏', '旅行', '运动健身', '会员订阅'] },
  { name: '医疗', children: ['药品', '门诊', '体检'] },
  { name: '教育', children: ['书籍', '课程培训', '学费'] },
  { name: '人情', children: ['红包', '礼物', '请客'] },
  { name: '其他', children: ['其他'] }
]

export const INCOME_CATEGORIES: CategoryNode[] = [
  { name: '工资', children: ['工资', '奖金', '津贴'] },
  { name: '兼职副业', children: ['兼职', '副业', '自由职业'] },
  { name: '理财收益', children: ['利息', '股票基金', '房租收入'] },
  { name: '红包转账', children: ['红包', '收礼', '转账收款'] },
  { name: '报销退款', children: ['报销', '退款'] },
  { name: '其他收入', children: ['其他'] }
]

export const ALL_CATEGORIES: CategoryNode[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

export function presetCategoriesFor(type: EntryType): CategoryNode[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function presetL1Names(type: EntryType): string[] {
  return presetCategoriesFor(type).map((c) => c.name)
}

// 把预置分类和用户自定义分类合并：按类型（支出/收入）分组，自定义分类追加在对应类型的预置分类之后
export function mergedCategories(custom: CustomCategory[]): Record<EntryType, CategoryNode[]> {
  const toNode = (c: CustomCategory): CategoryNode => ({ name: c.name, children: c.children })
  return {
    expense: [...EXPENSE_CATEGORIES, ...custom.filter((c) => c.type === 'expense').map(toNode)],
    income: [...INCOME_CATEGORIES, ...custom.filter((c) => c.type === 'income').map(toNode)]
  }
}

export function subcategoriesOf(list: CategoryNode[], l1: string): string[] {
  const node = list.find((c) => c.name === l1)
  return node ? node.children : []
}
