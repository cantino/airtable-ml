import React, {useMemo, useState} from "react";
import {Field, FieldType, Table, Record} from "@airtable/blocks/models";
import brain, {INeuralNetworkJSON, INeuralNetworkState, NeuralNetwork} from "brain.js";
import {Button, useRecords} from "@airtable/blocks/ui";
import {TrainingOptions} from "./training-options-ui";
import { Chart } from "react-charts";

export interface NumericFieldInfoEntry {
    type: "numeric";
    airtableType: FieldType;
    max: number;
    min: number;
    parse(input: any): number | '__missing__';
    output(input: number, fd: NumericFieldInfoEntry): any;
}

export interface CategoricalVariants {
    [propName: string]: number
}

export interface CategoricalFieldInfoEntry {
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

export interface TrainingRows {
    input: object,
    output: object
}

const isNumber = value => typeof value === 'number' && value === value && value !== Infinity && value !== -Infinity;

export function fieldDataForType(type: FieldType): NumericFieldInfoEntry | CategoricalFieldInfoEntry {
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

interface TrainerUIProps {
    table: Table,
    trainingField: Field,
    outputField: Field,
    featureFields: Array<Field>,
    networkJSON: INeuralNetworkJSON | null,
    fieldData: FieldData | null,
    trainingOptions: TrainingOptions,
    onTrained(netJSON: [INeuralNetworkJSON, FieldData]): void,
}

interface TrainerTrainProps {
    onProgress: (state: INeuralNetworkState) => void;
    onDone: (state: INeuralNetworkState, net: NeuralNetwork, fieldData: FieldData) => void;
    onError: (error: Error) => void;
}

class Trainer {
    private trainingRows: TrainingRows[];
    private fieldData: FieldData;
    public net: NeuralNetwork;
    public stopping: boolean = false;
    private ticks: number = 0;
    private readonly totalTicks: number;
    private iterationsPerTick: number;

    constructor(readonly trainingOptions: TrainingOptions,
                readonly table: Table,
                readonly trainingField: Field,
                readonly outputField: Field,
                readonly featureFields: Field[],
                readonly records: Record[]) {

        console.log("Instantiating Trainer");

        [this.trainingRows, this.fieldData] = makeTrainingData(table, trainingField, outputField, featureFields, records);

        this.net = new brain.NeuralNetworkGPU({
            hiddenLayers: trainingOptions.hiddenLayers,
            activation: trainingOptions.activation,
        });

        this.totalTicks = 100;
        this.iterationsPerTick = Math.ceil(this.trainingOptions.iterations / this.totalTicks);
    }

    train({ onProgress, onDone, onError }: TrainerTrainProps): void {
        try {
            this.net
                .trainAsync(this.trainingRows, {
                    log: true,
                    iterations: this.iterationsPerTick,
                    momentum: this.trainingOptions.momentum,
                    learningRate: this.trainingOptions.learningRate,
                })
                .then((state) => {
                    this.ticks += 1;
                    const asyncState = { error: state.error, iterations: this.ticks * this.iterationsPerTick };
                    if (this.stopping || this.ticks >= this.totalTicks) {
                        this.stopping = false;
                        onDone(asyncState, this.net, this.fieldData);
                    } else {
                        onProgress(asyncState);
                        this.train({ onProgress, onDone, onError });
                    }
                })
                .catch((error) => {
                    this.stopping = false;
                    onError(error);
                });
        } catch(e) {
            this.stopping = false;
            onError(e);
        }
    }

    stop(): void {
        this.stopping = true;
    }
}

export function TrainerUI({ table, trainingField, outputField, featureFields, trainingOptions, networkJSON, fieldData, onTrained }: TrainerUIProps): JSX.Element {
    const [training, setTraining] = useState(false);
    const [buttonMessage, setButtonMessage] = useState((networkJSON && fieldData) ? "Already trained — Click to retrain" : "Click to train");
    const [errorHistory, setErrorHistory] = useState([]);
    const fields = [...featureFields, trainingField];
    const records = useRecords(table, { fields });

    const trainer: Trainer = useMemo(() => new Trainer(
        trainingOptions,
        table,
        trainingField,
        outputField,
        featureFields,
        records,
    ), []);

    const train = () => {
        setButtonMessage("Training... this may take a few minutes. 😊");
        setTraining(true);
        trainer.train({
            onProgress: (state) => {
                errorHistory.push([state.iterations, state.error]);
                setErrorHistory(errorHistory);
                setButtonMessage(`Training... ${state.iterations} / ${trainingOptions.iterations} iterations`);
            },
            onDone: (state, net, fieldData) => {
                onTrained([net.toJSON(), fieldData]);
                setButtonMessage(`Trained (error = ${state.error.toFixed(5)}) — Click to continue training`);
                setTraining(false);
            },
            onError: (error) => {
                if (error.message.startsWith("Airtable ML")) {
                    setButtonMessage(error.message);
                } else {
                    console.error(error);
                    setButtonMessage(`Error - Click to try again.`);
                }
                setTraining(false);
            }
        });
    };

    return <div>
        <Button disabled={buttonMessage.indexOf("Click") === -1} onClick={train}>{buttonMessage}</Button>
        <Button disabled={!training} onClick={() => {
            setButtonMessage("Stopping...");
            trainer.stop();
        }}>Stop</Button>

        {/* https://github.com/tannerlinsley/react-charts/issues/69 */}
        <style dangerouslySetInnerHTML={{__html: `
            .ChartContainer svg {
                overflow: unset !important;
            }
        `}} />

        {errorHistory.length ? (
            <React.Fragment>
                <div className='ChartContainer' style={{
                    margin: '30px',
                    width: '90%',
                    height: '280px',
                }}>
                    <div>
                        <strong>Error vs Iteration</strong>
                    </div>
                    <Chart data={[
                        {
                            label: 'Error Rate vs Iteration',
                            data: errorHistory,
                        }
                    ]} axes={[
                        { primary: true, type: 'linear', position: 'bottom' },
                        { type: 'linear', position: 'left' },
                    ]} />
                </div>
                <div>
                    In general, you want to increase the number of iterations until the error rate starts to increase again, then stop.
                </div>
            </React.Fragment>
        ) : ""}
    </div>;
}
