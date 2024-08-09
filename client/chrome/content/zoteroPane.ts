import { IZotero } from '../../../typings/global';

declare const Zotero: IZotero;

import { patch as $patch$ } from './monkey-patch';
import { PLUGIN_ENABLED } from './config';

class SciteZoteroPane {
  private selectedItem: any;

  public async load() {
    if (!PLUGIN_ENABLED) {
      return;
    }

    document.getElementById('zotero-itemmenu')?.addEventListener('popupshowing', this.handleEvent.bind(this), false);

    await Zotero.Scite.start();
  }

  public async unload() {
    document.getElementById('zotero-itemmenu')?.removeEventListener('popupshowing', this.handleEvent.bind(this), false);
  }

  public handleEvent(event: Event) {
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    this.selectedItem = selectedItems.length ? selectedItems[0] : null;

    if (selectedItems.length !== 1 || !this.selectedItem || !this.selectedItem.isRegularItem() || !this.selectedItem.getField('DOI')) {
      this.selectedItem = null;
    }

    // eslint-disable-next-line
    document.getElementById('menu-scite-get-link')!.hidden = !this.selectedItem;
  }

  public run(method: string, ...args: any[]) {
    (this as any)[method].apply(this, args).catch((err: Error) => Zotero.logError(`${method}: ${err}`));
  }

  public async getTalliesForDOI() {
    const doi = this.selectedItem ? this.selectedItem.getField('DOI') : '';
    if (!doi) {
      alert('No DOI');
      return;
    }

    await Zotero.Scite.refreshTallies(doi);
  }

  public async viewSciteReport() {
    const doi = this.selectedItem ? this.selectedItem.getField('DOI') : '';
    if (!doi) {
      alert('No DOI');
      return;
    }

    await Zotero.Scite.viewSciteReport(doi);
  }
}

const sciteZoteroPane = new SciteZoteroPane();

if (PLUGIN_ENABLED) {
  // Monkey patch because of https://groups.google.com/forum/#!topic/zotero-dev/zy2fSO1b0aQ
  // eslint-disable-next-line
  $patch$(Zotero.getActiveZoteroPane(), 'serializePersist', (original: Function) => function(this: any) {
    original.apply(this, arguments);

    let persisted;
    if (Zotero.Scite.uninstalled && (persisted = Zotero.Prefs.get('pane.persist'))) {
      persisted = JSON.parse(persisted);
      delete persisted['zotero-items-column-supporting'];
      delete persisted['zotero-items-column-mentioning'];
      delete persisted['zotero-items-column-contrasting'];
      delete persisted['zotero-items-column-total'];
      delete persisted['zotero-items-column-citingPublications'];
      Zotero.Prefs.set('pane.persist', JSON.stringify(persisted));
    }
  });

  window.addEventListener('load', event => {
    sciteZoteroPane.load().catch(err => Zotero.logError(err));
  }, false);

  window.addEventListener('unload', event => {
    sciteZoteroPane.unload().catch(err => Zotero.logError(err));
  }, false);
}

export default sciteZoteroPane;
