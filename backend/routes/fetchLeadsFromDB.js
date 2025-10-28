// routes/fetchLeadsFromDB.js
const express = require("express");
const router = express.Router();

let PrismaClient;
try {
  PrismaClient = require("../generated/prisma").PrismaClient;
} catch {
  PrismaClient = require("@prisma/client").PrismaClient;
}
const prisma = new PrismaClient();

/**
 * GET /facebook-leads
 * Query Params:
 *   - page (default 1)
 *   - limit (default 20)
 *   - search (optional — match name/email/phone inside JSON)
 *   - formId (optional)
 *   - pageId (optional)
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const formId = req.query.formId || null;
    const pageId = req.query.pageId || null;

    // Build where filters
    const where = {};
    if (formId) where.formId = formId;
    if (pageId) where.pageId = pageId;

    // Optional: search inside JSON data (string search on serialized JSON)
    if (search) {
      where.OR = [
        { data: { contains: search } }, // searches within JSON fields (MySQL JSON string)
      ];
    }

    // Fetch paginated results
    const leads = await prisma.fblead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fetchedAt: "desc" },
    });

    const total = await prisma.fblead.count({ where });

    res.json({
      ok: true,
      total,
      page,
      limit,
      results: leads,
    });
  } catch (err) {
    console.error("GET /facebook-leads error:", err);
    res.status(500).json({ ok: false, error: "internal_error", message: err.message });
  }
});

/**
 * GET /facebook-leads/:leadId
 * Fetch one specific lead by leadId
 */
router.get("/:leadId", async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await prisma.fblead.findUnique({
      where: { leadId },
    });

    if (!lead) return res.status(404).json({ ok: false, error: "not_found" });

    res.json({ ok: true, lead });
  } catch (err) {
    console.error("GET /facebook-leads/:leadId error:", err);
    res.status(500).json({ ok: false, error: "internal_error", message: err.message });
  }
});

module.exports = router;
