import {
    useWatchable,
    useLoadable,
    Heading,
    TablePicker,
    FieldPicker, useGlobalConfig
} from '@airtable/blocks/ui';
import {cursor, base} from '@airtable/blocks';
import React, {useEffect, useRef} from 'react';
import { Button } from "@airtable/blocks/ui";
import Trainer from "./trainer";

const scrollToRef = (ref) => window.scrollTo(0, ref.current.offsetTop)

export default function Settings(): JSX.Element {
    useLoadable(cursor)
    useWatchable(cursor, ['activeTableId', 'activeViewId', 'selectedRecordIds', 'selectedFieldIds']);

    const globalConfig = useGlobalConfig();
    const tableId = globalConfig.get('tableId');
    const table = tableId && base.getTableById(tableId as string);
    const trainingFieldId = globalConfig.get('trainingFieldId');
    const trainingField = table && trainingFieldId && table.getFieldById(trainingFieldId as string);
    const predictionFieldId = globalConfig.get('predictionFieldId');
    const predictionField = table && predictionFieldId && table.getFieldById(predictionFieldId as string);
    const featureFieldIds = (globalConfig.get('featureFieldIds') || []) as Array<string>;
    const featureFields = table && featureFieldIds && featureFieldIds.map((id) => table.getFieldById(id));

    const bottomRef = useRef(null);
    useEffect(() => scrollToRef(bottomRef), [tableId, trainingFieldId, predictionFieldId, featureFieldIds]);

    if (!globalConfig.hasPermissionToSet('tableId') || !globalConfig.hasPermissionToSet('trainingFieldId') || !globalConfig.hasPermissionToSet('predictionFieldId') || !globalConfig.hasPermissionToSet('featureFieldIds')) {
        return <div>
            You do not have permission to update Classify&apos;s settings.
        </div>;
    }

    return <div>
        <Heading>Setup</Heading>
        <p>
            <Heading size="xsmall">Step 1: Select a Table</Heading>
            <TablePicker
                table={table}
                onChange={newTable => {
                    if (newTable !== tableId) {
                        globalConfig.setPathsAsync([
                            { path: ['tableId'], value: newTable.id },
                            { path: ['trainingFieldId'], value: null },
                            { path: ['predictionFieldId'], value: null },
                            { path: ['featureFieldIds'], value: [] },
                        ]);
                    }
                }}
                width="320px"
            />
        </p>

        {tableId ? (
            <p>
                <Heading size="xsmall">Step 2: Select a Field that will be used for training - only rows with a value in this field will be trained on</Heading>
                <FieldPicker
                    table={table}
                    field={trainingField}
                    onChange={newField => {
                        if (newField !== trainingFieldId) {
                            globalConfig.setPathsAsync([
                                { path: ['trainingFieldId'], value: newField.id }
                            ]);
                        }
                    }}
                    width="320px"
                />
            </p>
        ) : ""}

        {trainingFieldId ? (
            <p>
                <Heading size="xsmall">Step 3: Select a Field that will be updated with the prediction (this should be different from the training field)</Heading>
                <FieldPicker
                    table={table}
                    field={predictionField}
                    onChange={newField => {
                        if (newField !== predictionFieldId) {
                            globalConfig.setPathsAsync([
                                { path: ['predictionFieldId'], value: newField.id }
                            ]);
                        }
                    }}
                    width="320px"
                />
            </p>
        ) : ""}

        {predictionFieldId ? (
            <p>
                <Heading size="xsmall">Step 4: Select Field(s) used for prediction</Heading>
                {featureFieldIds && featureFieldIds.length ? (
                    <div>
                        {featureFieldIds.length === 1 ? "1 field" : `${featureFieldIds.length} fields`} have been selected. You can change the field set by selecting columns from the table to the left and clicking below.
                    </div>
                ) : (
                    <div>
                        Select one or more columns from the table to the left and click below.
                    </div>
                )}
                <Button onClick={() => {
                    globalConfig.setPathsAsync([{ path: ['featureFieldIds'], value: cursor.selectedFieldIds }]);
                }} icon="edit" disabled={cursor.selectedFieldIds.length === 0}>
                    Use selection of {cursor.selectedFieldIds.length === 1 ? "1 field" : `${cursor.selectedFieldIds.length} fields`}
                </Button>
            </p>
        ) : ""}

        {featureFieldIds && featureFieldIds.length ? (
            <p>
                <Heading size="xsmall">Step 5: Time to train a neural network!</Heading>
                <Trainer table={table} trainingField={trainingField} featureFields={featureFields} />
            </p>
        ) : ""}

        <Heading ref={bottomRef} size="xsmall">
            {(tableId && trainingFieldId && predictionFieldId && (featureFieldIds as Array<string>).length > 0) ? "Setup complete! Click the settings button again to go back to the main view." : "Please continue setup."}
        </Heading>
    </div>;
}
