import {
    useWatchable,
    useLoadable,
    Heading,
    TablePicker,
    FieldPicker, useGlobalConfig
} from '@airtable/blocks/ui';
import {cursor, base} from '@airtable/blocks';
import React, {useEffect, useRef} from 'react';
import {Button} from "@airtable/blocks/ui";
import {FieldData, Trainer} from "./trainer";
import {INeuralNetworkJSON} from "brain.js";
import {FieldType} from "@airtable/blocks/models";

const scrollToRef = (ref) => window.scrollTo(0, ref.current.offsetTop)

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

    const bottomRef = useRef(null);
    useEffect(() => scrollToRef(bottomRef), [tableId, trainingFieldId, outputFieldId, featureFieldIds, networkAndFieldsString]);

    if (!globalConfig.hasPermissionToSet('tableId') || !globalConfig.hasPermissionToSet('trainingFieldId') || !globalConfig.hasPermissionToSet('outputFieldId') || !globalConfig.hasPermissionToSet('featureFieldIds') || !globalConfig.hasPermissionToSet('networkAndFieldsString')) {
        return <div>
            You do not have permission to update Classify&apos;s settings.
        </div>;
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
                    allowedTypes={[FieldType.AUTO_NUMBER, FieldType.CURRENCY, FieldType.COUNT, FieldType.DURATION,
                        FieldType.NUMBER, FieldType.PERCENT, FieldType.RATING, FieldType.CHECKBOX, FieldType.CREATED_TIME,
                        FieldType.DATE, FieldType.DATE_TIME, FieldType.LAST_MODIFIED_TIME, FieldType.EMAIL,
                        FieldType.PHONE_NUMBER, FieldType.SINGLE_LINE_TEXT, FieldType.URL, FieldType.SINGLE_COLLABORATOR,
                        FieldType.SINGLE_SELECT]}
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
                    allowedTypes={[FieldType.AUTO_NUMBER, FieldType.CURRENCY, FieldType.COUNT, FieldType.DURATION,
                        FieldType.NUMBER, FieldType.PERCENT, FieldType.RATING, FieldType.CHECKBOX, FieldType.CREATED_TIME,
                        FieldType.DATE, FieldType.DATE_TIME, FieldType.LAST_MODIFIED_TIME, FieldType.EMAIL,
                        FieldType.PHONE_NUMBER, FieldType.SINGLE_LINE_TEXT, FieldType.URL, FieldType.SINGLE_COLLABORATOR,
                        FieldType.SINGLE_SELECT]}
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
                {featureFields ? (
                    <div>
                        {featureFields.length === 1 ? "1 field" : `${featureFields.length} fields`} have been
                        selected. You can change the field set by selecting columns from the table to the left and
                        clicking below.
                    </div>
                ) : (
                    <div>
                        Select one or more columns from the table to the left and click below.
                    </div>
                )}
                <Button onClick={() => {
                    if (cursor.selectedFieldIds.sort() !== featureFieldIds.sort()) {
                        globalConfig.setPathsAsync([
                            {path: ['featureFieldIds'], value: cursor.selectedFieldIds},
                            {path: ['networkAndFieldsString'], value: null},
                        ]);
                    }
                }} icon="edit" disabled={cursor.selectedFieldIds.length === 0}>
                    Use selection
                    of {cursor.selectedFieldIds.length === 1 ? "1 field" : `${cursor.selectedFieldIds.length} fields`}
                </Button>
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

        <Heading ref={bottomRef} size="xsmall">
            {(tableId && trainingFieldId && outputFieldId && (featureFieldIds as Array<string>).length > 0 && networkJSON) ? "Setup complete! Click the settings button again to go back to the main view." : "Please continue setup."}
        </Heading>
    </div>;
}
