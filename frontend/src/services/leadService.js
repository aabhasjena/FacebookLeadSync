// src/services/leadsService.js
import { request } from './api'

/**
 * Fetch leads for a specific pageId using the root endpoint /facebook-leads
 * Example request: GET http://localhost:3000/facebook-leads?pageId=515893961615197
 */
export async function fetchLeadsForPage(pageId) {
  if (!pageId) throw new Error('pageId is required')
  const path = `/leadsync/facebook-leads?pageId=${encodeURIComponent(pageId)}`
  return await request(path, { method: 'GET' })
}

/**
 * Optional: fetch saved pages/credentials if you expose an endpoint for that.
 * Adjust path if your backend exposes them under /api/facebook-credentials (or anywhere else).
 */
export async function fetchSavedPages() {
  return await request('/leadsync/facebook-credentials', { method: 'GET' })
}
