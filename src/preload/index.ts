import { contextBridge, ipcRenderer } from 'electron'
import type {
  TransactionFilter,
  TransactionInput,
  CustomCategoryInput,
  CustomCategoryUpdate,
  XiaobaiApi
} from '@shared/types'

// 只把白名单里定义好的方法暴露给渲染进程，而不是直接暴露 ipcRenderer 本身（更安全）
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

// 把 API 桥挂到 window.api 上，渲染层只通过这些方法与主进程通信
contextBridge.exposeInMainWorld('api', api)
