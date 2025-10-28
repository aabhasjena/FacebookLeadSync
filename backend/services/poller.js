// services/poller.js
const cron = require("node-cron");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const facebookService = require("./facebookService");

const SAVE_DIR = process.env.TEST_SAVE_DIR || path.join(process.cwd(), "leads");
const PROCESSED_FILE = path.join(process.cwd(), "processed_leads.json");

// ensure leads folder exists
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

function loadProcessed() {
  try {
    if (!fs.existsSync(PROCESSED_FILE)) return {};
    return JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf8") || "{}");
  } catch (e) {
    console.error("poller: failed to load processed file:", e);
    return {};
  }
}
function saveProcessed(obj) {
  try {
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error("poller: failed to save processed file:", e);
  }
}

/* NOTE: We keep the function available for reference but we DO NOT
   use POLL_FORMS_JSON anymore — DB-only mode below.
*/
function loadPollingListFromEnv() {
  // kept for reference but not used in DB-only mode
  return [];
}

/**
 * DB helpers (optional) - tries to require Prisma; if not available, returns null
 */
let prisma = null;
try {
  const pc = require("../generated/prisma").PrismaClient;
  prisma = new pc();
} catch (e) {
  try {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient();
  } catch (e2) {
    prisma = null;
  }
}

const leadStorePath = path.join(__dirname, "leadStore");
let leadStore = null;
try {
  leadStore = require(leadStorePath);
} catch (e) {
  // not fatal; DB persistence will be skipped if leadStore absent
  console.warn("poller: leadStore not found at", leadStorePath);
}

/**
 * Discover forms for a page:
 * - Try DB PageForm table if available
 * - Else call Graph API: /{pageId}/leadgen_forms and persist to DB if possible
 */
async function discoverFormsForPage(pageId, pageToken) {
  // 1) DB lookup
  if (prisma) {
    try {
      if (typeof prisma.pageForm !== "undefined") {
        const dbForms = await prisma.pageForm.findMany({ where: { pageId } });
        if (Array.isArray(dbForms) && dbForms.length) return dbForms.map((f) => String(f.formId));
      } else if (typeof prisma.PageForm !== "undefined") {
        const dbForms = await prisma.PageForm.findMany({ where: { pageId } });
        if (Array.isArray(dbForms) && dbForms.length) return dbForms.map((f) => String(f.formId));
      }
    } catch (e) {
      console.warn("poller.discoverForms: DB lookup failed:", e && e.message ? e.message : e);
    }
  }

  // 2) Graph API fallback
  try {
    const FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v23.0";
    const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}/leadgen_forms`;
    const resp = await axios.get(url, {
      params: { access_token: pageToken, fields: "id,name,created_time", limit: 50 },
      timeout: 10000,
    });
    const forms = resp.data?.data || [];
    const ids = forms.map(f => String(f.id));

    // persist to DB if possible
    if (prisma) {
      for (const f of forms) {
        try {
          if (typeof prisma.pageForm !== "undefined") {
            await prisma.pageForm.upsert({
              where: { formId: String(f.id) },
              update: { name: f.name || null, lastSeen: new Date() },
              create: { formId: String(f.id), pageId: String(pageId), name: f.name || null, lastSeen: new Date() },
            });
          } else if (typeof prisma.PageForm !== "undefined") {
            await prisma.PageForm.upsert({
              where: { formId: String(f.id) },
              update: { name: f.name || null, lastSeen: new Date() },
              create: { formId: String(f.id), pageId: String(pageId), name: f.name || null, lastSeen: new Date() },
            });
          }
        } catch (e) {
          // ignore per-form failures
        }
      }
    }

    return ids;
  } catch (err) {
    console.warn("poller.discoverFormsForPage: Graph API failed for", pageId, err?.response?.data || err.message || err);
    return [];
  }
}

/**
 * Primary pollOnce loop:
 * DB-only flow (ignore POLL_FORMS_JSON)
 */
async function pollOnce() {
  console.log("poller: running pollOnce (DB-only mode). Prisma available:", !!prisma);

  if (!prisma) {
    console.log("poller: prisma not available; exiting pollOnce.");
    return;
  }

  // load credentials from DB (PageCredential)
  let creds = [];
  try {
    if (typeof prisma.pageCredential !== "undefined") {
      creds = await prisma.pageCredential.findMany();
    } else if (typeof prisma.PageCredential !== "undefined") {
      creds = await prisma.PageCredential.findMany();
    } else {
      console.warn("poller: prisma has no pageCredential accessor; skipping DB poll.");
      return;
    }
  } catch (e) {
    console.error("poller: failed to load PageCredential from DB:", e && e.message ? e.message : e);
    return;
  }

  console.log("poller: found credentials count:", creds.length, "pages:", creds.map(x => x.pageId).join(", "));

  if (!Array.isArray(creds) || creds.length === 0) {
    console.log("poller: no page credentials found in DB");
    return;
  }

  // dedupe map for processed
  const processed = loadProcessed();

  for (const c of creds) {
    const pageId = c.pageId;
    const pageToken = c.pageToken;
    console.log(`poller: processing pageId=${pageId} tokenPresent=${!!pageToken}`);
    if (!pageId || !pageToken) {
      console.warn("poller: skipping credential with missing pageId/token", c);
      continue;
    }

    const forms = await discoverFormsForPage(pageId, pageToken);
    console.log(`poller: forms discovered for ${pageId}: ${Array.isArray(forms) && forms.length ? forms.join(", ") : "NONE"}`);
    if (!forms || forms.length === 0) {
      console.log("poller: no forms discovered for page", pageId);
      continue;
    }

    for (const formId of forms) {
      try {
        const rawLeads = await facebookService.fetchLeadsForForm(formId, pageToken, 50);
        rawLeads.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

        for (const lead of rawLeads) {
          if (processed[lead.id]) {
            // already processed
            continue;
          }

          const normalized = facebookService.normalizeLeadData(lead);
          normalized._meta = {
            leadId: lead.id,
            pageId,
            formId,
            created_time: facebookService.formatDate(lead.created_time, "Asia/Kolkata"),
            fetchedAt: facebookService.formatDate(new Date(), "Asia/Kolkata"),
          };

          const savePath = path.join(SAVE_DIR, `${lead.id}.json`);
          try {
            fs.writeFileSync(savePath, JSON.stringify(normalized, null, 2));
            console.log("poller: saved lead", lead.id, "->", savePath);
          } catch (e) {
            console.error("poller: failed to save lead", lead.id, e);
            continue;
          }

          // persist to DB (await here is fine; poller runs in background)
          if (leadStore && typeof leadStore.upsertLead === "function") {
            try {
              const res = await leadStore.upsertLead(normalized);
              if (res) console.log("poller: lead persisted to DB", res.leadId);
              else console.warn("poller: lead not persisted (null) for", normalized._meta?.leadId);
            } catch (e) {
              console.error("poller: leadStore.upsert error:", e && e.message ? e.message : e);
            }
          }

          processed[lead.id] = { processedAt: new Date().toISOString(), pageId, formId };
        }
      } catch (err) {
        console.error("poller: error polling form", formId, err?.response?.data || err.message || err);
      }
    }
  }

  saveProcessed(processed);
}

function startCron(schedule = process.env.POLL_CRON || "*/30 * * * * *") {
  console.log("poller: starting cron with schedule:", schedule);
  // initial run
  pollOnce().catch(e => console.error("poller initial run failed:", e));
  cron.schedule(schedule, () => {
    pollOnce().catch(e => console.error("poller run failed:", e));
  });
}

module.exports = { startCron, pollOnce };
