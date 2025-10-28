import React from 'react'

export default function DashboardHome() {
  const stats = [
    { title: 'Total Users', value: 0, color: 'blue' },
    { title: 'Pending KYC', value: 0, color: 'orange' },
    { title: 'Pending Deposits', value: 0, color: 'purple' },
    { title: 'Total Deposits', value: 0, color: 'green' },
  ]

  return (
    <div className="page-container dashboard">
      <h1 className="page-title">Admin Dashboard</h1>

      <div className="stat-grid">
        {stats.map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`}>
            <div className="stat-title">{s.title}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-two">
        <div className="panel">
          <h3>Market Overview</h3>
          <div className="panel-body"> {/* left placeholder */} </div>
        </div>

        <div className="panel">
          <h3>User Growth</h3>
          <div className="panel-body large"> {/* right placeholder */} </div>
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <h3>Users — Verified vs Not Verified</h3>
          <div className="panel-body"> </div>
        </div>
        <div className="panel">
          <h3>Recent Activities</h3>
          <div className="panel-body"> </div>
        </div>
      </div>
    </div>
  )
}
