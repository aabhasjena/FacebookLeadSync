import React, { useEffect, useState } from 'react'
import { FiBell, FiShare2, FiSettings } from 'react-icons/fi'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Header() {
  const now = useClock()
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateString = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="clock">
          <div className="time">{timeString}</div>
          <div className="date">{dateString}</div>
        </div>
      </div>

      <div className="header-right">
        <button className="icon-btn"><FiShare2 /></button>
        <button className="icon-btn"><FiSettings /></button>

        <div className="notif">
          <button className="icon-btn">
            <FiBell />
            <span className="notif-badge">2</span>
          </button>
        </div>

        <div className="user">
          <div className="user-bubble">A</div>
          <div className="user-meta">
            <div className="user-name">Admin</div>
            <div className="user-email">admin@domain.com</div>
          </div>
        </div>
      </div>
    </header>
  )
}
