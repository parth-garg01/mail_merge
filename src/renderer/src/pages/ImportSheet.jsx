import React, { useState, useCallback } from 'react'
import { useApp } from '../App'

export default function ImportSheet() {
  const { wizard, updateWizard, navigate } = useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationResult, setValidationResult] = useState(null)

  async function openFile() {
    setError('')
    setValidationResult(null)
    const filePath = await window.api?.sheet.openDialog()
    if (!filePath) return

    setLoading(true)
    const result = await window.api?.sheet.parse(filePath)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    updateWizard({
      sheetPath: filePath,
      sheetData: result.data,
      emailColumn: result.data.headers.find(h => h.toLowerCase().includes('email')) || result.data.headers[0] || ''
    })
  }

  async function handleEmailColumnChange(col) {
    updateWizard({ emailColumn: col })
    setValidationResult(null)
  }

  async function validateAndNext() {
    if (!wizard.sheetData || !wizard.emailColumn) return
    const result = await window.api?.sheet.validate({
      parsedData: wizard.sheetData,
      emailColumn: wizard.emailColumn
    })
    setValidationResult(result)
    if (result.valid) navigate('template')
  }

  const { sheetData, emailColumn, sheetPath } = wizard
  const previewRows = sheetData?.rows?.slice(0, 5) || []
  const headers = sheetData?.headers || []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <span className="text-indigo-400 font-medium">Step 1</span>
          <span>→</span><span>Step 2</span>
          <span>→</span><span>Step 3</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Import Spreadsheet</h1>
        <p className="text-slate-400 text-sm mt-1">Upload your Excel or CSV file with recipient data</p>
      </div>

      {/* Upload area */}
      {!sheetData ? (
        <div className="card flex flex-col items-center justify-center py-16 border-dashed cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-colors" onClick={openFile}>
          {loading ? (
            <div className="text-slate-400">Parsing file…</div>
          ) : (
            <>
              <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-slate-400">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-slate-300 font-medium">Click to select file</p>
              <p className="text-slate-500 text-sm mt-1">Supports .xlsx, .xls, .csv</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* File info */}
          <div className="card mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-900/50 rounded-lg flex items-center justify-center">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-slate-100 text-sm font-medium truncate max-w-sm">{sheetPath.split(/[\\/]/).pop()}</p>
                <p className="text-slate-500 text-xs">{sheetData.rows.length} rows · {headers.length} columns</p>
              </div>
            </div>
            <button onClick={() => { updateWizard({ sheetData: null, sheetPath: '' }); setValidationResult(null) }} className="text-sm text-slate-400 hover:text-slate-300">
              Change
            </button>
          </div>

          {/* Column mapping */}
          <div className="card mb-5">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Email Column</h3>
            <p className="text-slate-500 text-xs mb-3">Select which column contains the recipient email addresses.</p>
            <select
              value={emailColumn}
              onChange={e => handleEmailColumnChange(e.target.value)}
              className="input-field max-w-xs"
            >
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">Available merge fields (use in template as {'{{name}}'}):</p>
              <div className="flex flex-wrap gap-1.5">
                {headers.map(h => (
                  <span key={h} className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-700/50 text-indigo-300 rounded text-xs font-mono">
                    {`{{${h}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">{error}</div>
          )}

          {/* Validation warnings */}
          {validationResult && !validationResult.valid && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
              <p className="text-red-300 text-sm font-medium mb-2">Validation errors:</p>
              {validationResult.errors.map((e, i) => (
                <p key={i} className="text-red-400 text-xs">{e}</p>
              ))}
            </div>
          )}

          {validationResult?.warnings?.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
              <p className="text-yellow-300 text-sm font-medium mb-2">Warnings:</p>
              {validationResult.warnings.map((w, i) => (
                <p key={i} className="text-yellow-400 text-xs">{w}</p>
              ))}
            </div>
          )}

          {/* Preview table */}
          <div className="card p-0 overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-medium text-slate-300">Data Preview (first 5 rows)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    {headers.map(h => (
                      <th key={h} className={`text-left px-4 py-2 font-medium ${h === emailColumn ? 'text-indigo-400' : 'text-slate-400'} whitespace-nowrap`}>
                        {h === emailColumn ? '★ ' : ''}{h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-700/40 last:border-0">
                      {headers.map(h => (
                        <td key={h} className="px-4 py-2 text-slate-300 max-w-[200px] truncate">{row[h] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sheetData.rows.length > 5 && (
              <p className="px-4 py-2 text-slate-500 text-xs border-t border-slate-700">
                … and {sheetData.rows.length - 5} more rows
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <button onClick={validateAndNext} className="btn-primary">
              Next: Template Editor →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
