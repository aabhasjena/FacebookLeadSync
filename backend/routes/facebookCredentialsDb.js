// routes/facebookCredentialsDb.js
const express = require("express");
const router = express.Router();

let PrismaClient;
try {
  PrismaClient = require("../generated/prisma").PrismaClient;
} catch {
  PrismaClient = require("@prisma/client").PrismaClient;
}
const prisma = new PrismaClient();

// GET list credentials
router.get("/", async (req, res) => {
  try {
    const items = await prisma.pageCredential.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ ok: true, total: items.length, items });
  } catch (err) {
    console.error("GET /api/facebook-credentials error", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// POST add or replace credentials (accepts array)
router.post("/", async (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ ok: false, error: "invalid_payload" });

    // upsert each entry by pageId
    const out = [];
    for (const e of entries) {
      if (!e.pageId || !e.pageToken) continue;
      const pageId = String(e.pageId);
      const pageToken = String(e.pageToken);
      const label = e.label || null;

      const up = await prisma.pageCredential.upsert({
        where: { pageId },
        update: { pageToken, label },
        create: { pageId, pageToken, label },
      });
      out.push(up);
    }

    res.json({ ok: true, saved: out.length, items: out });
  } catch (err) {
    console.error("POST /api/facebook-credentials error", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// DELETE credential by pageId
router.delete("/:pageId", async (req, res) => {
  try {
    const { pageId } = req.params;
    await prisma.pageCredential.deleteMany({ where: { pageId } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/facebook-credentials/:pageId error", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

module.exports = router;
