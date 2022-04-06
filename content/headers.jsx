const React = require('react');
const { string } = require('prop-types');

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
