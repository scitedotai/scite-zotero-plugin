/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */
declare const ChromeUtils: any
declare const Cc: any
declare const Ci: any
declare const Services: any
declare function dump(msg: string): void

// Log immediately when file is loaded
dump('[Scite Zotero] bootstrap.js file loaded!\n')

if (typeof Zotero == 'undefined') {
  var Zotero
}

function log(msg) {
  msg = `[Scite Zotero] bootstrap: ${msg}`
  dump(msg + '\n')
  if (typeof Zotero !== 'undefined' && Zotero.logError) {
    Zotero.logError(msg)
  }
}

export function onMainWindowLoad({ window }) {
  log('onMainWindowLoad')
  window.MozXULElement.insertFTLIfNeeded('scite-zotero-plugin.ftl')
}

async function waitForZotero() {
  if (typeof Zotero != 'undefined') {
    await Zotero.initializationPromise
    return
  }

  // Services should be available globally in Zotero 7+
  var windows = Services.wm.getEnumerator('navigator:browser')
  var found = false
  while (windows.hasMoreElements()) {
    const win = windows.getNext()
    if (win.Zotero) {
      Zotero = win.Zotero
      found = true
      break
    }
  }
  if (!found) {
    await new Promise(resolve => {
      var listener = {
        onOpenWindow(aWindow) {
          // Wait for the window to finish loading
          const domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow)
          domWindow.addEventListener('load', function() {
            domWindow.removeEventListener('load', arguments.callee, false)
            if (domWindow.Zotero) {
              Services.wm.removeListener(listener)
              Zotero = domWindow.Zotero
              resolve(undefined)
            }
          }, false)
        },
      }
      Services.wm.addListener(listener)
    })
  }
  await Zotero.initializationPromise
}

async function install() {
  await waitForZotero()
  log('Installed Scite Plugin')
}

let chromeHandle
async function startup({ id, version, resourceURI, rootURI = resourceURI?.spec }) {
  dump(`[Scite Zotero] startup called, rootURI: ${rootURI}\n`)
  try {
    dump('[Scite Zotero] Waiting for Zotero...\n')
    await waitForZotero()

    Zotero.debug('[Scite Zotero] Zotero ready, starting plugin...')

    Zotero.debug('[Scite Zotero] Getting addon manager startup...')
    var aomStartup = Cc['@mozilla.org/addons/addon-manager-startup;1'].getService(Ci.amIAddonManagerStartup)
    var manifestURI = Services.io.newURI(rootURI + 'client/manifest.json')

    Zotero.debug('[Scite Zotero] Registering chrome...')
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      [ 'content', 'scite-zotero-plugin', rootURI + 'content/' ],
      [ 'locale', 'scite-zotero-plugin', 'en-US', rootURI + 'locale/en-US/' ],
    ])

    Zotero.debug(`[Scite Zotero] Loading lib.js from ${rootURI}lib.js`)
    Services.scriptloader.loadSubScript(`${rootURI}lib.js`)
    Zotero.debug('[Scite Zotero] lib.js loaded, starting Scite...')

    if (!Zotero.Scite) {
      Zotero.debug('[Scite Zotero] ERROR: Zotero.Scite is not defined after loading lib.js!')
      return
    }

    await Zotero.Scite.start(rootURI)
    Zotero.debug('[Scite Zotero] Started successfully!')

    const $window = Zotero.getMainWindow()
    onMainWindowLoad({ window: $window })
  }
  catch (err) {
    dump(`[Scite Zotero] Error during startup: ${err}\n`)
    if (typeof Zotero !== 'undefined') {
      Zotero.debug(`[Scite Zotero] Error during startup: ${err}`)
      if (Zotero.logError) {
        Zotero.logError('[Scite Zotero] Error during startup')
        Zotero.logError(err)
      }
    }
  }
}

function shutdown() {
  log('Shutting down')

  if (typeof Zotero !== 'undefined' && Zotero.Scite) {
    if (typeof Zotero.Scite.unload === 'function') {
      Zotero.Scite.unload().catch(err => {
        if (Zotero.logError) Zotero.logError(err)
      })
    }
    Zotero.Scite = undefined
  }

  if (chromeHandle) {
    chromeHandle.destruct()
    chromeHandle = null
  }
}

function uninstall() {
  log('Uninstalled')
}

export { install, startup, shutdown, uninstall }
