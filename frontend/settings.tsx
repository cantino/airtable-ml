import {
    useWatchable,
    useLoadable,
    Heading,
    TablePicker,
    FieldPicker, useGlobalConfig
} from '@airtable/blocks/ui';
import {cursor, base} from '@airtable/blocks';
import React from 'react';
import {FieldData, Trainer} from "./trainer";
import {INeuralNetworkJSON} from "brain.js";
import MultiFieldPicker, {ACCEPTABLE_TYPES} from "./multi-field-picker";

export default function Settings(): JSX.Element {
    useLoadable(cursor)
    useWatchable(cursor, ['activeTableId', 'activeViewId', 'selectedRecordIds', 'selectedFieldIds']);

    const globalConfig = useGlobalConfig();

    const tableId = globalConfig.get('tableId');
    const table = tableId && base.getTableIfExists(tableId as string);

    const trainingFieldId = globalConfig.get('trainingFieldId');
    const trainingField = table && trainingFieldId && table.getFieldIfExists(trainingFieldId as string);

    const outputFieldId = globalConfig.get('outputFieldId');
    const outputField = table && outputFieldId && table.getFieldIfExists(outputFieldId as string);

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

    console.log([table, trainingField, outputField, featureFields, networkJSON, fieldData]);

    if (!globalConfig.hasPermissionToSet('tableId') || !globalConfig.hasPermissionToSet('trainingFieldId') || !globalConfig.hasPermissionToSet('outputFieldId') || !globalConfig.hasPermissionToSet('featureFieldIds') || !globalConfig.hasPermissionToSet('networkAndFieldsString')) {
        return <div>You do not have permission to update settings for this Block.</div>;
    }

    return <div>
        <Heading>Setup</Heading>
        <div>
            <Heading size="xsmall">Step 1: Select a Table</Heading>
            <TablePicker
                table={table}
                onChange={newTable => {
                    if (newTable !== tableId) {
                        globalConfig.setPathsAsync([
                            {path: ['tableId'], value: newTable.id},
                            {path: ['trainingFieldId'], value: null},
                            {path: ['outputFieldId'], value: null},
                            {path: ['featureFieldIds'], value: []},
                            {path: ['networkAndFieldsString'], value: null},
                        ]);
                    }
                }}
                width="320px"
            />
        </div>

        {table ? (
            <div>
                <Heading size="xsmall">Step 2: Select a Field that contains correct prediction examples that you'd like to learn from - only rows with a value in
                    this field will be trained on</Heading>
                <FieldPicker
                    table={table}
                    field={trainingField}
                    allowedTypes={ACCEPTABLE_TYPES}
                    onChange={newField => {
                        if (newField !== trainingFieldId) {
                            globalConfig.setPathsAsync([
                                {path: ['trainingFieldId'], value: newField.id},
                                {path: ['networkAndFieldsString'], value: null},
                            ]);
                        }
                    }}
                    width="320px"
                />
            </div>
        ) : ""}

        {trainingField ? (
            <div>
                <Heading size="xsmall">Step 3: Select an output Field that will be updated with the generated prediction. (This should be
                    different than the training field from Step 2.)</Heading>
                <FieldPicker
                    table={table}
                    field={outputField}
                    allowedTypes={ACCEPTABLE_TYPES}
                    onChange={newField => {
                        if (newField !== outputFieldId) {
                            globalConfig.setPathsAsync([
                                {path: ['outputFieldId'], value: newField.id}
                            ]);
                        }
                    }}
                    width="320px"
                />
            </div>
        ) : ""}

        {outputField ? (
            <div>
                <Heading size="xsmall">Step 4: Select Field(s) to be used in the analysis</Heading>
                <MultiFieldPicker table={table} fieldIds={featureFieldIds} onChange={(ids) => {
                    globalConfig.setPathsAsync([
                        {path: ['featureFieldIds'], value: ids},
                        {path: ['networkAndFieldsString'], value: null},
                    ]);
                }} />
            </div>
        ) : ""}

        {featureFields && featureFields.length ? (
            <div>
                <Heading size="xsmall">Step 5: Time to train a neural network!</Heading>
                <Trainer table={table} trainingField={trainingField} outputField={outputField}
                         featureFields={featureFields} networkJSON={networkJSON} fieldData={fieldData}
                         onTrained={([netJSON, fieldData]) => {
                             console.log("Setting", netJSON, fieldData);
                             globalConfig.setPathsAsync([{
                                 path: ['networkAndFieldsString'],
                                 value: JSON.stringify([netJSON, fieldData])
                             }]);
                         }}/>
            </div>
        ) : ""}

        <Heading size="xsmall">
            {(tableId && trainingFieldId && outputFieldId && (featureFieldIds as Array<string>).length > 0 && networkJSON) ? "Setup complete! Click the settings button again to go back to the main view." : "Please continue setup."}
        </Heading>
    </div>;
}
