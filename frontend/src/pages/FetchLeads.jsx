import React, { useEffect, useState, useMemo } from 'react'
import { fetchLeadsForPage, fetchSavedPages } from '../services/leadService'

export default function FetchLeads() {
  const [savedPages, setSavedPages] = useState([])
  const [pageId, setPageId] = useState('')
  const [manualPageId, setManualPageId] = useState('')
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedRaw, setSelectedRaw] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadPages() {
      try {
        const pages = await fetchSavedPages()
        if (!cancelled && Array.isArray(pages)) {
          const list = pages.entries || pages || []
          setSavedPages(list)
          if (list.length > 0 && !pageId) {
            const firstId = list[0].pageId || list[0].pageIdString || list[0].id
            if (firstId) setPageId(firstId)
          }
        }
      } catch (err) {
        // ignore optional error
      }
    }
    loadPages()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Normalizer (same shape handling as before)
  const normalizeLead = (item) => {
    const payload = item.data || item
    const meta = (payload && payload._meta) || (item && item._meta) || {}
    const createdAtRaw =
      item.insertedAt ||
      item.createdTime ||
      item.fetchedAt ||
      meta.created_time ||
      meta.fetchedAt ||
      payload.created_time ||
      payload.fetchedAt

    return {
      id: item.leadId || item.id || meta.leadId || payload.leadId || null,
      name: payload.full_name || payload.name || payload.contact_name || '-',
      email: payload.email || '-',
      phone: payload.phone_number || payload.phone || payload.whatsapp_number || '-',
      city: payload.city || payload.city_name || '-',
      createdAt: createdAtRaw || item.insertedAt || item.updatedAt || '-',
      raw: item
    }
  }

  const loadLeads = async (targetPageId) => {
    const pageToUse = targetPageId || manualPageId || pageId
    if (!pageToUse) {
      setError('Please provide a Page ID (select or paste it).')
      setLeads([])
      return
    }
    setLoading(true)
    setError(null)
    setLeads([])
    try {
      const data = await fetchLeadsForPage(pageToUse)

      let listRaw = []
      if (Array.isArray(data)) listRaw = data
      else if (Array.isArray(data.results)) listRaw = data.results
      else if (Array.isArray(data.leads)) listRaw = data.leads
      else if (Array.isArray(data.entries)) listRaw = data.entries
      else if (data && typeof data === 'object') {
        const firstArray = Object.values(data).find(v => Array.isArray(v))
        listRaw = Array.isArray(firstArray) ? firstArray : []
      }

      const normalized = listRaw.map(normalizeLead)
      setLeads(normalized)
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    loadLeads()
  }

  // filtered list for quick search
  const filtered = useMemo(() => {
    if (!search) return leads
    const q = search.toLowerCase()
    return leads.filter(l =>
      String(l.name).toLowerCase().includes(q) ||
      String(l.email).toLowerCase().includes(q) ||
      String(l.phone).toLowerCase().includes(q) ||
      String(l.city).toLowerCase().includes(q)
    )
  }, [leads, search])

  // small utility to copy JSON
  const copyRaw = (obj) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
      alert('JSON copied to clipboard')
    } catch (e) {
      alert('Copy failed',e);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Facebook Leads</h2>

      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-6">
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Saved page</label>
          <select
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-white"
          >
            <option value="">-- Choose saved page --</option>
            {savedPages.map((p, i) => {
              const id = p.pageId || p.id || p.pageIdString
              const label = p.name || p.label || id
              return <option key={i} value={id}>{label} — {id}</option>
            })}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm text-gray-600 mb-1">Or paste Page ID (used as param)</label>
          <input
            placeholder="e.g. 515893961615197"
            value={manualPageId}
            onChange={(e) => setManualPageId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-400 mt-1">Manual Page ID takes precedence over the saved selection.</p>
        </div>

        <div className="md:col-span-1 flex gap-2">
          <button type="submit" className="px-4 py-2 bg-sky-600 text-white rounded shadow">Fetch</button>
          <button type="button" onClick={() => loadLeads()} disabled={loading} className="px-4 py-2 border rounded">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="md:col-span-6 mt-2">
          <div className="flex items-center gap-3">
            <input
              placeholder="Search name / email / phone / city"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />
            <div className="text-sm text-gray-500">{filtered.length} results</div>
          </div>
        </div>
      </form>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Lead ID</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">City</th>
              <th className="text-left px-4 py-3">Created At</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No leads found.</td>
              </tr>
            ) : (
              filtered.map((l, i) => (
                <tr key={l.id || i} className="border-t">
                  <td className="px-4 py-3 align-top">{i + 1}</td>
                  <td className="px-4 py-3 align-top">{l.id || '-'}</td>
                  <td className="px-4 py-3 align-top">{l.name}</td>
                  <td className="px-4 py-3 align-top">{l.email}</td>
                  <td className="px-4 py-3 align-top">{l.phone}</td>
                  <td className="px-4 py-3 align-top">{l.city}</td>
                  <td className="px-4 py-3 align-top text-gray-600 text-xs">{l.createdAt}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedRaw(l.raw); }} className="px-2 py-1 border rounded text-xs">View Raw</button>
                      <button onClick={() => copyRaw(l.raw)} className="px-2 py-1 border rounded text-xs">Copy JSON</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Raw JSON modal (simple) */}
      {selectedRaw && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-3xl w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Raw JSON</h3>
              <button onClick={() => setSelectedRaw(null)} className="text-gray-600">Close</button>
            </div>
            <pre className="text-xs max-h-80 overflow-auto bg-gray-100 p-3 rounded">{JSON.stringify(selectedRaw, null, 2)}</pre>
          </div>
        </div>
      )}

    </div>
  )
}
