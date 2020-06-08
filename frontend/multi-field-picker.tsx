import {
    useWatchable,
    useLoadable, Button,
} from '@airtable/blocks/ui';
import {cursor} from '@airtable/blocks';
import {FieldType, Table} from "@airtable/blocks/models";
import React from 'react';
import {FieldId} from "@airtable/blocks/types";
import CSS from 'csstype';

const removeLink: CSS.Properties = {
    marginLeft: '10px',
    color: 'blue',
    cursor: 'pointer'
};

export const ACCEPTABLE_TYPES = [
    FieldType.AUTO_NUMBER, FieldType.CURRENCY, FieldType.COUNT, FieldType.DURATION,
    FieldType.NUMBER, FieldType.PERCENT, FieldType.RATING, FieldType.CHECKBOX, FieldType.CREATED_TIME,
    FieldType.DATE, FieldType.DATE_TIME, FieldType.LAST_MODIFIED_TIME, FieldType.EMAIL,
    FieldType.PHONE_NUMBER, FieldType.SINGLE_LINE_TEXT, FieldType.URL, FieldType.SINGLE_COLLABORATOR,
    FieldType.SINGLE_SELECT
];

interface MultiFieldPickerProps {
    table: Table;
    skipFieldIds: FieldId[];
    fieldIds: FieldId[];
    onChange(ids: FieldId[]): void;
}

export default function MultiFieldPicker({ table, fieldIds, onChange, skipFieldIds }: MultiFieldPickerProps): JSX.Element {
    useLoadable(cursor)
    useWatchable(cursor, ['selectedFieldIds']);
    const selectedFields = cursor
        .selectedFieldIds
        .map((id) => table.getFieldIfExists(id))
        .filter((f) => f && ACCEPTABLE_TYPES.indexOf(f.type) > -1 && skipFieldIds.indexOf(f.id) === -1);

    let fields = fieldIds.map((id) => table.getFieldIfExists(id)).filter((f) => f);

    return <div>
        <Button disabled={selectedFields.length === 0} onClick={() => onChange([...new Set(fieldIds.concat(selectedFields.map((f) => f.id)))])}>
            {selectedFields.length === 0 ? (
                <span>Click on valid Fields in the table to get started.</span>
            ) : (
                <span>Add {selectedFields.length === 1 ? `${selectedFields.length} selected field` : `${selectedFields.length} selected fields`}</span>
            )}
        </Button>
        <ul>
            {fields.map((field) => {
                return <li key={field.id}>
                    <span>{field.name}</span>
                    <a style={removeLink} onClick={(e) => {
                        e.preventDefault();
                        onChange([...new Set(fields.filter((f) => f !== field).map((f) => f.id))]);
                    }}>remove</a>
                </li>;
            })}
        </ul>
    </div>;
}
