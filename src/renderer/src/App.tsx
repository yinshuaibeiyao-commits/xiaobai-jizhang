import { useCallback, useEffect, useMemo, useState } from 'react'
import EntryForm from './components/EntryForm'
import EntryList from './components/EntryList'
import { ALL_CATEGORIES } from './categories'
import type { EntryType, TransactionFilter, TransactionInput, Transaction } from '@shared/types'

export default function App(): JSX.Element {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [filterType, setFilterType] = useState<EntryType | ''>('')
  const [filterL1, setFilterL1] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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
    const data = await window.api.listTransactions(filter)
    setTransactions(data)
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(input: TransactionInput): Promise<void> {
    if (editing) {
      await window.api.updateTransaction(editing.id, input)
      setEditing(null)
    } else {
      await window.api.createTransaction(input)
    }
    await load()
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('确定删除这条记录吗？')) return
    await window.api.deleteTransaction(id)
    if (editing?.id === id) setEditing(null)
    await load()
  }

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
        <section className="panel">
          <h2>{editing ? '修改记录' : '记一笔'}</h2>
          <EntryForm editing={editing} onSubmit={handleSubmit} onCancelEdit={() => setEditing(null)} />
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
                {ALL_CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
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
      </main>
    </div>
  )
}
