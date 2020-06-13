import React, {useState} from "react";
import {Field, Table, Record} from "@airtable/blocks/models";
import brain, {INeuralNetworkJSON, NeuralNetwork} from "brain.js";
import {Button, useRecords} from "@airtable/blocks/ui";
import {CategoricalFieldInfoEntry, FieldData, fieldDataForType, NumericFieldInfoEntry} from "./trainer";

interface PredictProps {
    table: Table,
    trainingField: Field,
    outputField: Field,
    featureFields: Field[],
    records: Record[],
    fieldData: FieldData,
    network: NeuralNetwork,
}

async function predict({ table, trainingField, outputField, featureFields, records, fieldData, network }: PredictProps) {
    const outputFieldEntry = fieldDataForType(outputField.type);
    const trainingFieldEntry = fieldData[trainingField.id];
    const updates = [];

    if (!outputFieldEntry || !trainingFieldEntry || outputFieldEntry.airtableType !== trainingFieldEntry.airtableType) {
        throw new Error("Airtable ML: Training and output fields must have the same types, please reconfigure.");
    }

    featureFields.forEach((field: Field) => {
        const freshEntry = fieldDataForType(field.type);
        if (!freshEntry) return;

        const oldEntry = fieldData[field.id];

        if ((freshEntry && !oldEntry) || freshEntry.airtableType !== oldEntry.airtableType) {
            throw new Error("Airtable ML: Table fields have changed, please retrain.");
        }

        // Copy the functions over because they don't serialize successfully.
        Object.keys(freshEntry).forEach((key) => {
            if (key === 'parse' || key === 'output') {
                oldEntry[key] = freshEntry[key] as any;
            }
        });
    });

    records.forEach((record) => {
        // Only compute for cells that don't already have a computed value.
        if (record.getCellValue(outputField) !== null && record.getCellValue(outputField) !== undefined) return;

        const input = {};
        featureFields.forEach((field: Field) => {
            const fieldRecord = fieldData[field.id];
            if (!fieldRecord) return;

            const cellValue = record.getCellValue(field);
            const parsedValue = fieldRecord.parse(cellValue);
            switch (fieldRecord.type) {
                case "numeric":
                    if (typeof parsedValue === "number") {
                        input[field.id] = (parsedValue - fieldRecord.min) / (fieldRecord.max - fieldRecord.min);
                    }
                    break;
                case "categorical":
                    if (parsedValue !== "__missing__") {
                        input[`${field.id}_${fieldRecord.variants[parsedValue]}`] = 1;
                    }
                    break;
            }
        });

        const networkOutput = network.run(input);
        console.log("input: ", input);
        console.log("output: ", networkOutput);

        let result;
        if (outputFieldEntry.type === 'numeric') {
            result = outputFieldEntry.output(Object.values(networkOutput)[0], trainingFieldEntry as NumericFieldInfoEntry);
        } else {
            let max: number = -Infinity;
            let maxKey: null | string = null;
            Object.keys(networkOutput).forEach((key) => {
                if (networkOutput[key] > max) {
                    max = networkOutput[key];
                    maxKey = key;
                }
            })
            console.log("Max key ", maxKey, " with ", max);

            const tfe = trainingFieldEntry as CategoricalFieldInfoEntry;
            const keyNumber = parseInt(maxKey.split('_').pop());

            for (const key of Object.keys(tfe.variants)) {
                if (tfe.variants[key] === keyNumber) {
                    result = outputFieldEntry.output(key, outputField);
                }
            }

            if (!result) {
                console.warn("Unable to find matching variant for record ", record, " with network output ", networkOutput);
            }
        }

        if (table.hasPermissionToUpdateRecord(record, { [outputField.id]: result })) {
            updates.push({
                id: record.id,
                fields: {
                    [outputField.id]: result,
                },
            });
            // table.updateRecordAsync(record, { [outputField.id]: result }).catch((e) => console.error(e));
        }
    });

    const BATCH_SIZE = 50;
    let i = 0;
    while (i < updates.length) {
        const recordBatch = updates.slice(i, i + BATCH_SIZE);
        await table.updateRecordsAsync(recordBatch);
        i += BATCH_SIZE;
    }
}

interface PredictorUIProps {
    table: Table,
    outputField: Field,
    trainingField: Field,
    featureFields: Array<Field>,
    networkJSON: INeuralNetworkJSON,
    fieldData: FieldData,
}

export function PredictorUI({ table,  featureFields, networkJSON, fieldData, outputField, trainingField }: PredictorUIProps): JSX.Element {
    const [network,] = useState<NeuralNetwork>(() => (new brain.NeuralNetworkGPU()).fromJSON(networkJSON));
    const [state, setState] = useState("Click to generate predictions");
    const records = useRecords(table, { fields: [outputField, ...featureFields] });

    const runPrediction = () => {
        setState("Processing...");
        setTimeout(async () => {
            try {
                await predict({ table, trainingField, outputField, featureFields, records, fieldData, network });
                setState("Done. Click to generate predictions again.");
            } catch (e) {
                if (e.message.startsWith("Airtable ML")) {
                    setState(e.message);
                } else {
                    console.error(e);
                    setState("Error");
                }
            }
        }, 10);
    }

    return <div>
        <Button disabled={state.indexOf("Processing") !== -1} onClick={runPrediction}>{state}</Button>
    </div>;
}

