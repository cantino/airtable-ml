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
import {FieldData} from "./trainer";
import {INeuralNetworkJSON} from "brain.js";
import {TrainingOptions} from "./training-options-ui";
import {PredictorUI} from "./predictor";

function WelcomeView() {
    useLoadable(cursor)
    useWatchable(cursor, ['activeTableId']);

    const globalConfig = useGlobalConfig();

    const tableId = globalConfig.get('tableId');
    const table = tableId && base.getTableIfExists(tableId as string);

    const outputFieldId = globalConfig.get('outputFieldId');
    const outputField = table && outputFieldId && table.getFieldIfExists(outputFieldId as string);

    const trainingFieldId = globalConfig.get('trainingFieldId');
    const trainingField = table && trainingFieldId && table.getFieldIfExists(trainingFieldId as string);

    const featureFieldIds = (globalConfig.get('featureFieldIds') || []) as Array<string>;
    let featureFields = table && featureFieldIds && featureFieldIds.map((id) => table.getFieldIfExists(id));
    if (featureFields && featureFields.some((f) => !f)) featureFields = null;

    const trainingOptionsString = globalConfig.get('trainingOptionsString');
    let trainingOptions: TrainingOptions | null;
    if (trainingOptionsString) trainingOptions = JSON.parse(trainingOptionsString as string) as TrainingOptions;

    const networkAndFieldsString = globalConfig.get('networkAndFieldsString');
    let networkJSON: INeuralNetworkJSON, fieldData: FieldData;
    if (networkAndFieldsString) {
        const [_n, _f] = JSON.parse(networkAndFieldsString as string);
        networkJSON = (_n as INeuralNetworkJSON);
        fieldData = (_f as FieldData);
    }

    if (!table || !outputField || !trainingField || !featureFields || !networkJSON || !fieldData || !trainingOptions) {
        return <div>
            <Heading>Airtable ML 🧠</Heading>
            <Heading size="small">Welcome to Airtable ML! Click the settings icon in the upper right to get started.</Heading>
        </div>;
    }

    if (tableId !== cursor.activeTableId) {
        return <div>
            <Heading>Airtable ML 🧠</Heading>
            <Heading size="xsmall">⚠️ Please switch to your '{table.name}' table or click on the settings icon in the upper right to select a new one.</Heading>
        </div>;
    }

    return <div>
        <Heading>Airtable ML 🧠</Heading>

        <Heading size="xsmall">
            Hello! 👋 Click the button below to calculate predictions for all empty values in the '{outputField.name}' Field.
            If you'd like to reconfigure Airtable ML, click the settings icon in the upper right.
        </Heading>

        <PredictorUI
            featureFields={featureFields}
            trainingField={trainingField}
            outputField={outputField}
            networkJSON={networkJSON}
            fieldData={fieldData}
            table={table}
        />
    </div>;
}

function MainWrapper() {
    const [isShowingSettings, setIsShowingSettings] = useState(false);

    useSettingsButton(function() {
        setIsShowingSettings(!isShowingSettings);
    });

    return <div style={ { margin: "10px" } }>
        <ViewportConstraint minSize={{width: 400}} />

        {isShowingSettings ? <Settings /> : <WelcomeView />}
    </div>
}

initializeBlock(() => <MainWrapper />);
