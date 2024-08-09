import { CScite } from '../client/chrome/content/scite'

export interface IZotero {
  Scite: CScite

  debug(msg: string)
  logError(err: Error | string)

  getActiveZoteroPane(): any

  Notifier: {
    trigger(event: string, type: string, itemIDs: number[])
    registerObserver(onserver: any, types: string[], id: string, priority?: number) // any => ZoteroObserver
    unregisterObserver(id: number)
  }

  Prefs: {
    get(pref: string)
    set(pref: string, value: string | number | boolean)
  }

  Items: {
    getAsync(ids: number | number[]): Promise<any | any[]>
  }

  DB: {
    queryAsync(query: string): Promise<any[]>
  }

  HTTP: {
    request(method: string, url: string, options?: {
      body?: string,
      responseType?: string,
      headers?: Record<string, string>,
    }): Promise<any>
  }

  Schema: {
    schemaUpdatePromise: Promise<boolean>
  }

  Promise: {
    new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): Promise<T>;
    resolve<T>(value: T | PromiseLike<T>): Promise<T>;
    reject(reason?: any): Promise<never>;
    all<T>(values: Iterable<T | PromiseLike<T>>): Promise<T[]>;
    race<T>(values: Iterable<T | PromiseLike<T>>): Promise<T>;
    defer<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: any) => void };
  }

  /**
   * NOTE (Ashish):
   *    ItemTreeView is removed after Zotero 6
   *    but we include it in the typing and check within
   *      content/scite.ts if it is undefined to handle patching properly.
   */
  ItemTreeView: {
    new (): {}
    getCellText(row: number, col: number)
  }

  Item: {
    new (): {}
    getField(field: string, unformatted: boolean, includeBaseMapped: boolean): string
  }
}

