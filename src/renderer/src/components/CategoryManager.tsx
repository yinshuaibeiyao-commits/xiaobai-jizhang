import { useState } from 'react'
import type { CustomCategory, EntryType } from '@shared/types'

interface Props {
  categories: CustomCategory[]
  onChange: () => Promise<void>
}

interface ChildRow {
  original: string
  value: string
}

export default function CategoryManager({ categories, onChange }: Props): JSX.Element {
  const [viewType, setViewType] = useState<EntryType>('expense')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [rows, setRows] = useState<ChildRow[]>([])

  function startCreate(): void {
    setName('')
    setRows([{ original: '', value: '' }])
    setEditingId(null)
    setFormOpen(true)
  }

  function startEdit(c: CustomCategory): void {
    setName(c.name)
    setRows(c.children.map((child) => ({ original: child, value: child })))
    setEditingId(c.id)
    setFormOpen(true)
  }

  function closeForm(): void {
    setName('')
    setRows([])
    setEditingId(null)
    setFormOpen(false)
  }

  function switchType(t: EntryType): void {
    setViewType(t)
    closeForm()
  }

  function updateRow(i: number, value: string): void {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, value } : r)))
  }

  function addRow(): void {
    setRows((prev) => [...prev, { original: '', value: '' }])
  }

  function removeRow(i: number): void {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave(): Promise<void> {
    const trimmedName = name.trim()
    const children = rows.map((r) => r.value.trim()).filter(Boolean)
    if (!trimmedName) {
      window.alert('请填写分类名称')
      return
    }
    if (children.length === 0) {
      window.alert('至少添加一个小类')
      return
    }
    if (new Set(children).size !== children.length) {
      window.alert('小类名称不能重复')
      return
    }
    const renames = rows
      .filter((r) => r.original && r.value.trim() && r.value.trim() !== r.original)
      .map((r) => ({ from: r.original, to: r.value.trim() }))
    try {
      if (editingId) {
        await window.api.updateCustomCategory(editingId, { name: trimmedName, children, renames })
      } else {
        await window.api.createCustomCategory({ type: viewType, name: trimmedName, children })
      }
      closeForm()
      await onChange()
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  async function handleDelete(id: string, catName: string): Promise<void> {
    if (!window.confirm(`确定删除分类「${catName}」吗？`)) return
    try {
      await window.api.deleteCustomCategory(id)
      await onChange()
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  const visible = categories.filter((c) => c.type === viewType)

  return (
    <>
      <div className="list-header">
        <h2>分类管理</h2>
        <div className="type-toggle">
          <button
            type="button"
            className={viewType === 'expense' ? 'type-btn active expense' : 'type-btn expense'}
            onClick={() => switchType('expense')}
          >
            支出
          </button>
          <button
            type="button"
            className={viewType === 'income' ? 'type-btn active income' : 'type-btn income'}
            onClick={() => switchType('income')}
          >
            收入
          </button>
        </div>
      </div>

      <p className="cat-manager-hint">预置分类不可修改；这里可新增、编辑、删除你自建的分类。</p>

      <ul className="cat-list">
        {visible.map((c) => (
          <li key={c.id} className="cat-item">
            <div className="cat-item-info">
              <span className="cat-name">{c.name}</span>
              <span className="cat-children">{c.children.join(' / ')}</span>
            </div>
            <div className="cat-item-actions">
              <button className="btn btn-small" onClick={() => startEdit(c)}>
                编辑
              </button>
              <button className="btn btn-small btn-danger" onClick={() => handleDelete(c.id, c.name)}>
                删除
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && <li className="empty">暂无自定义分类</li>}
      </ul>

      {formOpen ? (
        <div className="cat-form">
          <div className="form-row">
            <label className="field">
              <span className="field-label">分类名称（一级）</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：宠物" />
            </label>
          </div>
          <div className="form-row">
            <div className="field field-grow">
              <span className="field-label">二级小类</span>
              {rows.map((row, i) => (
                <div key={row.original || `new-${i}`} className="cat-child-row">
                  <input
                    value={row.value}
                    onChange={(e) => updateRow(i, e.target.value)}
                    placeholder="小类名称"
                  />
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={() => removeRow(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-small" onClick={addRow}>
                + 添加小类
              </button>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              保存
            </button>
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          新增分类
        </button>
      )}
    </>
  )
}
