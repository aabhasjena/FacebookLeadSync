import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  FiGrid,
  FiSettings,
  FiUsers,
  FiDollarSign,
  FiBell,
  FiChevronLeft,
  FiChevronRight,
  FiLogOut,
  FiUser
} from 'react-icons/fi'


export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  const menu = [
    { to: '/dashboard', icon: <FiGrid />, label: 'Dashboard' },
    { to: '/add-cred', icon: <FiUsers />, label: 'Add Cred' },
    { to: '/fetch-leads', icon: <FiDollarSign />, label: 'Fetch Leads' },
    // add other items as needed
  ]

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-bubble">LS</div>
          {!collapsed && <div className="brand-text">LeadsSync</div>}
        </div>

        <button
          aria-label="toggle"
          className="collapse-btn"
          onClick={() => setCollapsed(v => !v)}
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menu.map((m, i) => (
          <NavLink
            key={i}
            to={m.to}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <div className="nav-icon">{m.icon}</div>
            {!collapsed && <div className="nav-label">{m.label}</div>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="profile">
          <div className="profile-bubble">A</div>
          {!collapsed && (
            <div className="profile-meta">
              <div className="name">Admin</div>
              <div className="email">admin@domain.com</div>
            </div>
          )}
        </div>

        <button className="logout-btn">
          <FiLogOut />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
