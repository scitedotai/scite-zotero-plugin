const React = require('react');
const { string } = require('prop-types');
import { fetchTallyDataZotero7 } from './util';

const SciteColumnHeading = (props) => {
	props = Object.assign({}, props);
	return <span><img src={props.iconPath} height='10px' width='4px' style={{'margin-left': '6px'}} /> {props.name}</span>;
};

SciteColumnHeading.propTypes = {
	iconPath: string,
	name: string.isRequired,
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
        zoteroPersist: ['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection'],
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
        zoteroPersist: ['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection'],
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
        zoteroPersist: ['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection'],
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
        zoteroPersist: ['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection'],
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
        zoteroPersist: ['width', 'ordinal', 'hidden', 'sortActive', 'sortDirection'],
        dataProvider: (item, dataKey) => {
            return fetchTallyDataZotero7(item, dataKey)
        }

    }
]
