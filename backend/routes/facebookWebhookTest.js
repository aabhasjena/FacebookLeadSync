// facebookWebhookTest.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// CONFIG via env
const FB_APP_SECRET = process.env.FB_APP_SECRET || "";
const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || "verify_token_local";
const TEST_MODE = (process.env.DISABLE_FB_SIG || "true").toLowerCase() === "true";
const SAVE_DIR = process.env.TEST_SAVE_DIR || path.join(process.cwd(), "leads");

// optional test page id/token from .env
const TEST_PAGE_ID = process.env.TEST_PAGE_ID || null;
const TEST_PAGE_TOKEN = process.env.TEST_PAGE_TOKEN || null;

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

router.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Verify Facebook signature
function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !FB_APP_SECRET) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", FB_APP_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// GET verification
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified.");
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Verification failed");
    }
  }
  res.status(200).send("OK - webhook endpoint");
});

// --- NEW HELPER: Poll for leads (handles race condition in testing tool) ---
async function pollForLeads({ formId, pageAccessToken, attempts = 5, delayMs = 1000 }) {
  const FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v23.0";
  const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${formId}/leads`;

  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await axios.get(url, {
        params: {
          access_token: pageAccessToken,
          fields: "id,created_time,field_data",
          limit: 5,
        },
        timeout: 10000,
      });
      const leads = resp.data.data || [];
      if (leads.length) return leads; // got leads
    } catch (err) {
      // swallow error and retry
      console.warn("pollForLeads attempt failed:", err.response?.data || err.message);
    }
    // wait before retry
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs *= 2; // exponential backoff
  }
  return [];
}

function formatDate(dateString, tz = "UTC") {
  const d = new Date(dateString);
  return d.toLocaleString("en-GB", { timeZone: tz }); // e.g. "11/09/2025, 13:49:25"
}

// POST handler
router.post("/", async (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"];

    if (!TEST_MODE) {
      if (!verifySignature(req.rawBody, signature)) {
        console.error("Invalid signature");
        return res.status(401).send("Invalid signature");
      }
    } else {
      console.log("TEST_MODE enabled — skipping signature check.");
    }

    // ACK quickly
    res.status(200).send("EVENT_RECEIVED");

    const body = req.body;

    if (body.object === "page") {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === "leadgen" && change.value) {
            const pageId = change.value.page_id || entry.id;
            const formId = change.value.form_id;

            if (!pageId || !formId) {
              console.warn("Webhook missing pageId or formId:", change.value);
              continue;
            }

            try {
              const pageAccessToken = await getPageAccessTokenForPage(pageId);
              if (!pageAccessToken) {
                console.error("No page access token for", pageId);
                continue;
              }

              // Fetch leads with polling to ensure availability (especially with test tool)
              const leads = await pollForLeads({ formId, pageAccessToken });

              if (!leads.length) {
                console.log("No leads returned for form:", formId);
              }

              for (const lead of leads) {
                const normalized = normalizeLeadData(lead);
                normalized._meta = {
                  leadId: lead.id,
                  pageId,
                  formId,
                  created_time: formatDate(lead.created_time, "Asia/Kolkata"), 
                  fetchedAt: formatDate(new Date(), "Asia/Kolkata"), // <-- when we pulled it
                };

                const savePath = path.join(SAVE_DIR, `${lead.id}.json`);
                fs.writeFileSync(savePath, JSON.stringify(normalized, null, 2));
                console.log("Saved lead:", savePath);

                // ---- NEW: persist to DB (non-blocking, safe) ----
                try {
                  const leadStore = require("./services/leadStore");
                  leadStore.upsertLead(normalized)
                    .then((r) => {
                      if (r) console.log("Lead stored to DB:", r.leadId);
                      else console.warn("Lead not stored to DB (null result) for:", normalized._meta?.leadId);
                    })
                    .catch((e) => {
                      console.error("leadStore error:", e && e.message ? e.message : e);
                    });
                } catch (e) {
                  console.error("Failed to require leadStore:", e && e.message ? e.message : e);
                }
                // ---- end DB persist block ----
              }
            } catch (err) {
              console.error(
                "Error fetching leads:",
                err.response?.data || err.message || err
              );
            }
          }
        }
      }
    } else {
      console.log("Unhandled webhook object:", body.object);
    }
  } catch (err) {
    console.error("Error in webhook:", err && err.stack ? err.stack : err);
  }
});

// Normalize Facebook field_data into key:value
function normalizeLeadData(lead) {
  const out = {};
  const field_data = Array.isArray(lead.field_data) ? lead.field_data : [];
  for (const f of field_data) {
    const name = f.name || "unknown";
    const value = Array.isArray(f.values)
      ? f.values.join(", ")
      : f.values || f.value || "";
    out[name] = value;
  }
  out._raw = lead;
  return out;
}

/* ---------- getPageAccessTokenForPage: uses TEST_PAGE_ID/TOKEN from .env ---------- */
async function getPageAccessTokenForPage(pageId) {
  if (TEST_PAGE_ID && TEST_PAGE_TOKEN && String(pageId) === String(TEST_PAGE_ID)) {
    return TEST_PAGE_TOKEN;
  }
  return null; // TODO: DB lookup for production
}

module.exports = router;
