import { useEffect, useState } from 'react'
import { categoriesFor, subcategoriesOf } from '../categories'
import type { EntryType, TransactionInput, Transaction } from '@shared/types'

interface Props {
  editing: Transaction | null
  onSubmit: (input: TransactionInput) => Promise<void>
  onCancelEdit: () => void
}

function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function EntryForm({ editing, onSubmit, onCancelEdit }: Props): JSX.Element {
  const [type, setType] = useState<EntryType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryL1, setCategoryL1] = useState(categoriesFor('expense')[0].name)
  const [categoryL2, setCategoryL2] = useState(subcategoriesOf('expense', categoriesFor('expense')[0].name)[0])
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')

  function resetForm(t: EntryType = 'expense'): void {
    const cats = categoriesFor(t)
    setType(t)
    setAmount('')
    setCategoryL1(cats[0].name)
    setCategoryL2(subcategoriesOf(t, cats[0].name)[0])
    setDate(today())
    setNote('')
  }

  useEffect(() => {
    if (editing) {
      setType(editing.type)
      setAmount(String(editing.amount))
      setCategoryL1(editing.categoryL1)
      setCategoryL2(editing.categoryL2)
      setDate(editing.date)
      setNote(editing.note)
    } else {
      resetForm('expense')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  function handleTypeChange(t: EntryType): void {
    const cats = categoriesFor(t)
    setType(t)
    setCategoryL1(cats[0].name)
    setCategoryL2(subcategoriesOf(t, cats[0].name)[0])
  }

  function handleL1Change(l1: string): void {
    setCategoryL1(l1)
    setCategoryL2(subcategoriesOf(type, l1)[0])
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) {
      window.alert('请输入大于 0 的有效金额')
      return
    }
    await onSubmit({
      type,
      amount: Math.round(value * 100) / 100,
      categoryL1,
      categoryL2,
      date,
      note: note.trim()
    })
    resetForm(type)
  }

  const cats = categoriesFor(type)
  const subs = subcategoriesOf(type, categoryL1)

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      <div className="type-toggle">
        <button
          type="button"
          className={type === 'expense' ? 'type-btn active expense' : 'type-btn expense'}
          onClick={() => handleTypeChange('expense')}
        >
          支出
        </button>
        <button
          type="button"
          className={type === 'income' ? 'type-btn active income' : 'type-btn income'}
          onClick={() => handleTypeChange('income')}
        >
          收入
        </button>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">金额（元）</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label className="field">
          <span className="field-label">日期</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">一级分类</span>
          <select value={categoryL1} onChange={(e) => handleL1Change(e.target.value)}>
            {cats.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">二级分类</span>
          <select value={categoryL2} onChange={(e) => setCategoryL2(e.target.value)}>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label className="field field-grow">
          <span className="field-label">备注（可选）</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={type === 'income' ? '例如：本月工资' : '例如：和朋友聚餐'}
          />
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {editing ? '保存修改' : type === 'income' ? '记一笔收入' : '记一笔'}
        </button>
        {editing && (
          <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>
            取消
          </button>
        )}
      </div>
    </form>
  )
}
