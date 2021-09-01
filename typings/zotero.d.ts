import { CScite } from '../content/scite'

declare global {
  interface IZotero {
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
      async getAsync(ids: number | number[]): any | any[]
    }

    DB: {
      async queryAsync(query: string): any[]
    }

    HTTP: {
      async request(method: string, url: string, options?: {
        body?: string,
        responseType?: string,
        headers?: Record<string, string>,
      })
    }

    Schema: {
      schemaUpdatePromise: Promise<boolean>
    }

    Promise: Promise

    /**
     * NOTE (Ashish):
     *    ItemTreeView is removed after Zotero 6
     *    but we include it in the typing and check within
     *      content/scite.ts if it is undefined to handle patching properly.
     */
    static ItemTreeView: {
      new (): {}
      getCellText(row: number, col: number)
    }

    static Item: {
      new (): {}
      getField(field: string, unformatted: boolean, includeBaseMapped: boolean): string
    }
  }
}
