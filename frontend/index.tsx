import {
    initializeBlock,
    useWatchable,
    useLoadable,
    useSettingsButton,
    ViewportConstraint,
    useGlobalConfig, Heading
} from '@airtable/blocks/ui';
import {base, cursor} from '@airtable/blocks';
import {useState} from 'react'
import React from 'react';
import Settings from './settings';

function MainComponent() {
    useLoadable(cursor)
    useWatchable(cursor, ['activeTableId', 'activeViewId', 'selectedRecordIds', 'selectedFieldIds']);

    const globalConfig = useGlobalConfig();
    const tableId = globalConfig.get('tableId');
    const table = tableId && base.getTableById(tableId as string);
    const fieldId = globalConfig.get('fieldId');
    const field = table && fieldId && table.getFieldById(fieldId as string);
    const fieldIds = (globalConfig.get('fieldIds') || []) as Array<string>;

    if (!table || !field || !fieldIds.length) {
        return <div>
            <Heading>Classify</Heading>
            <Heading size="small">Welcome to Classify! Click the settings icon in the upper right to get started.</Heading>
        </div>;
    }

    // base.tables.length
    return <div>
        <Heading>Classify</Heading>
        <Heading size="small">To edit your settings, click the settings icon in the upper right.</Heading>
        <p>
            Active table: {cursor.activeTableId}
        </p>
        <p>
            Active view: {cursor.activeViewId}
        </p>
        <p>
            Selected records: {cursor.selectedRecordIds.join(', ')}
        </p>
        <p>
            Selected fields: {cursor.selectedFieldIds.join(', ')}
        </p>
    </div>;
}

function Classify() {
    const [isShowingSettings, setIsShowingSettings] = useState(false);

    useSettingsButton(function() {
        setIsShowingSettings(!isShowingSettings);
    });

    return <div>
        <ViewportConstraint minSize={{width: 325}} />
        {isShowingSettings ? <Settings /> : <MainComponent />}
    </div>
}

initializeBlock(() => <Classify />);
