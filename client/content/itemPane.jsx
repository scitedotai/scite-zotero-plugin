
import { fetchTalliesZotero7, getDOI } from './util';

export const sciteItemPaneZotero7 = {
    paneID: "scite-zotero-plugin-pane",
    pluginID: "scite-zotero-plugin@scite.ai",
    header: {
      l10nID: "scite-zotero-plugin-pane-header",
      icon: "skin/scite_logo_header_svg.svg",
    },
    sidenav: {
      l10nID: "scite-zotero-plugin-pane-sidenav",
      icon: "skin/scite_logo_sidenav_svg.svg",
    },
    bodyXHTML: `
    <div xmlns:html="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; gap: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="flex: 0 0 50%;"># Supporting</span>
            <span id="scite-plugin-item-pane-supporting-key" style="flex: 1; min-width: 0;"></span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="flex: 0 0 50%;"># Contrasting</span>
            <span id="scite-plugin-item-pane-contrasting-key" style="flex: 1; min-width: 0;"></span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="flex: 0 0 50%;"># Mentioning</span>
            <span id="scite-plugin-item-pane-mentioning-key" style="flex: 1; min-width: 0;"></span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="flex: 0 0 50%;"># Citing Publications</span>
            <span id="scite-plugin-item-pane-citingPublications-key" style="flex: 1; min-width: 0;"></span>
        </div>
        <div id="scite-plugin-item-pane-report-link-container" style="display: none;">
            <span id="scite-plugin-item-pane-report-link" style="cursor: pointer; color: #4a90e2; text-decoration: underline;">View full report →</span>
        </div>
    </div>
    `,
    onRender: ({ body, item }) => {
        const tallies = fetchTalliesZotero7(item)
        if (!tallies) {
            body.textContent = "No tallies loaded"
        } else {
            const doi = getDOI(item.getField('DOI'), item.getField('extra'));

            const fields = ['supporting', 'contrasting', 'mentioning', 'citingPublications'];
            fields.forEach(field => {
                const spanElement = body.querySelector(`#scite-plugin-item-pane-${field}-key`);
                if (spanElement) {
                    spanElement.textContent = tallies[field]?.toLocaleString() || '-';
                    spanElement.dataset.itemid = item ? `${item.id}-${field}-${tallies[field]}` : '';
                }
            });

            // Handle the report link
            const linkContainer = body.querySelector('#scite-plugin-item-pane-report-link-container');
            const linkElement = body.querySelector('#scite-plugin-item-pane-report-link');
            if (doi && linkContainer && linkElement) {
                linkContainer.style.display = 'block';
                linkElement.onclick = (event) => {
                    event.preventDefault();
                    const url = `https://scite.ai/reports/${encodeURIComponent(doi)}?utm_source=zotero&utm_medium=scite-zotero-plugin&utm_campaign=scite`;
                    Zotero.launchURL(url);
                };
            } else if (linkContainer) {
                linkContainer.style.display = 'none';
            }
        }
    }
  }
