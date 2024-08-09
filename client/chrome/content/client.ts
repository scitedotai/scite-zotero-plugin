declare const Zotero: any
declare const location: any

export const worker = typeof location !== 'undefined' && location.search
export const isZotero7 = worker ? ((new URLSearchParams(location.search)).get('isZotero7') === 'true') : Zotero.platformMajorVersion >= 102
