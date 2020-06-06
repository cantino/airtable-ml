import {
    useWatchable,
    useLoadable, Button,
} from '@airtable/blocks/ui';
import {cursor, base} from '@airtable/blocks';
import {FieldType, Table} from "@airtable/blocks/models";
import React from 'react';
import {FieldId} from "@airtable/blocks/types";
import CSS from 'csstype';

const removeLink: CSS.Properties = {
    marginLeft: '10px',
    cursor: 'pointer'
};

export const ACCEPTABLE_TYPES = [
    FieldType.AUTO_NUMBER, FieldType.CURRENCY, FieldType.COUNT, FieldType.DURATION,
    FieldType.NUMBER, FieldType.PERCENT, FieldType.RATING, FieldType.CHECKBOX, FieldType.CREATED_TIME,
    FieldType.DATE, FieldType.DATE_TIME, FieldType.LAST_MODIFIED_TIME, FieldType.EMAIL,
    FieldType.PHONE_NUMBER, FieldType.SINGLE_LINE_TEXT, FieldType.URL, FieldType.SINGLE_COLLABORATOR,
    FieldType.SINGLE_SELECT
];

export default function MultiFieldPicker({ table, fieldIds, onChange }: { table: Table, fieldIds: FieldId[], onChange(ids: FieldId[]): void}): JSX.Element {
    useLoadable(cursor)
    useWatchable(cursor, ['selectedFieldIds']);
    const selectedFields = cursor
        .selectedFieldIds
        .map((id) => table.getFieldIfExists(id))
        .filter((f) => f && ACCEPTABLE_TYPES.indexOf(f.type) > -1);

    let fields = fieldIds.map((id) => table.getFieldIfExists(id)).filter((f) => f);

    return <div>
        {cursor.selectedFieldIds.length && (
            <Button onClick={() => onChange(fieldIds.concat(selectedFields.map((f) => f.id)))}>Add {selectedFields.length === 1 ? `${selectedFields.length} selected field` : `${selectedFields.length} selected fields`}</Button>
        )}

        {fields.length && (
            <div>
                <div>
                    Selected fields:
                </div>
                <ul>
                    {fields.map((field) => {
                        return <li key={field.id}>
                            <span>{field.name}</span>
                            <a style={removeLink} onClick={(e) => {
                                e.preventDefault();
                                onChange(fields.filter((f) => f !== field).map((f) => f.id));
                            }}>remove</a>
                        </li>;
                    })}
                </ul>
            </div>
        )}
    </div>;
}
