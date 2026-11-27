const spreadsheetControl = /^[\t\r\n]|^\s*[=+@＝＋＠－-]/u;

export function encodeCsv(rows) {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const safe = typeof value === 'string' && spreadsheetControl.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n');
}
