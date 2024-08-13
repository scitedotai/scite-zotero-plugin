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
        pluginID: 'scite-zotero-plugin@scite.ai',
        iconPath: 'skin/supporting.png',
        flex: 0,
        fixedWidth: false,
        staticWidth: false,
        minWidth: 0,
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-contrasting',
        label: 'Contrasting',
        pluginID: 'scite-zotero-plugin@scite.ai',
        iconPath: 'skin/contrasting.png',
        flex: 0,
        fixedWidth: false,
        staticWidth: false,
        minWidth: 0,
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-mentioning',
        label: 'Mentioning',
        pluginID: 'scite-zotero-plugin@scite.ai',
        iconPath: 'skin/mentioning.png',
        flex: 0,
        fixedWidth: false,
        staticWidth: false,
        minWidth: 0,
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-total',
        label: 'Total Smart Citations',
        pluginID: 'scite-zotero-plugin@scite.ai',
        iconPath: '',
        flex: 0,
        fixedWidth: false,
        staticWidth: false,
        minWidth: 0,
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }
    },
    {
        dataKey: 'zotero-items-column-citingPublications',
        label: 'Total Distinct Citing Publications',
        pluginID: 'scite-zotero-plugin@scite.ai',
        iconPath: 'skin/total_publications.png',
        flex: 0,
        fixedWidth: false,
        staticWidth: false,
        minWidth: 0,
        zoteroPersist: new Set(['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection']),
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }

    }
]
