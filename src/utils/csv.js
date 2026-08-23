// Minimal RFC-4180 CSV parser: handles quoted fields, "" escapes, commas and
// newlines inside quotes, CRLF/LF line endings, and a leading UTF-8 BOM.
// Returns an array of rows, each an array of string cells. Blank lines dropped.
export function parseCsv(text) {
  const out = []
  let row = []
  let cell = ''
  let inQuotes = false
  const s = String(text).replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((v) => v !== '')) out.push(row)
      row = []
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    if (row.some((v) => v !== '')) out.push(row)
  }
  return out
}

// Parse an exported submissions CSV into import rows { articleLink, username }.
// Maps columns by header name: "Article URL" (or "Article") -> link, "By" ->
// submitter. Throws a descriptive Error if the shape is wrong.
export function parseSubmissionsCsv(text) {
  const table = parseCsv(text)
  if (table.length < 2) throw new Error('The file has no data rows.')
  const header = table[0].map((h) => h.trim().toLowerCase())
  const linkIdx = header.indexOf('article url')
  const titleIdx = header.indexOf('article')
  const byIdx = header.indexOf('by')
  if ((linkIdx === -1 && titleIdx === -1) || byIdx === -1)
    throw new Error(
      'Expected columns "Article URL" (or "Article") and "By". This should be a file exported from a contest.',
    )
  const rows = table
    .slice(1)
    .map((r) => ({
      articleLink: (r[linkIdx] ?? r[titleIdx] ?? '').trim(),
      username: (r[byIdx] ?? '').trim(),
    }))
    .filter((r) => r.articleLink && r.username)
  if (rows.length === 0)
    throw new Error('No rows with both an article and a submitter were found.')
  return rows
}
