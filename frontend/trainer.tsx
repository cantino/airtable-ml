import React, {useState} from "react";
import {Field, FieldType, Table, Record} from "@airtable/blocks/models";
import {CrossValidate, NeuralNetworkGPU} from "brain.js";
import {Button, useRecords} from "@airtable/blocks/ui";

interface TrainerProps {
    table: Table,
    trainingField: Field,
    featureFields: Array<Field>
}

interface NumericFieldInfoEntry {
    type: "numeric";
    max: number;
    min: number;
    // sum: number;
    // count: number;
    parse(input: any): number | '__missing__';
}

interface CategoricalVariants {
    [propName: string]: number
}

interface CategoricalFieldInfoEntry {
    type: "categorical";
    parse(input: any): string | '__missing__';
    variantCount: number;
    variants: CategoricalVariants;
}

interface FieldData {
    [propName: string]: NumericFieldInfoEntry | CategoricalFieldInfoEntry
}

const isNumber = value => typeof value === 'number' && value === value && value !== Infinity && value !== -Infinity;

function makeTrainingData(table: Table, trainingField: Field, featureFields: Field[], records: Record[]) {
    const fields = [...featureFields, trainingField];
    const fieldData: FieldData = {};

    fields.forEach(field => {
        switch(field.type) {
            case FieldType.AUTO_NUMBER:
            case FieldType.CURRENCY:
            case FieldType.COUNT:
            case FieldType.DURATION:
            case FieldType.NUMBER:
            case FieldType.PERCENT:
            case FieldType.RATING:
                fieldData[field.id] = {
                    type: 'numeric',
                    max: -Infinity,
                    min: Infinity,
                    // sum: 0,
                    // count: 0,
                    parse: (number) => isNumber(number) ? number : '__missing__'
                };
                break;
            case FieldType.CHECKBOX:
                fieldData[field.id] = {
                    type: 'numeric',
                    max: -Infinity,
                    min: Infinity,
                    // sum: 0,
                    // count: 0,
                    parse: (checked) => checked ? 1.0 : 0.0
                };
                break;
            case FieldType.CREATED_TIME:
            case FieldType.DATE:
            case FieldType.DATE_TIME:
            case FieldType.LAST_MODIFIED_TIME:
                fieldData[field.id] = {
                    type: 'numeric',
                    max: -Infinity,
                    min: Infinity,
                    // sum: 0,
                    // count: 0,
                    parse: (dateString) => dateString ? Date.parse(dateString) : '__missing__'
                };
                break;
            case FieldType.EMAIL:
            case FieldType.PHONE_NUMBER:
            case FieldType.SINGLE_LINE_TEXT:
            case FieldType.URL:
                fieldData[field.id] = {
                    type: 'categorical',
                    variants: {},
                    variantCount: 0,
                    parse: (s) => s ? s.toString().trim().toLowerCase() : '__missing__'
                };
                break;
            case FieldType.SINGLE_COLLABORATOR:
            case FieldType.SINGLE_SELECT:
                fieldData[field.id] = {
                    type: 'categorical',
                    variants: {},
                    variantCount: 0,
                    parse: (s) => s ? s.id : '__missing__'
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
                console.warn(`Unable to handle field of type ${field.type} at this time.`);
                break;
        }
    });

    const trainingRows = [];
    records.forEach((record) => {
        const trainingRow = { input: {}, output: {} };
        fields.forEach(field => {
            const fieldRecord = fieldData[field.id];
            const cellValue = record.getCellValue(field);
            const parsedValue = fieldRecord.parse(cellValue);
            switch (fieldRecord.type) {
                case "numeric":
                    if (typeof parsedValue === "number") {
                        // fieldRecord.sum += parsedValue;
                        // fieldRecord.count += 1;
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
            if (fieldRecord.type === "numeric") {
                if (field === trainingField) {
                    trainingRow.output[field.id] = (trainingRow.output[field.id] - fieldRecord.min) / (fieldRecord.max - fieldRecord.min);
                } else {
                    trainingRow.input[field.id] = (trainingRow.input[field.id] - fieldRecord.min) / (fieldRecord.max - fieldRecord.min);
                }
            }
        });
    });

    return trainingRows;
}

export default function Trainer({ table, trainingField, featureFields }: TrainerProps): JSX.Element {
    const [net, setNet] = useState(null);
    const fields = [...featureFields, trainingField];
    const records = useRecords(table, { fields });

    const train = () => {
        const trainingRows = makeTrainingData(table, trainingField, featureFields, records);
        const crossValidate = new CrossValidate(NeuralNetworkGPU, {});
        crossValidate.train(trainingRows, {});
        const json = crossValidate.toJSON();
        console.log(json)
        const net = crossValidate.toNeuralNetwork();
        setNet(net);
    }

    return <div>
        <Button onClick={train}>{net ? "Retrain" : "Train"}</Button>
    </div>;
}
