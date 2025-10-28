// routes/fetchLeadsApi.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const authApiKey = require("../middleware/authApiKey");

const router = express.Router();

// Configure these as needed; read from env
const SAVE_DIR = process.env.TEST_SAVE_DIR || path.join(process.cwd(), "leads");
const MAX_LIMIT = parseInt(process.env.API_MAX_LIMIT || "100", 10);

// Basic CORS — restrict in production
const CORS_ORIGINS = (process.env.API_CORS_ORIGINS || "*").split(",").map(s => s.trim());
router.use(cors({ origin: CORS_ORIGINS }));

// Use API key middleware for all endpoints
router.use(authApiKey);

// Helper: list file names sorted newest -> oldest
function listLeadFiles() {
  if (!fs.existsSync(SAVE_DIR)) return [];
  const files = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".json"));
  // sort by file mtime desc (newest first)
  return files
    .map(f => {
      const p = path.join(SAVE_DIR, f);
      const stat = fs.statSync(p);
      return { file: f, mtime: stat.mtimeMs, path: p };
    })
    .sort((a,b) => b.mtime - a.mtime);
}

// GET /api/leads
// Query params:
//   limit (default 20), page (1-based), since (ISO date or timestamp), form_id, page_id
router.get("/leads", (req, res) => {
  try {
    const { limit = 20, page = 1, since, form_id, page_id } = req.query;
    const L = Math.min(Math.max(parseInt(limit, 10) || 20, 1), MAX_LIMIT);
    const P = Math.max(parseInt(page, 10) || 1, 1);

    const files = listLeadFiles();

    // load metadata only first for filtering/pagination
    const items = [];
    for (const f of files) {
      try {
        const raw = fs.readFileSync(f.path, "utf8");
        const json = JSON.parse(raw);
        // expect normalized file shape like your poller/webhook (with _meta)
        const meta = json._meta || {};
        meta._file = f.file;
        meta._path = f.path;
        meta._rawSnippet = undefined; // skip raw bulk
        items.push({ meta, json });
      } catch (e) {
        // skip corrupt files
      }
    }

    // Filter by since / form_id / page_id if provided
    let filtered = items;
    if (since) {
      const sinceTs = Date.parse(since);
      if (!isNaN(sinceTs)) {
        filtered = filtered.filter(it => {
          const created = it.meta.created_time ? Date.parse(it.meta.created_time) : NaN;
          return !isNaN(created) ? created >= sinceTs : true;
        });
      }
    }
    if (form_id) {
      filtered = filtered.filter(it => String(it.meta.formId) === String(form_id));
    }
    if (page_id) {
      filtered = filtered.filter(it => String(it.meta.pageId) === String(page_id));
    }

    const total = filtered.length;
    const start = (P - 1) * L;
    const pageItems = filtered.slice(start, start + L).map(it => ({
      leadId: it.meta.leadId || it.meta._file.replace(/\.json$/, ""),
      meta: it.meta,
      data: it.json, // full normalized object (trim if you want)
    }));

    res.json({
      ok: true,
      total,
      page: P,
      limit: L,
      results: pageItems,
    });
  } catch (err) {
    console.error("fetchLeadsApi /leads error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// GET /api/leads/:leadId
router.get("/leads/:leadId", (req, res) => {
  try {
    const leadId = req.params.leadId;
    const candidate = path.join(SAVE_DIR, `${leadId}.json`);
    if (!fs.existsSync(candidate)) {
      // maybe filename vs lead meta id mismatch — try search
      const files = fs.readdirSync(SAVE_DIR).filter(f => f.endsWith(".json"));
      for (const f of files) {
        const p = path.join(SAVE_DIR, f);
        try {
          const raw = fs.readFileSync(p, "utf8");
          const json = JSON.parse(raw);
          const meta = json._meta || {};
          if (String(meta.leadId) === String(leadId) || f.replace(/\.json$/,"") === leadId) {
            return res.json({ ok: true, lead: json });
          }
        } catch(e){}
      }
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    const raw = fs.readFileSync(candidate, "utf8");
    return res.json({ ok: true, lead: JSON.parse(raw) });
  } catch (err) {
    console.error("fetchLeadsApi /leads/:id error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

module.exports = router;
