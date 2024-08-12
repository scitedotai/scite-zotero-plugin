import { IZotero } from '../typings/global';

declare const Zotero: IZotero

export function debug(...msg) {
  const str = `scite: ${msg.map(s => s.toString()).join(' ')}`
  // console.error(str) // tslint:disable-line:no-console
  Zotero.debug(str)
}
