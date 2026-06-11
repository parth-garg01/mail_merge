class TemplateEngine {
  merge(template, fields) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return fields[key] !== undefined ? String(fields[key]) : ''
    })
  }

  validate(template, headers) {
    const placeholders = this.extractPlaceholders(template)
    const unmatched = placeholders.filter(p => !headers.includes(p))
    return {
      valid: unmatched.length === 0,
      unmatched,
      placeholders
    }
  }

  extractPlaceholders(template) {
    const seen = new Set()
    const regex = /\{\{(\w+)\}\}/g
    let match
    while ((match = regex.exec(template)) !== null) {
      seen.add(match[1])
    }
    return [...seen]
  }
}

module.exports = new TemplateEngine()
