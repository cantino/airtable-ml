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
import {FieldData, Predictor} from "./trainer";
import {INeuralNetworkJSON} from "brain.js";

function WelcomeView() {
    useLoadable(cursor)
    useWatchable(cursor, ['activeTableId', 'activeViewId', 'selectedRecordIds', 'selectedFieldIds']);

    const globalConfig = useGlobalConfig();

    const tableId = globalConfig.get('tableId');
    const table = tableId && base.getTableIfExists(tableId as string);

    const outputFieldId = globalConfig.get('outputFieldId');
    const outputField = table && outputFieldId && table.getFieldIfExists(outputFieldId as string);

    const trainingFieldId = globalConfig.get('trainingFieldId');
    const trainingField = table && trainingFieldId && table.getFieldIfExists(trainingFieldId as string);

    const featureFieldIds = (globalConfig.get('featureFieldIds') || []) as Array<string>;
    let featureFields = table && featureFieldIds && featureFieldIds.map((id) => table.getFieldIfExists(id));
    if (featureFields.some((f) => !f)) featureFields = null;

    const networkAndFieldsString = globalConfig.get('networkAndFieldsString');
    let networkJSON: INeuralNetworkJSON, fieldData: FieldData;
    if (networkAndFieldsString) {
        const [_n, _f] = JSON.parse(networkAndFieldsString as string);
        networkJSON = (_n as INeuralNetworkJSON);
        fieldData = (_f as FieldData);
    }

    if (!table || !outputField || !trainingField || !featureFields || !networkJSON || !fieldData) {
        return <div>
            <Heading>Predictor</Heading>
            <Heading size="small">Welcome to Predictor! Click the settings icon in the upper right to get started.</Heading>
        </div>;
    }

    if (tableId !== cursor.activeTableId) {
        return <div>
            <Heading>Predictor</Heading>
            <Heading size="small">Please switch to the '{table.name}' table or click on the settings icon in the upper right to select a new one.</Heading>
        </div>;
    }

    // base.tables.length
    return <div>
        <Heading>Predictor</Heading>
        <Heading size="small">To edit your settings, click the settings icon in the upper right.</Heading>
        <Predictor featureFields={featureFields} trainingField={trainingField} outputField={outputField} networkJSON={networkJSON} fieldData={fieldData} table={table}/>
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

function MainWrapper() {
    const [isShowingSettings, setIsShowingSettings] = useState(false);

    useSettingsButton(function() {
        setIsShowingSettings(!isShowingSettings);
    });

    return <div>
        <ViewportConstraint minSize={{width: 325}} />
        {isShowingSettings ? <Settings /> : <WelcomeView />}
    </div>
}

initializeBlock(() => <MainWrapper />);
