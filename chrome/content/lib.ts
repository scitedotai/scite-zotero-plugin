import { IZotero } from '../../typings/global';
import { CScite } from '../../client/chrome/content/scite';

declare const Zotero: IZotero;

Zotero.debug('Scite Plugin loaded from lib.ts');

Zotero.Scite = new CScite;

// Zotero.Scite = new class {
//   log(msg: string) {
//     Zotero.debug(`Scite Plugin Zotero (V7): ${msg}`);
//   }

//   foo() {
//     // `window` is the global object in Zotero 6 overlay scope, and global properties
//     // are included automatically in Zotero 7
//     const host = new URL('https://foo.com/path').host;
//     this.log(`Host is ${host}`);

//     this.log(`Intensity is ${Zotero.Prefs.get('extensions.scite-zotero-plugin.intensity', true)}`);
//   }

//   toggleGreen(enabled: boolean) {
//     const docElem = Zotero.getMainWindow().document.documentElement;
//     // Element#toggleAttribute() is not supported in Zotero 6
//     if (enabled) {
//       docElem.setAttribute('data-green-instead', 'true');
//     } else {
//       docElem.removeAttribute('data-green-instead');
//     }
//   }
// }

