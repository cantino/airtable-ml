import React, {useState} from "react";
import {Field, FieldType, Table, Record} from "@airtable/blocks/models";
import brain, {INeuralNetworkJSON, INeuralNetworkState, NeuralNetwork} from "brain.js";
import {Button, useRecords} from "@airtable/blocks/ui";
import {TrainingOptions} from "./training-options-ui";

interface NumericFieldInfoEntry {
    type: "numeric";
    airtableType: FieldType;
    max: number;
    min: number;
    parse(input: any): number | '__missing__';
    output(input: number, fd: NumericFieldInfoEntry): any;
}

interface CategoricalVariants {
    [propName: string]: number
}

interface CategoricalFieldInfoEntry {
    type: "categorical";
    airtableType: FieldType;
    parse(input: any): string | '__missing__';
    variantCount: number;
    variants: CategoricalVariants;
    output(input: string, fd: Field): string;
}

export interface FieldData {
    [propName: string]: NumericFieldInfoEntry | CategoricalFieldInfoEntry
}

interface TrainingRows {
    input: object,
    output: object
}

const isNumber = value => typeof value === 'number' && value === value && value !== Infinity && value !== -Infinity;

function fieldDataForType(type: FieldType): NumericFieldInfoEntry | CategoricalFieldInfoEntry {
    let result = null;
    switch(type) {
        case FieldType.AUTO_NUMBER:
        case FieldType.CURRENCY:
        case FieldType.COUNT:
        case FieldType.DURATION:
        case FieldType.NUMBER:
        case FieldType.PERCENT:
        case FieldType.RATING:
            result = {
                type: 'numeric',
                airtableType: type,
                max: -Infinity,
                min: Infinity,
                parse: (number) => isNumber(number) ? number : '__missing__',
                output: (number, fd) => number * (fd.max - fd.min) + fd.min,
            };
            break;
        case FieldType.CHECKBOX:
            result = {
                type: 'numeric',
                airtableType: type,
                max: 1.0,
                min: 0.0,
                parse: (checked) => checked ? 1.0 : 0.0,
                output: (number, _fd) => number >= 0.5
            };
            break;
        case FieldType.CREATED_TIME:
        case FieldType.DATE:
        case FieldType.DATE_TIME:
        case FieldType.LAST_MODIFIED_TIME:
            result = {
                type: 'numeric',
                airtableType: type,
                max: -Infinity,
                min: Infinity,
                parse: (dateString) => dateString ? Date.parse(dateString) : '__missing__',
                output: (number, fd) => new Date( number * (fd.max - fd.min) + fd.min)
            };
            break;
        case FieldType.EMAIL:
        case FieldType.PHONE_NUMBER:
        case FieldType.SINGLE_LINE_TEXT:
        case FieldType.URL:
            result = {
                type: 'categorical',
                airtableType: type,
                variants: {},
                variantCount: 0,
                parse: (s) => s ? s.toString().trim().toLowerCase() : '__missing__',
                output: (string, _field: Field) => string
            };
            break;
        case FieldType.SINGLE_COLLABORATOR:
        case FieldType.SINGLE_SELECT:
            result = {
                type: 'categorical',
                airtableType: type,
                variants: {},
                variantCount: 0,
                parse: (s) => s ? s.id : '__missing__',
                output: (string, _field: Field) => {
                    return { name: string };
                    // if (field.options.choices) {
                    //     return (field.options.choices as any[]).find(({name}) => name === string).id;
                    // } else {
                    //     console.log("Unable to find a match for variant ", string, " in ", field);
                    //     return null;
                    // }
                }
            };
            break;
        case FieldType.BARCODE:
        case FieldType.FORMULA:
        case FieldType.MULTILINE_TEXT:
        case FieldType.MULTIPLE_ATTACHMENTS:
        case FieldType.MULTIPLE_COLLABORATORS:
        case FieldType.MULTIPLE_LOOKUP_VALUES:
        case FieldType.MULTIPLE_RECORD_LINKS:
        case FieldType.MULTIPLE_SELECTS:
        case FieldType.RICH_TEXT:
        case FieldType.ROLLUP:
        default:
            console.warn(`Unable to handle field of type ${type} at this time.`);
            break;
    }

    return result;
}

export function makeTrainingData(table: Table, trainingField: Field, outputField: Field, featureFields: Field[], records: Record[]): [TrainingRows[], FieldData] {
    console.log("Making training data...");

    const fields = [...featureFields, trainingField];
    const fieldData: FieldData = {};

    fields.forEach((field: Field) => {
        const result = fieldDataForType(field.type);
        if (result) fieldData[field.id] = result;
    });

    const trainingRows: TrainingRows[] = [];
    records.forEach((record) => {
        // Skip if we don't have a value in our trainingField.
        if (!record.getCellValue(trainingField)) return;

        const trainingRow = { input: {}, output: {} };
        fields.forEach(field => {
            const fieldRecord = fieldData[field.id];
            if (!fieldRecord) return;

            const cellValue = record.getCellValue(field);
            let parsedValue = fieldRecord.parse(cellValue);
            switch (fieldRecord.type) {
                case "numeric":
                    if (typeof parsedValue === "number") {
                        if (parsedValue < fieldRecord.min) {
                            fieldRecord.min = parsedValue;
                        } else if (parsedValue > fieldRecord.max) {
                            fieldRecord.max = parsedValue;
                        }
                        if (field === trainingField) {
                            trainingRow.output[field.id] = parsedValue;
                        } else {
                            trainingRow.input[field.id] = parsedValue;
                        }
                    }
                    break;
                case "categorical":
                    if (parsedValue !== "__missing__") {
                        if (field.options && field.options.choices) {
                            parsedValue = (field.options.choices as any[]).find(({id}) => id === parsedValue).name;
                        }

                        if (!fieldRecord.variants[parsedValue]) {
                            fieldRecord.variantCount += 1;
                            fieldRecord.variants[parsedValue] = fieldRecord.variantCount;
                        }
                        if (field === trainingField) {
                            trainingRow.output[`${field.id}_${fieldRecord.variants[parsedValue]}`] = 1;
                        } else {
                            trainingRow.input[`${field.id}_${fieldRecord.variants[parsedValue]}`] = 1;
                        }
                    }
                    break;
            }
        });
        trainingRows.push(trainingRow);
    });

    // Normalize numeric fields to be between 0 and 1.
    trainingRows.forEach((trainingRow) => {
        fields.forEach(field => {
            const fieldRecord = fieldData[field.id];
            if (!fieldRecord) return;

            if (fieldRecord.type === "numeric") {
                if (field === trainingField) {
                    trainingRow.output[field.id] = (trainingRow.output[field.id] - fieldRecord.min) / (fieldRecord.max - fieldRecord.min);
                } else {
                    trainingRow.input[field.id] = (trainingRow.input[field.id] - fieldRecord.min) / (fieldRecord.max - fieldRecord.min);
                }
            }
        });
    });

    return [trainingRows, fieldData];
}

interface PredictProps {
    table: Table,
    trainingField: Field,
    outputField: Field,
    featureFields: Field[],
    records: Record[],
    fieldData: FieldData,
    network: NeuralNetwork,
}

function predict({ table, trainingField, outputField, featureFields, records, fieldData, network }: PredictProps) {
    const outputFieldEntry = fieldDataForType(outputField.type);
    const trainingFieldEntry = fieldData[trainingField.id];

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

        console.log(result);
        if (table.hasPermissionToUpdateRecord(record, { [outputField.id]: result })) {
            table.updateRecordAsync(record, { [outputField.id]: result }).catch((e) => console.error(e));
        }
    });
}

interface TrainerProps {
    table: Table,
    trainingField: Field,
    outputField: Field,
    featureFields: Array<Field>,
    networkJSON: INeuralNetworkJSON | null,
    fieldData: FieldData | null,
    trainingOptions: TrainingOptions,
    onTrained(netJSON: [INeuralNetworkJSON, FieldData]): void,
}

export function Trainer({ table, trainingField, outputField, featureFields, trainingOptions, networkJSON, fieldData, onTrained }: TrainerProps): JSX.Element {
    const [state, setState] = useState((networkJSON && fieldData) ? "Already trained — Click to retrain" : "Click to train");
    const fields = [...featureFields, trainingField];
    const records = useRecords(table, { fields });

    const train = () => {
        try {
            const [trainingRows, fieldData] = makeTrainingData(table, trainingField, outputField, featureFields, records);

            const net = new brain.NeuralNetworkGPU({
                hiddenLayers: trainingOptions.hiddenLayers,
                activation: trainingOptions.activation,
            });

            net
                .trainAsync(trainingRows, {
                    log: true,
                    iterations: trainingOptions.iterations,
                    momentum: trainingOptions.momentum,
                    learningRate: trainingOptions.learningRate,
                    callback: (state: INeuralNetworkState) => setState(`Training... ${state.iterations} / ${trainingOptions.iterations} iterations`),
                    callbackPeriod: trainingOptions.iterations / 100,
                })
                .then((res) => {
                    onTrained([net.toJSON(), fieldData]);
                    setState(`Trained (error = ${res.error}) — Click to retrain`);
                })
                .catch(e => {
                    console.error(e);
                    setState(`Error: ${e.message}`);
                });

            setState("Training... this may take a few minutes. 😊");
        } catch(e) {
            if (e.message.startsWith("Airtable ML")) {
                setState(e.message);
            } else {
                console.error(e);
                setState("Error");
            }
        }
    }

    return <div>
        <Button disabled={state.indexOf("Click") === -1} onClick={train}>{state}</Button>
    </div>;
}

interface PredictorProps {
    table: Table,
    outputField: Field,
    trainingField: Field,
    featureFields: Array<Field>,
    networkJSON: INeuralNetworkJSON,
    fieldData: FieldData,
}

export function Predictor({ table,  featureFields, networkJSON, fieldData, outputField, trainingField }: PredictorProps): JSX.Element {
    const [network,] = useState<NeuralNetwork>(() => (new brain.NeuralNetworkGPU()).fromJSON(networkJSON));
    const [state, setState] = useState("Click to generate predictions");
    const records = useRecords(table, { fields: [outputField, ...featureFields] });

    const runPrediction = () => {
        setState("Processing...");
        setTimeout(() => {
            try {
                predict({ table, trainingField, outputField, featureFields, records, fieldData, network });
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

