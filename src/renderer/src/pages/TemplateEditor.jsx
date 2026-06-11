import React, { useState, useEffect } from 'react'
import { useApp } from '../App'

export default function TemplateEditor() {
  const { wizard, updateWizard, navigate } = useApp()
  const [previewRow, setPreviewRow] = useState(0)
  const [preview, setPreview] = useState({ subject: '', body: '' })
  const [validation, setValidation] = useState(null)
  const [previewMode, setPreviewMode] = useState('html')

  const { sheetData, subjectTemplate, bodyTemplate } = wizard
  const headers = sheetData?.headers || []
  const rows = sheetData?.rows || []

  useEffect(() => {
    if (!subjectTemplate && !bodyTemplate) return
    loadPreview()
  }, [subjectTemplate, bodyTemplate, previewRow])

  async function loadPreview() {
    if (!rows.length) return
    const row = rows[previewRow] || rows[0]
    const result = await window.api?.template.preview({
      subjectTemplate,
      bodyTemplate,
      row
    })
    if (result) setPreview(result)
  }

  async function validateAndNext() {
    if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
      setValidation({ error: 'Subject and body cannot be empty.' })
      return
    }
    const result = await window.api?.template.validate({
      subjectTemplate,
      bodyTemplate,
      headers
    })
    setValidation(result)
    const ok = result.subject.valid && result.body.valid
    if (ok) navigate('schedule')
  }

  function insertField(field) {
    const tag = `{{${field}}}`
    // Always append to body for simplicity
    updateWizard({ bodyTemplate: bodyTemplate + tag })
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <span onClick={() => navigate('import')} className="text-slate-400 hover:text-indigo-400 cursor-pointer">Step 1</span>
          <span>→</span><span className="text-indigo-400 font-medium">Step 2</span>
          <span>→</span><span>Step 3</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Template Editor</h1>
        <p className="text-slate-400 text-sm mt-1">Write your email with personalized merge fields</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-5">
          {/* Subject */}
          <div>
            <label className="label">Subject Line</label>
            <input
              type="text"
              value={subjectTemplate}
              onChange={e => updateWizard({ subjectTemplate: e.target.value })}
              placeholder="e.g. Collaboration Request — {{college}}"
              className="input-field"
            />
            {validation?.subject?.unmatched?.length > 0 && (
              <p className="mt-1 text-xs text-red-400">Unknown fields: {validation.subject.unmatched.join(', ')}</p>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="label">Email Body</label>
            <textarea
              value={bodyTemplate}
              onChange={e => updateWizard({ bodyTemplate: e.target.value })}
              placeholder={`Dear {{first_name}},\n\nI came across your work on {{custom_line}} and wanted to reach out…`}
              rows={14}
              className="input-field font-mono text-xs leading-relaxed resize-none"
            />
            {validation?.body?.unmatched?.length > 0 && (
              <p className="mt-1 text-xs text-red-400">Unknown fields: {validation.body.unmatched.join(', ')}</p>
            )}
            {validation?.error && (
              <p className="mt-1 text-xs text-red-400">{validation.error}</p>
            )}
          </div>

          {/* Merge field chips */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Click a field to insert into body:</p>
            <div className="flex flex-wrap gap-1.5">
              {headers.map(h => (
                <button
                  key={h}
                  onClick={() => insertField(h)}
                  className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-700/50 text-indigo-300 rounded text-xs font-mono hover:bg-indigo-800/50 transition-colors"
                >
                  {`{{${h}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Nav */}
          <div className="flex gap-3">
            <button onClick={() => navigate('import')} className="btn-secondary">← Back</button>
            <button onClick={validateAndNext} className="btn-primary flex-1">Next: Schedule →</button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Live Preview</label>
              <div className="flex items-center gap-2">
                {rows.length > 1 && (
                  <select
                    value={previewRow}
                    onChange={e => setPreviewRow(Number(e.target.value))}
                    className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1"
                  >
                    {rows.slice(0, 10).map((_, i) => (
                      <option key={i} value={i}>Row {i + 1}</option>
                    ))}
                  </select>
                )}
                <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
                  <button
                    onClick={() => setPreviewMode('html')}
                    className={`px-3 py-1 ${previewMode === 'html' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setPreviewMode('raw')}
                    className={`px-3 py-1 ${previewMode === 'raw' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    Raw
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl overflow-hidden shadow-lg">
              {/* Email chrome */}
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                <p className="text-xs text-gray-500">Subject:</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{preview.subject || 'Your subject will appear here'}</p>
              </div>
              <div className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                {previewMode === 'html' ? (
                  <div
                    className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: preview.body || '<span style="color:#9ca3af">Your email body will appear here…</span>' }}
                  />
                ) : (
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{preview.body}</pre>
                )}
              </div>
            </div>

            {rows.length > 0 && rows[previewRow] && (
              <div className="mt-3 p-3 bg-slate-800 border border-slate-700 rounded-lg">
                <p className="text-xs text-slate-500 mb-2">Merged values for Row {previewRow + 1}:</p>
                <div className="space-y-1">
                  {headers.map(h => (
                    <div key={h} className="flex items-center gap-2 text-xs">
                      <span className="text-indigo-400 font-mono w-28 shrink-0">{`{{${h}}}`}</span>
                      <span className="text-slate-300 truncate">{rows[previewRow][h] || <em className="text-slate-600">empty</em>}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
