import React, {useCallback, useMemo, useRef, useState} from 'react';
import type {ForwardedRef} from 'react';
import {NativeSyntheticEvent, TextInputSelectionChangeEventData} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import {addLeadingZero, replaceAllDigits, replaceCommasWithPeriod, stripSpacesFromAmount, validateAmount} from '@libs/MoneyRequestUtils';
import CONST from '@src/CONST';
import TextInput from './TextInput';
import type {BaseTextInputProps, BaseTextInputRef} from './TextInput/BaseTextInput/types';

type AmountFormProps = {
    /** Amount supplied by the FormProvider */
    value?: string;

    /** Callback to update the amount in the FormProvider */
    onInputChange?: (value: string) => void;
} & Partial<BaseTextInputProps>;

const decimal = 2;

function AmountWithoutCurrencyForm(
    {value: amount, onInputChange, inputID, name, defaultValue, accessibilityLabel, role, label, ...rest}: AmountFormProps,
    ref: ForwardedRef<BaseTextInputRef>,
) {
    const {toLocaleDigit} = useLocalize();

    const currentAmount = useMemo(() => (typeof amount === 'string' ? amount : ''), [amount]);
    const [maxLength, setMaxLength] = useState<number | undefined>(undefined);
    const amountRef = useRef();
    const formattedAmount = replaceAllDigits(currentAmount, toLocaleDigit);
    const selectionRef = useRef({
        start: currentAmount.length,
        end: currentAmount.length,
    });
    /**
     * Sets the selection and the amount accordingly to the value passed to the input
     * @param newAmount - Changed amount from user input
     */
    const setNewAmount = useCallback(
        (e) => {
            // Remove spaces from the newAmount value because Safari on iOS adds spaces when pasting a copied value
            // More info: https://github.com/Expensify/App/issues/16974
            let newAmount = '';
            const formattedAmount = replaceAllDigits(amountRef.current ?? currentAmount, toLocaleDigit);
            const key = e.nativeEvent.key;
            const selection = selectionRef.current;
            if (key === '<' || key === 'Backspace') {
                if (formattedAmount.length > 0) {
                    const selectionStart = selection.start === selection.end ? selection.start - 1 : selection.start;
                    newAmount = `${formattedAmount.substring(0, selectionStart)}${formattedAmount.substring(selection.end)}`;
                }
            } else {
                newAmount = `${formattedAmount.substring(0, selection.start)}${key}${formattedAmount.substring(selection.end)}`;
            }

            const newAmountWithoutSpaces = stripSpacesFromAmount(newAmount);
            const replacedCommasAmount = replaceCommasWithPeriod(newAmountWithoutSpaces);
            const withLeadingZero = addLeadingZero(replacedCommasAmount);
            if (!validateAmount(withLeadingZero, decimal)) {
                return;
            }
            amountRef.current = withLeadingZero;
            onInputChange?.(withLeadingZero);
        },
        [onInputChange],
    );

    return (
        <TextInput
            value={formattedAmount}
            onKeyPress={setNewAmount}
            onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
                const selection = e.nativeEvent.selection;
                selectionRef.current = selection;
                const am = amountRef.current ?? currentAmount;
                const formattedAmount = replaceAllDigits(am, toLocaleDigit);

                if (!formattedAmount.includes('.') || selection.start !== selection.end || selection.start <= formattedAmount.indexOf('.')) {
                    setMaxLength(CONST.IOU.AMOUNT_MAX_LENGTH + (formattedAmount.includes('.') ? formattedAmount.length - formattedAmount.indexOf('.') : 0));
                    return;
                }
                setMaxLength(formattedAmount.split('.')?.[0].length + 1 + decimal);
            }}
            maxLength={maxLength}
            inputID={inputID}
            name={name}
            label={label}
            defaultValue={defaultValue}
            accessibilityLabel={accessibilityLabel}
            role={role}
            ref={ref}
            keyboardType={CONST.KEYBOARD_TYPE.DECIMAL_PAD}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...rest}
        />
    );
}

AmountWithoutCurrencyForm.displayName = 'AmountWithoutCurrencyForm';

export default React.forwardRef(AmountWithoutCurrencyForm);
