import { contextBridge, ipcRenderer } from 'electron'
import type {
  TransactionFilter,
  TransactionInput,
  CustomCategoryInput,
  CustomCategoryUpdate,
  XiaobaiApi
} from '@shared/types'

const api: XiaobaiApi = {
  createTransaction: (input: TransactionInput) => ipcRenderer.invoke('transaction:create', input),
  listTransactions: (filter?: TransactionFilter) =>
    ipcRenderer.invoke('transaction:list', filter ?? {}),
  updateTransaction: (id: string, input: TransactionInput) =>
    ipcRenderer.invoke('transaction:update', id, input),
  deleteTransaction: (id: string) => ipcRenderer.invoke('transaction:delete', id),
  listCustomCategories: () => ipcRenderer.invoke('category:list'),
  createCustomCategory: (input: CustomCategoryInput) => ipcRenderer.invoke('category:create', input),
  updateCustomCategory: (id: string, input: CustomCategoryUpdate) =>
    ipcRenderer.invoke('category:update', id, input),
  deleteCustomCategory: (id: string) => ipcRenderer.invoke('category:delete', id)
}

contextBridge.exposeInMainWorld('api', api)
