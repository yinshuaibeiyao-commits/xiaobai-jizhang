import { contextBridge, ipcRenderer } from 'electron'
import type { TransactionFilter, TransactionInput, XiaobaiApi } from '@shared/types'

const api: XiaobaiApi = {
  createTransaction: (input: TransactionInput) => ipcRenderer.invoke('transaction:create', input),
  listTransactions: (filter?: TransactionFilter) =>
    ipcRenderer.invoke('transaction:list', filter ?? {}),
  updateTransaction: (id: string, input: TransactionInput) =>
    ipcRenderer.invoke('transaction:update', id, input),
  deleteTransaction: (id: string) => ipcRenderer.invoke('transaction:delete', id)
}

contextBridge.exposeInMainWorld('api', api)
