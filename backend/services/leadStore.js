// services/leadStore.js
// Safe Prisma wrapper for storing leads.
// Tries to use custom generated client first, then falls back to @prisma/client.

let PrismaClient;
try {
  // If your generator output is "../generated/prisma", require that
  // Adjust this path if your generator output is different.
  PrismaClient = require("../generated/prisma").PrismaClient;
} catch (e) {
  // fallback to installed package
  PrismaClient = require("@prisma/client").PrismaClient;
}

const prisma = new PrismaClient();

/**
 * Upsert a normalized lead object into DB.
 * normalized: object expected to include normalized._meta and normalized._raw
 */
async function upsertLead(normalized) {
  if (!normalized || typeof normalized !== "object") {
    console.warn("leadStore.upsertLead: invalid input");
    return null;
  }
  try {
    const meta = normalized._meta || {};
    const leadId = String(meta.leadId || (normalized._raw && normalized._raw.id) || `${Date.now()}`);
    const pageId = meta.pageId ? String(meta.pageId) : null;
    const formId = meta.formId ? String(meta.formId) : null;

    // Parse created_time and fetchedAt if possible
    let createdTime = null;
    try {
      createdTime = meta.created_time ? new Date(meta.created_time) : null;
      if (createdTime && isNaN(createdTime.getTime())) createdTime = null;
    } catch (e) { createdTime = null; }

    let fetchedAt = null;
    try {
      fetchedAt = meta.fetchedAt ? new Date(meta.fetchedAt) : new Date();
      if (fetchedAt && isNaN(fetchedAt.getTime())) fetchedAt = new Date();
    } catch (e) { fetchedAt = new Date(); }

    // Prepare object for DB. Keep data small: store normalized (but keep raw optional)
    const dbObj = {
      leadId,
      pageId,
      formId,
      createdTime,
      fetchedAt,
      data: normalized, // flexible, Prisma Json
      raw: normalized._raw || null,
    };

    const result = await prisma.fblead.upsert({
      where: { leadId },
      update: {
        pageId: dbObj.pageId,
        formId: dbObj.formId,
        createdTime: dbObj.createdTime,
        fetchedAt: dbObj.fetchedAt,
        data: dbObj.data,
        raw: dbObj.raw,
      },
      create: dbObj,
    });

    return result;
  } catch (err) {
    console.error("leadStore.upsertLead error:", err && err.message ? err.message : err);
    return null;
  }
}

// optional: expose prisma for ad-hoc use
module.exports = {
  upsertLead,
  prisma,
};
