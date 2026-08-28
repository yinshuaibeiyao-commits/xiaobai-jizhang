import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// root 元素在 index.html 里已固定存在，这里的非空断言 ! 是安全的
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
