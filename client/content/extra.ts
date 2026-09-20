import { getDOI, getField } from './util'

export interface CitationMetrics {
  doi: string
  supporting: number
  contradicting: number
  mentioning: number
  unclassified: number
  total: number
  citingPublications: number
}

const metricFields = {
  supporting: 'Scite Supporting Citations',
  contradicting: 'Scite Contrasting Citations',
  mentioning: 'Scite Mentioning Citations',
  unclassified: 'Scite Unclassified Citations',
  total: 'Scite Total Smart Citations',
  citingPublications: 'Scite Citing Publications',
}

export function normalizeDOI(doi: string): string {
  return doi.trim().replace(/^doi:\s*|^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase()
}

export function itemDOI(item): string {
  return normalizeDOI(getDOI(getField(item, 'DOI'), getField(item, 'extra')))
}

export function canSaveMetrics(item): boolean {
  return Boolean(item?.id && item.isRegularItem() && !item.deleted
    && item.library.editable && item.library.libraryType !== 'feed'
    && item.isEditable() && itemDOI(item))
}

export function parseMetrics(data: unknown, doi: string): CitationMetrics {
  const metrics = data as CitationMetrics
  if (!metrics || typeof metrics.doi !== 'string' || normalizeDOI(metrics.doi) !== doi
    || !Object.keys(metricFields).every(field => Number.isSafeInteger(metrics[field]) && metrics[field] >= 0)) {
    throw new Error('Scite did not return complete citation metrics for this DOI.')
  }
  return { ...metrics, doi }
}

// Only the exact named fields inside a single [scite] block are managed by us.
// Keep other text, including similarly named fields outside the block, unchanged.
export function updateExtra(extra: string, metrics: CitationMetrics, retrieved: string): string {
  const values = new Map<string, string | number>([
    [ 'Scite DOI', metrics.doi ],
    ...Object.entries(metricFields).map(([ field, label ]): [string, number] => [ label, metrics[field] ]),
    [ 'Scite Retrieved', retrieved ],
  ])
  const markers = extra.match(/^\[\/?scite\]\r?$/gm) || []
  const block = /^\[scite\](\r?\n)([\s\S]*?)^\[\/scite\](?=\r?$)/m.exec(extra)
  if (markers.length && (markers.length !== 2 || !block)) {
    throw new Error('Extra contains incomplete or multiple [scite] blocks. Please repair them before saving.')
  }

  const newline = block?.[1] || (extra.includes('\r\n') ? '\r\n' : '\n')
  const pending = new Map(values)
  const contents = (block?.[2] || '').replace(/^([^:\r\n]+):[^\r\n]*(\r?\n|$)/gm, (line, key, ending) => {
    if (!values.has(key)) return line
    if (!pending.has(key)) return ''
    pending.delete(key)
    return `${key}: ${values.get(key)}${ending}`
  }) + Array.from(pending, ([ key, value ]) => `${key}: ${value}${newline}`).join('')
  const replacement = `[scite]${newline}${contents}[/scite]`
  if (block) {
    return extra.slice(0, block.index) + replacement + extra.slice(block.index + block[0].length)
  }
  return extra + (extra && !extra.endsWith('\n') ? newline : '') + replacement
}
