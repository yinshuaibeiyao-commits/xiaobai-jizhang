import { useCallback, useEffect, useMemo, useState } from 'react'
import EntryForm from './components/EntryForm'
import EntryList from './components/EntryList'
import CategoryManager from './components/CategoryManager'
import { ALL_CATEGORIES, mergedCategories } from '@shared/categories'
import type {
  EntryType,
  TransactionFilter,
  TransactionInput,
  Transaction,
  CustomCategory
} from '@shared/types'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function App(): JSX.Element {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [filterType, setFilterType] = useState<EntryType | ''>('')
  const [filterL1, setFilterL1] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  // 把筛选条件整理成传给主进程的 filter 对象：空字符串视为「不限」，转成 undefined
  const filter: TransactionFilter = useMemo(
    () => ({
      type: filterType || undefined,
      categoryL1: filterL1 || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    }),
    [filterType, filterL1, startDate, endDate]
  )

  const load = useCallback(async () => {
    try {
      const data = await window.api.listTransactions(filter)
      setTransactions(data)
      setError('')
    } catch (loadError) {
      setError(`流水加载失败：${errorMessage(loadError)}`)
    }
  }, [filter])

  const loadCategories = useCallback(async () => {
    try {
      const data = await window.api.listCustomCategories()
      setCustomCategories(data)
      setError('')
    } catch (loadError) {
      setError(`分类加载失败：${errorMessage(loadError)}`)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const categories = useMemo(() => mergedCategories(customCategories), [customCategories])

  // 一级分类下拉的候选项：预置分类 + 自定义分类的一级名，去重后返回
  const allL1Names = useMemo(() => {
    const set = new Set(ALL_CATEGORIES.map((c) => c.name))
    for (const c of customCategories) set.add(c.name)
    return Array.from(set)
  }, [customCategories])

  // 提交记账表单：编辑态则更新，否则新增；完成后重新拉取列表
  async function handleSubmit(input: TransactionInput): Promise<void> {
    try {
      if (editing) {
        await window.api.updateTransaction(editing.id, input)
        setEditing(null)
      } else {
        await window.api.createTransaction(input)
      }
      await load()
    } catch (saveError) {
      const message = `保存失败：${errorMessage(saveError)}`
      setError(message)
      window.alert(message)
      throw saveError
    }
  }

  // 删除流水：先二次确认，删除后刷新列表；若删的是正在编辑的那条，一并退出编辑态
  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('确定删除这条记录吗？')) return
    try {
      await window.api.deleteTransaction(id)
      if (editing?.id === id) setEditing(null)
      await load()
    } catch (deleteError) {
      const message = `删除失败：${errorMessage(deleteError)}`
      setError(message)
      window.alert(message)
    }
  }

  async function handleCategoriesChanged(): Promise<void> {
    await Promise.all([load(), loadCategories()])
  }

  // 汇总当前列表的收支与结余（收入 - 支出），随 transactions 变化自动重算
  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense, balance: income - expense }
  }, [transactions])

  return (
    <div className="app">
      <header className="app-header">
        <h1>小白记账</h1>
        <div className="header-summary">
          <span className="sum income">收入 ¥{summary.income.toFixed(2)}</span>
          <span className="sum expense">支出 ¥{summary.expense.toFixed(2)}</span>
          <span className="sum balance">结余 ¥{summary.balance.toFixed(2)}</span>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} aria-label="关闭错误提示">
              ×
            </button>
          </div>
        )}
        <section className="panel">
          <h2>{editing ? '修改记录' : '记一笔'}</h2>
          <EntryForm
            editing={editing}
            categories={categories}
            onSubmit={handleSubmit}
            onCancelEdit={() => setEditing(null)}
          />
        </section>

        <section className="panel">
          <div className="list-header">
            <h2>流水明细</h2>
            <div className="filters">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as EntryType | '')}>
                <option value="">全部</option>
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
              <select value={filterL1} onChange={(e) => setFilterL1(e.target.value)}>
                <option value="">全部分类</option>
                {allL1Names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span className="filter-sep">至</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <EntryList transactions={transactions} onEdit={setEditing} onDelete={handleDelete} />
        </section>

        <section className="panel">
          <CategoryManager categories={customCategories} onChange={handleCategoriesChanged} />
        </section>
      </main>
    </div>
  )
}
