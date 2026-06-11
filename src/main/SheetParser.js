const XLSX = require('xlsx')
const path = require('path')

class SheetParser {
  parse(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const workbook = XLSX.readFile(filePath, { cellText: true, cellDates: false })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet['!ref']) throw new Error('The sheet appears to be empty.')

    const range = XLSX.utils.decode_range(worksheet['!ref'])

    // Extract headers from first row
    const headers = []
    for (let col = range.s.c; col <= range.e.c; col++) {
      const addr = XLSX.utils.encode_cell({ r: range.s.r, c: col })
      const cell = worksheet[addr]
      const header = cell ? String(cell.v).trim() : `Column${col + 1}`
      headers.push(header)
    }

    // Extract data rows
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
    const dataRows = rawRows
      .slice(1)
      .map((row, idx) => {
        const record = { _rowIndex: idx + 1 }
        headers.forEach((header, colIdx) => {
          record[header] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : ''
        })
        return record
      })
      .filter(row => headers.some(h => row[h] !== ''))

    return { headers, rows: dataRows, sheetName }
  }

  validate(parsed, emailColumn) {
    const { headers, rows } = parsed
    const errors = []
    const warnings = []

    if (!headers.includes(emailColumn)) {
      errors.push(`Column "${emailColumn}" not found. Available: ${headers.join(', ')}`)
      return { valid: false, errors, warnings }
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    rows.forEach((row, idx) => {
      const email = row[emailColumn]
      if (!email) {
        warnings.push(`Row ${idx + 2}: missing email address (will be skipped)`)
      } else if (!emailPattern.test(email)) {
        errors.push(`Row ${idx + 2}: invalid email "${email}"`)
      }
    })

    return { valid: errors.length === 0, errors, warnings }
  }
}

module.exports = new SheetParser()
