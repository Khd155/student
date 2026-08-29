import { jsonResponse, requireAdmin, logActivity, clientIp } from "./_auth.js";

// D1's Workers binding caps bound parameters at 100 per statement.
// Each row binds 5 params (id, name, grade, class, phone), so keep a
// safe margin under 100 / 5 = 20 rows per INSERT.
const CHUNK_SIZE = 15;

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function convertNonLatinDigits(str) {
  return String(str).replace(/[٠-٩۰-۹]/g, (ch) => {
    const arabicIdx = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (arabicIdx !== -1) return String(arabicIdx);
    const persianIdx = PERSIAN_DIGITS.indexOf(ch);
    return persianIdx !== -1 ? String(persianIdx) : ch;
  });
}

function stripHiddenChars(str) {
  return String(str).replace(/[​-‏‪-‮﻿]/g, "");
}

// Excel sometimes stores/displays long numeric IDs in scientific
// notation (e.g. "4.1465715E+9"). Expand that back into a plain
// integer string instead of silently truncating or rounding.
function expandScientificNotation(str) {
  const s = String(str).trim();
  const m = s.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!m) return s;

  const [, sign, intPart, fracPart = "", expStr] = m;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Math.abs(exp) > 30) return s;

  let digits = intPart + fracPart;
  const pointPos = intPart.length + exp;

  if (pointPos >= digits.length) {
    return sign + digits + "0".repeat(pointPos - digits.length);
  }
  if (pointPos <= 0) {
    return sign + "0." + "0".repeat(-pointPos) + digits;
  }
  return sign + digits.slice(0, pointPos) + "." + digits.slice(pointPos);
}

function sanitizeText(raw) {
  return stripHiddenChars(String(raw ?? "")).trim();
}

// For fields that must end up purely numeric (id, class, phone).
function sanitizeIdLike(raw) {
  let s = convertNonLatinDigits(sanitizeText(raw));
  s = expandScientificNotation(s);
  if (s.includes(".")) s = s.split(".")[0];
  return s;
}

function buildInsertStatement(env, rows) {
  const placeholders = rows.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const sql = `INSERT INTO students (id, name, grade, class, phone) VALUES ${placeholders}`;
  const params = [];
  for (const r of rows) {
    params.push(r.id, r.name, r.grade, r.class, r.phone || null);
  }
  return env.DB.prepare(sql).bind(...params);
}

export async function onRequestPost(context) {
  const token = await requireAdmin(context);
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const { mode, grade, rows } = body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({ error: "no_rows" }, 400);
  }
  if (mode !== "replace_all" && mode !== "replace_grade") {
    return jsonResponse({ error: "invalid_mode" }, 400);
  }
  if (mode === "replace_grade" && !grade) {
    return jsonResponse({ error: "missing_grade" }, 400);
  }

  const cleanRows = [];
  for (const r of rows) {
    if (!r || !r.id || !r.name || !r.grade || !r.class) continue;
    const rowGrade = sanitizeText(r.grade);
    if (mode === "replace_grade" && rowGrade !== sanitizeText(grade)) continue;
    const id = sanitizeIdLike(r.id);
    const klass = sanitizeIdLike(r.class);
    if (!id || !klass) continue;
    cleanRows.push({
      id,
      name: sanitizeText(r.name),
      grade: rowGrade,
      class: klass,
      phone: r.phone ? sanitizeIdLike(r.phone) : null,
    });
  }

  if (cleanRows.length === 0) {
    return jsonResponse({ error: "no_valid_rows" }, 400);
  }

  const statements = [];
  if (mode === "replace_all") {
    statements.push(context.env.DB.prepare("DELETE FROM students"));
  } else {
    statements.push(context.env.DB.prepare("DELETE FROM students WHERE grade = ?").bind(sanitizeText(grade)));
  }

  for (let i = 0; i < cleanRows.length; i += CHUNK_SIZE) {
    statements.push(buildInsertStatement(context.env, cleanRows.slice(i, i + CHUNK_SIZE)));
  }

  try {
    await context.env.DB.batch(statements);
  } catch (err) {
    return jsonResponse({ error: "db_error", message: err.message }, 500);
  }

  await logActivity(
    context.env,
    "import",
    `mode=${mode} grade=${grade || "*"} rows=${cleanRows.length}`,
    clientIp(context.request)
  );

  return jsonResponse({ ok: true, imported: cleanRows.length, skipped: rows.length - cleanRows.length });
}
