import type { Transaction } from '@shared/types'

interface Props {
  transactions: Transaction[]
  onEdit: (record: Transaction) => void
  onDelete: (id: string) => void
}

// 把 YYYY-MM-DD 格式化成「日期 + 周几」；拼 T00:00:00 是防止时区偏移把日期往前/后推一天
function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${date} 周${week}`
}

export default function EntryList({ transactions, onEdit, onDelete }: Props): JSX.Element {
  if (transactions.length === 0) {
    return <div className="empty">暂无记录，先记一笔吧～</div>
  }

  return (
    <ul className="expense-list">
      {transactions.map((t) => {
        const isIncome = t.type === 'income'
        return (
          <li key={t.id} className="expense-item">
            <div className="expense-category">
              <span className={isIncome ? 'badge badge-income' : 'badge'}>{t.categoryL1}</span>
              <span className="sub">{t.categoryL2}</span>
            </div>
            <div className="expense-info">
              <div className="expense-note">{t.note || '—'}</div>
              <div className="expense-date">{formatDate(t.date)}</div>
            </div>
            <div className={isIncome ? 'expense-amount income' : 'expense-amount expense'}>
              {isIncome ? '+' : '-'}¥{t.amount.toFixed(2)}
            </div>
            <div className="expense-actions">
              <button className="btn btn-small" onClick={() => onEdit(t)}>
                编辑
              </button>
              <button className="btn btn-small btn-danger" onClick={() => onDelete(t.id)}>
                删除
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
