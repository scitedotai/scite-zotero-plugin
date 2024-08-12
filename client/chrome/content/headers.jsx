const React = require('react');
const { string } = require('prop-types');
import { getDOI } from './util';

const SciteColumnHeading = (props) => {
	props = Object.assign({}, props);
	return <span><img src={props.iconPath} height='10px' width='9px' style={{'margin-left': '6px'}} /> {props.name}</span>;
};

SciteColumnHeading.propTypes = {
	iconPath: string,
	name: string.isRequired,
}


export const sciteColumns = [
    {
        dataKey: 'zotero-items-column-supporting',
        label: 'Supporting',
        iconLabel: <SciteColumnHeading iconPath={'chrome://zotero-scite/skin/supporting.png'} name={'Supporting'} />,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
    },
    {
        dataKey: 'zotero-items-column-contrasting',
        label: 'Contrasting',
        iconLabel: <SciteColumnHeading iconPath={'chrome://zotero-scite/skin/contrasting.png'} name={'Contrasting'} />,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
    },
    {
        dataKey: 'zotero-items-column-mentioning',
        label: 'Mentioning',
        iconLabel: <SciteColumnHeading iconPath={'chrome://zotero-scite/skin/mentioning.png'} name={'Mentioning'} />,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
    },
    {
        dataKey: 'zotero-items-column-total',
        label: 'Total Smart Citations',
        iconLabel: <SciteColumnHeading iconPath={''} name={'Total Smart Citations'} />,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
    },
    {
        dataKey: 'zotero-items-column-citingPublications',
        label: 'Total Distinct Citing Publications',
        iconLabel: <SciteColumnHeading iconPath={'chrome://zotero-scite/skin/total_publications.png'} name={'Total Distinct Citing Publications'} />,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
    }
]

const fetchTallyDataZotero7 = (item, dataKey) => {
    try {
        const sciteTallyFieldName = dataKey.includes('zotero-items') ? dataKey.split('-').slice(-1)[0] : field
        if (Zotero.Scite.ready.isPending()) return '-' // tslint:disable-line:no-use-before-declare
        const doi = getDOI(item.getField('DOI'), item.getField('extra'))
        if (!doi || !Zotero.Scite.tallies[doi]) return 0
        const tallies = Zotero.Scite.tallies[doi]
        return tallies[sciteTallyFieldName]
      } catch (err) {
        Zotero.logError(`Error loading supporting tally: ${err}`)
        return 0
      }
}

export const sciteColumnsZotero7 = [
    {
        dataKey: 'zotero-items-column-supporting',
        label: 'Supporting',
        pluginID: 'scite-zotero-plugin@gmail.com',
        // iconPath: 'chrome://scite-zotero-plugin/skin/supporting.png',
        iconPath: `${ rootURI }content/skin/supporting.png`,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-contrasting',
        label: 'Contrasting',
        pluginID: 'scite-zotero-plugin@gmail.com',
        // iconPath: 'chrome://scite-zotero-plugin/skin/contrasting.png',
        iconPath: `${ rootURI }content/skin/contrasting.png`,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-mentioning',
        label: 'Mentioning',
        pluginID: 'scite-zotero-plugin@gmail.com',
        // iconPath: 'chrome://scite-zotero-plugin/skin/mentioning.png',
        iconPath: `${ rootURI }content/skin/mentioning.png`,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-total',
        label: 'Total Smart Citations',
        pluginID: 'scite-zotero-plugin@gmail.com',
        iconPath: '',
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-citingPublications',
        label: 'Total Distinct Citing Publications',
        pluginID: 'scite-zotero-plugin@gmail.com',
        // iconPath: 'chrome://scite-zotero-plugin/skin/total_publications.png',
        iconPath: `${ rootURI }content/skin/total_publications.png`,
        flex: '1',
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }

    }
]
