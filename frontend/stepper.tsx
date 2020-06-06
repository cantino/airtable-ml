import React from 'react';
import {Button, Heading} from "@airtable/blocks/ui";
import CSS from "csstype";

const sectionStyle: CSS.Properties = {
    marginBottom: '10px'
};

const headingStyle: CSS.Properties = {
    marginBottom: '10px'
};

const buttonStyle: CSS.Properties = {
    marginBottom: '10px'
};

interface Step {
    name: string;
    description: string;
    available(): any
    render(): JSX.Element
}

interface StepperProps {
    step: number;
    steps: Step[];
    onChangeStep(step: number): void
}

function StepperHeader({ step, steps }: StepperProps): JSX.Element {
    return <div style={sectionStyle}>
        <Heading style={headingStyle} size="xsmall">Step {step}: { steps[step].name }</Heading>
        <div>{steps[step].description}</div>
    </div>;
}

function StepperFooter({ step, steps, onChangeStep }: StepperProps): JSX.Element {
    return <div style={sectionStyle}>
        <Button
            style={buttonStyle}
            disabled={step === 0}
            onClick={() => onChangeStep(step - 1)}
        >
            Previous
        </Button>

        <Button
            disabled={step === steps.length - 1 || !steps[step + 1].available()}
            onClick={() => onChangeStep(step + 1)}
        >
            Next
        </Button>
    </div>;
}

export default function Stepper(props: StepperProps): JSX.Element {
    const { steps, step } = props;

    return <div>
        <StepperHeader {...props} />
        <div style={sectionStyle}>
            {steps[step].render()}
        </div>
        <StepperFooter {...props} />
    </div>
}
