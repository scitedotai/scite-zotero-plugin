import { IZotero } from '../../typings/global';
import { CScite } from '../../client/chrome/content/scite';

declare const Zotero: IZotero;

Zotero.logError('Scite Plugin loaded from lib.ts');

Zotero.Scite = new CScite;
