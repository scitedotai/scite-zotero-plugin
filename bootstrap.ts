/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */

declare const ChromeUtils: any;
declare const Components: any
declare const dump: (msg: string) => void

var stylesheetID = 'scite-zotero-plugin-stylesheet';
var ftlID = 'scite-zotero-plugin-ftl';
var menuitemID = 'make-it-green-instead';
var addedElementIDs = [stylesheetID, ftlID, menuitemID];

if (typeof Zotero == 'undefined') {
  var Zotero
}

const {
  interfaces: Ci,
} = Components

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

async function startup({ id, version, resourceURI, rootURI = resourceURI?.spec }) {
  try {
    await waitForZotero();

    log('Starting');

    // Add DOM elements to the main Zotero pane
    var win = Zotero.getMainWindow();
    if (win && win.ZoteroPane) {
      const zp = win.ZoteroPane;
      const doc = win.document;

      // createElement() defaults to HTML in Zotero 7
      const link1 = doc.createElement('link');
      link1.id = stylesheetID;
      link1.type = 'text/css';
      link1.rel = 'stylesheet';
      link1.href = `${rootURI}style.css`;
      doc.documentElement.appendChild(link1);

      // We're running in Zotero 7, so use our Fluent localizations
      const link2 = doc.createElement('link');
      link2.id = ftlID;
      link2.rel = 'localization';
      link2.href = 'scite-zotero-plugin.ftl';
      doc.documentElement.appendChild(link2);

      // createXULElement() is available in Zotero 7
      const menuitem = doc.createXULElement('menuitem');
      menuitem.id = menuitemID;
      menuitem.setAttribute('type', 'checkbox');
      menuitem.setAttribute('data-l10n-id', 'make-it-green-instead');
      menuitem.addEventListener('command', () => {
        Zotero.Scite.toggleGreen(menuitem.getAttribute('checked') === 'true');
      });
      doc.getElementById('menu_viewPopup')?.appendChild(menuitem);
    }

    // 'Services' may not be available in Zotero 6
    if (typeof Services == 'undefined') {
      var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
    }
    // Load chrome/content file directly via file:/// URL
    log('Loading lib.js script')
    Services.scriptloader.loadSubScript(`${rootURI}chrome/content/lib.js`);
    log('Starting zotero scite');
    Zotero.Scite.start().catch(err => Zotero.logError(err));
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

  Zotero.Scite = undefined;
}

function uninstall() {
  log('Uninstalled');
}

export { install, startup, shutdown, uninstall };
