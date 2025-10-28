import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import DashboardHome from './pages/DashboardHome'
import AddCred from './pages/AddCred'
import FetchLeads from './pages/FetchLeads'
import './index.css' // use the merged index.css

export default function App() {
  return (
    <div className="app-root">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main style={{ overflow: 'auto', flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/add-cred" element={<AddCred />} />
            <Route path="/fetch-leads" element={<FetchLeads />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
