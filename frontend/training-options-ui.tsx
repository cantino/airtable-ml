import React, {useEffect, useState} from "react";
import {Field, Table} from "@airtable/blocks/models";
import {FieldData, makeTrainingData} from "./trainer";
import {Button, FormField, Select, useRecords} from "@airtable/blocks/ui";
import CSS from 'csstype';

const fieldStyle: CSS.Properties = {
    fontSize: '13px',
    height: '32px',
    lineHeight: '21px',
    paddingLeft: '10px',
    paddingRight: '10px',
    borderRadius: '3px',
    boxSizing: 'border-box',
    fontFamily: "-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol'",
    fontWeight: 400,
    appearance: 'none',
    outline: 'none',
    border: 'none',
    color: 'hsl(0,0%,20%)',
    width: '100%',
};

export interface TrainingOptions {
    iterations: number;
    hiddenLayers: [number, number?, number?, number?],
    activation: 'sigmoid' | 'relu' | 'leaky-relu' | 'tanh',
    momentum: number,
    learningRate: number,
}

interface TrainingOptionsUIProps {
    table: Table,
    trainingField: Field,
    outputField: Field,
    trainingOptions: TrainingOptions | null,
    featureFields: Array<Field>,
    fieldData: FieldData | null,
    onOptionsChange(options: TrainingOptions): void,
}

export function TrainingOptionsUI({ table, trainingField, outputField, featureFields, trainingOptions, fieldData, onOptionsChange }: TrainingOptionsUIProps): JSX.Element {
    let [computing, setComputing] = useState(false);

    const fields = [...featureFields, trainingField];
    const records = useRecords(table, { fields });

    const useDefaults = () => {
        setComputing(true);
        setTimeout(() => {
            const [trainingRows, fieldData] = makeTrainingData(table, trainingField, outputField, featureFields, records);

            const inputLayerSize = [...new Set(trainingRows.flatMap((row) => Object.keys(row.input)))].length;
            const outputLayerSize = [...new Set(trainingRows.flatMap((row) => Object.keys(row.output)))].length;
            console.log("Input layer size: ", inputLayerSize);
            console.log("Output layer size: ", outputLayerSize);

            onOptionsChange({
                iterations: 2000,
                hiddenLayers: [Math.ceil((inputLayerSize + outputLayerSize) / 2)],
                learningRate: 0.3,
                momentum: 0.1,
                activation: 'sigmoid'
            });
            setComputing(false);
        }, 10);
    }

    const setValue = (key: string, value: string): void => {
        if (key === 'activation') {
            trainingOptions[key] = value as any;
            onOptionsChange(trainingOptions);
        } else if (key === 'hiddenLayers') {
            trainingOptions[key] = JSON.parse(value);
            onOptionsChange(trainingOptions);
        } else {
            trainingOptions[key] = parseFloat(value);
            onOptionsChange(trainingOptions);
        }
    };

    // One time only.
    useEffect(() => {
        if (!trainingOptions) useDefaults();
        computing = true;
    }, []);

    const positiveNumber = (value: string): boolean => {
        const num = parseFloat(value);
        return num && num > 0 && num < Infinity;
    };

    if (!trainingOptions || computing) {
        return <div>Analyzing data to guess the best settings, just a moment...</div>;
    } else {
        return <div>
            <ValidatingInput label="Iterations" value={trainingOptions.iterations} onChange={v => setValue('iterations', v)} valid={positiveNumber} />
            <ValidatingInput label="Learning Rate" value={trainingOptions.learningRate} onChange={v => setValue('learningRate', v)} valid={positiveNumber} />
            <ValidatingInput label="Momentum" value={trainingOptions.momentum} onChange={v => setValue('momentum', v)} valid={positiveNumber} />
            <ValidatingInput label="Hidden Layers" value={JSON.stringify(trainingOptions.hiddenLayers)} onChange={v => setValue('hiddenLayers', v)} valid={(value) => {
                try {
                    const newValue = JSON.parse(value);
                    return newValue && Array.isArray(newValue) && newValue.length > 0 && newValue.every(positiveNumber);
                } catch {
                    return false;
                }
            }} />
            <FormField label="Activation">
                <Select
                    options={[
                        { value: "sigmoid", label: "sigmoid" },
                        { value: "relu", label: "relu" },
                        { value: "leaky-relu", label: "leaky-relu" },
                        { value: "tanh", label: "tanh" }
                    ]}
                    value={trainingOptions.activation}
                    onChange={newValue => setValue('activation', newValue as string)}
                    width="320px"
                />
            </FormField>
            <Button onClick={useDefaults}>Use Defaults</Button>
        </div>;
    }
}

interface ValidatingInputProps {
    label: string;
    value: any;
    onChange(value: string): void;
    valid(input: string): boolean;
}

function ValidatingInput({ value, onChange, label, valid }: ValidatingInputProps): JSX.Element {
    const [localValue, setLocalValue] = useState(value.toString());
    const [errored, setErrored] = useState(false);

    return <FormField label={label}>
        <input type="text" style={{...fieldStyle, backgroundColor: errored ? 'coral' : 'hsl(0,0%,95%)'}} value={localValue} onChange={(e) => {
            const v = e.target.value;
            setLocalValue(v);
            if (valid(v)) {
                setErrored(false);
                onChange(v);
            } else {
                setErrored(true);
            }
        }} />
    </FormField>;
}
