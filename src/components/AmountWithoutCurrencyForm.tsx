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
    /**
     * Sets the selection and the amount accordingly to the value passed to the input
     * @param newAmount - Changed amount from user input
     */
    const setNewAmount = useCallback(
        (newAmount: string) => {
            // Remove spaces from the newAmount value because Safari on iOS adds spaces when pasting a copied value
            // More info: https://github.com/Expensify/App/issues/16974
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
    const formattedAmount = replaceAllDigits(currentAmount, toLocaleDigit);

    return (
        <TextInput
            value={formattedAmount}
            onChangeText={setNewAmount}
            onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
                const selection = e.nativeEvent.selection;
                const am = amountRef.current ?? currentAmount;
                const formattedAmount = replaceAllDigits(am, toLocaleDigit);

                if (!formattedAmount.includes('.') || selection.start !== selection.end || selection.start <= formattedAmount.indexOf('.')) {
                    setMaxLength(undefined);
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
