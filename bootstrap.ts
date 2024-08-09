/* eslint-disable prefer-arrow/prefer-arrow-functions, no-var, @typescript-eslint/no-unused-vars, no-caller, @typescript-eslint/explicit-module-boundary-types */

declare const ChromeUtils: any;

var stylesheetID = 'scite-zotero-plugin-stylesheet';
var ftlID = 'scite-zotero-plugin-ftl';
var menuitemID = 'make-it-green-instead';
var addedElementIDs = [stylesheetID, ftlID, menuitemID];

if (typeof Zotero == 'undefined') {
  var Zotero
}

function log(msg: string) {
  Zotero.debug(`Scite Plugin Zotero (V7): ${msg}`);
}

async function waitForZotero() {
  if (typeof Zotero !== 'undefined' && Zotero.initializationPromise) {
    await Zotero.initializationPromise;
  } else {
    await new Promise<void>(resolve => {
      const intervalID = setInterval(() => {
        if (typeof Zotero !== 'undefined') {
          clearInterval(intervalID);
          resolve();
        }
      }, 100);
    });
  }
}

async function install() {
  await waitForZotero();
  log('Installed');
}

async function startup({ id, version, resourceURI, rootURI = resourceURI?.spec }) {
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
  Services.scriptloader.loadSubScript(`${rootURI}chrome/content/lib.js`);
  Zotero.Scite.load().catch(err => Zotero.logError(err));
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
