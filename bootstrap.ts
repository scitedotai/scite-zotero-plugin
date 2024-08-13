/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */
declare const ChromeUtils: any
declare const Cc: any
declare const Ci: any

if (typeof Zotero == 'undefined') {
  var Zotero
}

function log(msg) {
  msg = `[Scite Zotero] bootstrap: ${msg}`
  Zotero.logError(msg)
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

  // eslint-disable-next-line @typescript-eslint/no-shadow
  var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm')
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
  try {
    await waitForZotero()
    if (typeof Services == 'undefined') {
      var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm')
    }

    var aomStartup = Cc['@mozilla.org/addons/addon-manager-startup;1'].getService(Ci.amIAddonManagerStartup)
    var manifestURI = Services.io.newURI(rootURI + 'client/manifest.json')

    // Register chrome resources
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      [ 'content', 'scite-zotero-plugin', rootURI + 'content/' ],
      [ 'locale', 'scite-zotero-plugin', 'en-US', rootURI + 'locale/en-US/' ],
    ])

    Services.scriptloader.loadSubScript(`${rootURI}lib.js`)
    Zotero.Scite.start(rootURI).catch(err => Zotero.logError(err))
    log('Started Zotero Scite')
    const $window = Zotero.getMainWindow()
    onMainWindowLoad({ window: $window })
  }
  catch (err) {
    Zotero.logError('[Scite Zotero] Error during startup')
    Zotero.logError(err)
  }
}

function shutdown() {
  log('Shutting down')

  // Remove stylesheet
  var zp = Zotero.getActiveZoteroPane()

  Zotero.Scite.unload().catch(err => Zotero.logError(err))

  // Deregister chrome
  if (chromeHandle) {
    chromeHandle.destruct()
    chromeHandle = null
  }

  Zotero.Scite = undefined
}

function uninstall() {
  log('Uninstalled')
}

export { install, startup, shutdown, uninstall }
