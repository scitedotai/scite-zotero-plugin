/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */
declare const ChromeUtils: any;
declare const Cc: any;
declare const Ci: any;

var stylesheetID = 'scite-zotero-plugin-stylesheet';
var ftlID = 'scite-zotero-plugin-ftl';
var menuitemID = 'make-it-green-instead';
var addedElementIDs = [stylesheetID, ftlID, menuitemID];

if (typeof Zotero == 'undefined') {
  var Zotero
}

function log(msg) {
  msg = `[Scite Zotero] bootstrap: ${ msg }`
  Zotero.logError(msg)
}

// In Zotero 6, bootstrap methods are called before Zotero is initialized, and using include.js
// to get the Zotero XPCOM service would risk breaking Zotero startup. Instead, wait for the main
// Zotero window to open and get the Zotero object from there.
//
// In Zotero 7, bootstrap methods are not called until Zotero is initialized, and the 'Zotero' is
// automatically made available.
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
  await waitForZotero();
  log('Installed');
}

let chromeHandle
async function startup({ id, version, resourceURI, rootURI = resourceURI?.spec }) {
  try {
    await waitForZotero();
    log(`Root URI: ${rootURI}`);

    if (typeof Services == 'undefined') {
      var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
    }

    var aomStartup = Cc['@mozilla.org/addons/addon-manager-startup;1'].getService(Ci.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + 'client/manifest.json');

    // Register chrome resources
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ['content', 'scite-zotero-plugin', rootURI + 'chrome/content/'],
      ['locale', 'scite-zotero-plugin', 'en-US', rootURI + 'chrome/locale/en-US/'],
    ]);

    Services.scriptloader.loadSubScript(`${rootURI}chrome/content/lib.js`);
    log('Starting zotero scite');
    Zotero.Scite.start(rootURI).catch(err => Zotero.logError(err));
    log('Started!');
  } catch (err) {
    Zotero.logError('[Scite Zotero] Boo, error during startup')
    Zotero.logError(err)
  }
}

function shutdown() {
  log('Shutting down');

  // Remove stylesheet
  var zp = Zotero.getActiveZoteroPane();
  if (zp) {
    for (const id of addedElementIDs) {
      zp.document.getElementById(id)?.remove();
    }
  }

  Zotero.Scite.unload().catch(err => Zotero.logError(err));

  // Deregister chrome
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }

  Zotero.Scite = undefined;
}

function uninstall() {
  log('Uninstalled');
}

export { install, startup, shutdown, uninstall };
