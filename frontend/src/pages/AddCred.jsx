import React, { useState } from 'react'
import { FiPlus, FiTrash2, FiCopy, FiEye, FiEyeOff, FiRefreshCw, FiSave } from 'react-icons/fi'
import { addCredentials } from '../services/credentialsService'

export default function AddCredProfessional() {
  const [rows, setRows] = useState([
    { pageId: '', label: '', pageToken: '', showToken: false, errors: {} }
  ])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const update = (i, field, value) => {
    setRows(r => {
      const copy = [...r]
      copy[i] = { ...copy[i], [field]: value, errors: { ...copy[i].errors, [field]: null } }
      return copy
    })
  }

  const addRow = () => setRows(r => [...r, { pageId: '', label: '', pageToken: '', showToken: false, errors: {} }])
  const removeRow = (i) => setRows(r => (r.length === 1 ? r : r.filter((_, idx) => idx !== i)))
  const toggleShow = (i) => setRows(r => {
    const copy = [...r]
    copy[i].showToken = !copy[i].showToken
    return copy
  })

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage({ type: 'success', text: 'Token copied' })
      setTimeout(() => setMessage(null), 2000)
    } catch {
      setMessage({ type: 'error', text: 'Copy failed' })
    }
  }

  const validate = () => {
    let ok = true
    setRows(prev => prev.map(row => {
      const errors = {}
      if (!row.pageId || row.pageId.trim().length < 4) { errors.pageId = 'Enter a valid Page ID'; ok = false }
      if (!row.pageToken || row.pageToken.trim().length < 20) { errors.pageToken = 'Token looks too short'; ok = false }
      return { ...row, errors }
    }))
    return ok
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)
    if (!validate()) {
      setMessage({ type: 'error', text: 'Please fix validation errors' })
      return
    }
    setLoading(true)
    try {
      const payload = { entries: rows.map(({ pageId, pageToken, label }) => ({ pageId: pageId.trim(), pageToken: pageToken.trim(), label: label?.trim() })) }
      await addCredentials(payload)
      setMessage({ type: 'success', text: 'Credentials saved' })
      setRows(r => r.map(x => ({ ...x, pageToken: '' })))
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: err?.message || 'Save failed' })
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div className="ac-panel">
      <div className="ac-header">
        <div>
          <h2>Add Your Page Credentials</h2>
        </div>

        <div className="ac-actions">
          <button type="button" className="action-btn" title="Refresh"><FiRefreshCw /> Refresh</button>
          <button type="button" className="action-btn primary" onClick={onSubmit} title="Save"><FiSave /> Save</button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="ac-form" autoComplete="off">
        {rows.map((row, i) => (
          <div className="ac-row" key={i}>
            <div className="field two-col">
              <label>Page ID *</label>
              <input value={row.pageId} onChange={e => update(i, 'pageId', e.target.value)} placeholder="e.g. 675733282298574" />
              {row.errors?.pageId && <div className="error">{row.errors.pageId}</div>}
            </div>

            <div className="field two-col">
              <label>Label</label>
              <input value={row.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Friendly name (optional)" />
            </div>

            <div className="field full-width token-field">
              <label>Page Token *</label>
              <div className="token-wrap">
                <input
                  value={row.pageToken}
                  onChange={e => update(i, 'pageToken', e.target.value)}
                  placeholder="EAAKhKc8DmcABP..."
                  type={row.showToken ? 'text' : 'password'}
                />
                <div className="token-opts">
                  <button type="button" className="small" onClick={() => toggleShow(i)}>{row.showToken ? <FiEyeOff /> : <FiEye />}</button>
                  <button type="button" className="small" onClick={() => copyToClipboard(row.pageToken)}><FiCopy /></button>
                  <button type="button" className="small remove" onClick={() => removeRow(i)} disabled={rows.length === 1}><FiTrash2 /></button>
                </div>
              </div>
              {row.errors?.pageToken && <div className="error">{row.errors.pageToken}</div>}
            </div>

          </div>
        ))}

        <div className="form-bottom">
          <button type="button" className="add-btn" onClick={addRow}><FiPlus /> Add another</button>
          <button type="submit" className="save-btn" disabled={loading}>{loading ? 'Saving...' : 'Save Credentials'}</button>
        </div>
      </form>

      <div className="preview">
        <h4>Payload preview</h4>
        <pre>{JSON.stringify({ entries: rows.map(({ pageId, pageToken, label }) => ({ pageId, pageToken: pageToken ? '••••••••' : '', label })) }, null, 2)}</pre>
        {/* <p className="muted">We mask tokens in preview for your safety. Tokens are sent securely to the backend.</p> */}

        {message && <div className={`msg ${message.type}`}>{message.text}</div>}
      </div>

      <style jsx>{`
        .ac-panel{ background:#0f1112; padding:18px; border-radius:8px; color:#e6eef6; max-width:980px; margin:20px auto; box-shadow:0 8px 24px rgba(2,6,23,0.6)}
        .ac-header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }
        .ac-header h2{ margin:0; font-size:18px }
        .ac-actions{ display:flex; gap:10px }
        .action-btn{ background:transparent; border:1px solid rgba(255,255,255,0.06); color:#e6eef6; padding:8px 10px; border-radius:6px; display:inline-flex; gap:8px; align-items:center; cursor:pointer }
        .action-btn.primary{ background:#b8860b; border-color:rgba(184,134,11,0.9); color:#081018 }
        .ac-form{ display:flex; flex-direction:column; gap:12px }
        .ac-row{ background:rgba(255,255,255,0.01); padding:14px; border-radius:8px; border:1px solid rgba(255,255,255,0.02); display:grid; grid-template-columns: repeat(2,1fr); gap:12px }
        .field{ display:flex; flex-direction:column }
        .field label{ font-size:13px; color:rgba(255,255,255,0.6); margin-bottom:8px }
        .field input{ padding:10px 12px; border-radius:6px; background:transparent; border:1px solid rgba(255,255,255,0.04); color:inherit; outline:none }
        .full-width{ grid-column:1 / -1 }
        .token-wrap{ display:flex; gap:10px; align-items:center }
        .token-wrap input{ flex:1 }
        .token-opts{ display:flex; gap:6px }
        .token-opts .small{ background:transparent; border:1px solid rgba(255,255,255,0.04); padding:8px; border-radius:6px; cursor:pointer; color:inherit }
        .token-opts .remove{ color:#ff9aa2; border-color:rgba(255,0,50,0.06) }
        .error{ color:#ff9aa2; font-size:12px; margin-top:6px }

        .form-bottom{ display:flex; justify-content:space-between; align-items:center; margin-top:6px }
        .add-btn{ background:transparent; border:1px dashed rgba(255,255,255,0.04); padding:8px 12px; border-radius:6px; color:rgba(255,255,255,0.8); cursor:pointer; display:inline-flex; gap:8px; align-items:center }
        .save-btn{ background:linear-gradient(90deg,#2d6df6,#1b9cff); color:white; padding:9px 14px; border-radius:8px; border:0; cursor:pointer }

        .preview{ margin-top:14px; background:rgba(255,255,255,0.01); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.02) }
        .preview pre{ background:#051018; padding:12px; border-radius:6px; color:#cbd5e1; max-height:220px; overflow:auto }
        .preview .muted{ color:rgba(255,255,255,0.5); font-size:13px; margin-top:8px }
        .msg{ margin-top:10px; padding:10px; border-radius:6px; font-weight:600 }
        .msg.success{ background:rgba(16,185,129,0.08); color:#5eead4 }
        .msg.error{ background:rgba(239,68,68,0.06); color:#fecaca }

        @media (max-width:800px){
          .ac-row{ grid-template-columns: 1fr }
          .ac-panel{ padding:12px }
          .ac-actions{ gap:6px }
        }
      `}</style>
    </div>
  )
}
