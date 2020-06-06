import {
    useWatchable,
    useLoadable,
    Heading,
    TablePicker,
    FieldPicker, useGlobalConfig
} from '@airtable/blocks/ui';
import {cursor, base} from '@airtable/blocks';
import React, {useState} from 'react';
import {FieldData, Trainer} from "./trainer";
import {INeuralNetworkJSON} from "brain.js";
import MultiFieldPicker, {ACCEPTABLE_TYPES} from "./multi-field-picker";
import Stepper from "./stepper";
import {FieldId, TableId} from "@airtable/blocks/types";

export default function Settings(): JSX.Element {
    useLoadable(cursor)
    useWatchable(cursor, ['activeTableId', 'activeViewId', 'selectedRecordIds', 'selectedFieldIds']);

    const globalConfig = useGlobalConfig();

    const tableId = globalConfig.get('tableId') as TableId;
    const table = tableId && base.getTableIfExists(tableId as string);

    const trainingFieldId = globalConfig.get('trainingFieldId') as FieldId;
    const trainingField = table && trainingFieldId && table.getFieldIfExists(trainingFieldId as string);

    const outputFieldId = globalConfig.get('outputFieldId') as FieldId;
    const outputField = table && outputFieldId && table.getFieldIfExists(outputFieldId as string);

    const featureFieldIds = (globalConfig.get('featureFieldIds') || []) as FieldId[];
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

    const [step, setStep] = useState(0);

    const steps = [
        {
            name: "Select a Table",
            description: "Select a table that contains data to train on.",
            available: () => true,
            render: () => {
                return <TablePicker
                    table={table}
                    onChange={newTable => {
                        if (newTable.id !== tableId) {
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
                />;
            }
        },
        {
            name: "Select a prediction Field",
            description: "Select a field that contains correct predictions to learn from. Only rows with a value in this field will be used.",
            available: () => table,
            render: () => {
                return <FieldPicker
                    table={table}
                    field={trainingField}
                    allowedTypes={ACCEPTABLE_TYPES}
                    onChange={newField => {
                        if (newField.id !== trainingFieldId) {
                            globalConfig.setPathsAsync([
                                {path: ['trainingFieldId'], value: newField.id},
                                {path: ['networkAndFieldsString'], value: null},
                            ]);
                        }
                    }}
                    width="320px"
                />;
            }
        },
        {
            name: "Select an output Field",
            description: "Select an output Field that will be updated with the generated predictions. (This should be different than the training field from the last step.)",
            available: () => trainingField,
            render: () => {
                return <FieldPicker
                    table={table}
                    field={outputField}
                    allowedTypes={ACCEPTABLE_TYPES}
                    onChange={newField => {
                        if (newField.id !== outputFieldId) {
                            globalConfig.setPathsAsync([
                                {path: ['outputFieldId'], value: newField.id}
                            ]);
                        }
                    }}
                    width="320px"
                />;
            }
        },
        {
            name: "Select Fields to be used in the analysis",
            description: "Select Fields that should be studied when making a prediction. Some types of fields are unavailable and are not selectable. Also, we recommend against using text, email, or URL fields unless they only contain a few specific values.",
            available: () => outputField,
            render: () => {
                return <MultiFieldPicker
                    table={table}
                    skipFieldIds={[trainingFieldId, outputFieldId]}
                    fieldIds={featureFieldIds}
                    onChange={(ids) => {
                        globalConfig.setPathsAsync([
                            {path: ['featureFieldIds'], value: ids},
                            {path: ['networkAndFieldsString'], value: null},
                        ]);
                    }}
                />;
            }
        },
        {
            name: "Time to train a neural network!",
            description: "Training the network will take a few minutes.",
            available: () => featureFields && featureFields.length,
            render: () => {
                return <Trainer
                    table={table}
                    trainingField={trainingField}
                    outputField={outputField}
                    featureFields={featureFields}
                    trainingOptions={{}}
                    networkJSON={networkJSON}
                    fieldData={fieldData}
                    onTrained={([netJSON, fieldData]) => {
                        console.log("Setting", netJSON, fieldData);
                        globalConfig.setPathsAsync([{
                            path: ['networkAndFieldsString'],
                            value: JSON.stringify([netJSON, fieldData])
                        }]);
                    }}
                />;
            }
        },
        {
            name: "Setup complete!",
            description: "Click the settings button in the upper right again to go back to the main view.",
            available: () => tableId && trainingFieldId && outputFieldId && (featureFieldIds as Array<string>).length > 0 && networkJSON,
            render: () => <div />
        }
    ];

    return <div>
        <Heading>Setup Airtable ML</Heading>

        <Stepper
            step={step}
            steps={steps}
            onChangeStep={setStep}
        />
    </div>;
}
