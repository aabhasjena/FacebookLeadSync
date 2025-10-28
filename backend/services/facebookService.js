// services/facebookService.js
const axios = require("axios");

/**
 * For testing this returns TEST_PAGE_TOKEN from .env (optionally checks TEST_PAGE_ID).
 * Replace with DB lookup in production.
 */
// async function getPageAccessTokenForPage(pageId) {
//   const TEST_PAGE_ID = process.env.TEST_PAGE_ID || null;
//   const TEST_PAGE_TOKEN = process.env.TEST_PAGE_TOKEN || null;
//   if (TEST_PAGE_TOKEN) {
//     if (!TEST_PAGE_ID || String(pageId) === String(TEST_PAGE_ID)) {
//       return TEST_PAGE_TOKEN;
//     }
//   }
//   // TODO: return token from DB in production
//   return null;
// }

async function getPageAccessTokenForPage(pageId) {
  // 1) env TEST token fallback (preserve existing behavior)
  const TEST_PAGE_ID = process.env.TEST_PAGE_ID || null;
  const TEST_PAGE_TOKEN = process.env.TEST_PAGE_TOKEN || null;
  if (TEST_PAGE_ID && TEST_PAGE_TOKEN && String(pageId) === String(TEST_PAGE_ID)) return TEST_PAGE_TOKEN;

  // 2) DB lookup
  try {
    const rec = await prisma.pageCredential.findUnique({ where: { pageId: String(pageId) } });
    if (rec && rec.pageToken) return rec.pageToken;
  } catch (e) {
    console.warn("facebookService.getPageAccessTokenForPage: db lookup failed", e.message || e);
  }

  // 3) fallback null
  return null;
}

async function fetchLeadsForForm(formId, pageAccessToken, limit = 20) {
  const FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v23.0";
  const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${formId}/leads`;
  const resp = await axios.get(url, {
    params: {
      access_token: pageAccessToken,
      fields: "id,created_time,field_data",
      limit,
    },
    timeout: 10000,
  });
  return resp.data?.data || [];
}

function normalizeLeadData(lead) {
  const out = {};
  const field_data = Array.isArray(lead.field_data) ? lead.field_data : [];
  for (const f of field_data) {
    const key = f.name || f.key || "unknown";
    let val = "";
    if (Array.isArray(f.values)) val = f.values.join(", ");
    else if (f.value !== undefined) val = f.value;
    else if (f.values !== undefined) val = String(f.values);
    out[key] = val;
  }
  return out;
}

function formatDate(dateInput, tz = "UTC") {
  const d = new Date(dateInput);
  try {
    return d.toLocaleString("en-GB", { timeZone: tz }); // "11/09/2025, 14:00:16"
  } catch {
    return d.toISOString();
  }
}

module.exports = {
  getPageAccessTokenForPage,
  fetchLeadsForForm,
  normalizeLeadData,
  formatDate,
};
