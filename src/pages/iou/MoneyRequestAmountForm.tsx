import {useIsFocused} from '@react-navigation/core';
import type {ForwardedRef} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import BigNumberPad from '@components/BigNumberPad';
import Button from '@components/Button';
import FormHelpMessage from '@components/FormHelpMessage';
import * as Expensicons from '@components/Icon/Expensicons';
import MoneyRequestAmountInput from '@components/MoneyRequestAmountInput';
import type {MoneyRequestAmountInputRef} from '@components/MoneyRequestAmountInput';
import ScrollView from '@components/ScrollView';
import SettlementButton from '@components/SettlementButton';
import isTextInputFocused from '@components/TextInput/BaseTextInput/isTextInputFocused';
import useLocalize from '@hooks/useLocalize';
import usePrevious from '@hooks/usePrevious';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {convertToDisplayString, convertToFrontendAmountAsInteger, convertToFrontendAmountAsString} from '@libs/CurrencyUtils';
import {canUseTouchScreen as canUseTouchScreenUtil} from '@libs/DeviceCapabilities';
import {addLeadingZero} from '@libs/MoneyRequestUtils';
import Navigation from '@libs/Navigation/Navigation';
import variables from '@styles/variables';
import type {BaseTextInputRef} from '@src/components/TextInput/BaseTextInput/types';
import CONST from '@src/CONST';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import type {SelectedTabRequest} from '@src/types/onyx';
import type {PaymentMethodType} from '@src/types/onyx/OriginalMessage';

type CurrentMoney = {amount: string; currency: string; paymentMethod?: PaymentMethodType};

type MoneyRequestAmountFormProps = {
    /** IOU amount saved in Onyx */
    amount?: number;

    /** Calculated tax amount based on selected tax rate */
    taxAmount?: number;

    /** Currency chosen by user or saved in Onyx */
    currency?: string;

    /** Whether the amount is being edited or not */
    isEditing?: boolean;

    /** Whether the confirmation screen should be skipped */
    skipConfirmation?: boolean;

    /** Type of the IOU */
    iouType?: ValueOf<typeof CONST.IOU.TYPE>;

    /** The policyID of the request */
    policyID?: string;

    /** Depending on expense report or personal IOU report, respective bank account route */
    bankAccountRoute?: Route;

    /** Whether the currency symbol is pressable */
    isCurrencyPressable?: boolean;

    /** Fired when back button pressed, navigates to currency selection page */
    onCurrencyButtonPress?: () => void;

    /** Fired when submit button pressed, saves the given amount and navigates to the next page */
    onSubmitButtonPress: (currentMoney: CurrentMoney) => void;

    /** The current tab we have navigated to in the expense modal. String that corresponds to the expense type. */
    selectedTab?: SelectedTabRequest;

    /** Whether the user input should be kept or not */
    shouldKeepUserInput?: boolean;

    /** Whether to allow flipping the amount */
    allowFlippingAmount?: boolean;
};

const isAmountInvalid = (amount: string) => !amount.length || parseFloat(amount) < 0.01;
const isTaxAmountInvalid = (currentAmount: string, taxAmount: number, isTaxAmountForm: boolean, currency: string) =>
    isTaxAmountForm && Number.parseFloat(currentAmount) > convertToFrontendAmountAsInteger(Math.abs(taxAmount), currency);

const AMOUNT_VIEW_ID = 'amountView';
const NUM_PAD_CONTAINER_VIEW_ID = 'numPadContainerView';
const NUM_PAD_VIEW_ID = 'numPadView';

function MoneyRequestAmountForm(
    {
        amount = 0,
        taxAmount = 0,
        currency = CONST.CURRENCY.USD,
        isCurrencyPressable = true,
        isEditing = false,
        skipConfirmation = false,
        iouType = CONST.IOU.TYPE.SUBMIT,
        policyID = '',
        bankAccountRoute = '',
        onCurrencyButtonPress,
        onSubmitButtonPress,
        selectedTab = CONST.TAB_REQUEST.MANUAL,
        shouldKeepUserInput = false,
        allowFlippingAmount = false,
    }: MoneyRequestAmountFormProps,
    forwardedRef: ForwardedRef<BaseTextInputRef>,
) {
    const styles = useThemeStyles();
    const {isExtraSmallScreenHeight} = useResponsiveLayout();
    const {translate} = useLocalize();

    const textInput = useRef<BaseTextInputRef | null>(null);
    const moneyRequestAmountInput = useRef<MoneyRequestAmountInputRef | null>(null);

    const [isNegative, setIsNegative] = useState(false);

    const [formError, setFormError] = useState<string>('');
    const [shouldUpdateSelection, setShouldUpdateSelection] = useState(true);

    const isFocused = useIsFocused();
    const wasFocused = usePrevious(isFocused);

    const formattedTaxAmount = convertToDisplayString(Math.abs(taxAmount), currency);

    const absoluteAmount = Math.abs(amount);

    /**
     * Event occurs when a user presses a mouse button over an DOM element.
     */
    const onMouseDown = (event: React.MouseEvent<Element, MouseEvent>, ids: string[]) => {
        const relatedTargetId = (event.nativeEvent?.target as HTMLElement)?.id;
        if (!ids.includes(relatedTargetId)) {
            return;
        }

        const selection = moneyRequestAmountInput.current?.getSelection() ?? {start: 0, end: 0};

        event.preventDefault();
        moneyRequestAmountInput.current?.changeSelection({
            start: selection.end,
            end: selection.end,
        });

        if (!textInput.current) {
            return;
        }

        if (!isTextInputFocused(textInput)) {
            textInput.current.focus();
        }
    };

    useEffect(() => {
        if (!isFocused || wasFocused) {
            return;
        }
        const selection = moneyRequestAmountInput.current?.getSelection() ?? {start: 0, end: 0};

        moneyRequestAmountInput.current?.changeSelection({
            start: selection.end,
            end: selection.end,
        });
    }, [isFocused, wasFocused]);

    const initializeAmount = useCallback(
        (newAmount: number) => {
            const frontendAmount = newAmount ? convertToFrontendAmountAsString(newAmount, currency) : '';
            moneyRequestAmountInput.current?.changeAmount(frontendAmount);
            moneyRequestAmountInput.current?.changeSelection({
                start: frontendAmount.length,
                end: frontendAmount.length,
            });
        },
        [currency],
    );

    useEffect(() => {
        if (amount >= 0) {
            return;
        }

        setIsNegative(true);
    }, [amount]);

    useEffect(() => {
        if (!currency || typeof absoluteAmount !== 'number') {
            return;
        }
        initializeAmount(absoluteAmount);
        // we want to re-initialize the state only when the selected tab
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [selectedTab]);

    /**
     * Update amount with number or Backspace pressed for BigNumberPad.
     * Validate new amount with decimal number regex up to 6 digits and 2 decimal digit to enable Next button
     */
    const updateAmountNumberPad = useCallback(
        (key: string) => {
            if (shouldUpdateSelection && !isTextInputFocused(textInput)) {
                textInput.current?.focus();
            }
            const currentAmount = moneyRequestAmountInput.current?.getAmount() ?? '';
            const selection = moneyRequestAmountInput.current?.getSelection() ?? {start: 0, end: 0};
            // Backspace button is pressed
            if (key === '<' || key === 'Backspace') {
                if (currentAmount.length > 0) {
                    const selectionStart = selection.start === selection.end ? selection.start - 1 : selection.start;
                    const newAmount = `${currentAmount.substring(0, selectionStart)}${currentAmount.substring(selection.end)}`;
                    moneyRequestAmountInput.current?.setNewAmount(addLeadingZero(newAmount));
                }
                return;
            }
            const newAmount = addLeadingZero(`${currentAmount.substring(0, selection.start)}${key}${currentAmount.substring(selection.end)}`);
            moneyRequestAmountInput.current?.setNewAmount(newAmount);
        },
        [shouldUpdateSelection],
    );

    /**
     * Update long press value, to remove items pressing on <
     *
     * @param value - Changed text from user input
     */
    const updateLongPressHandlerState = useCallback((value: boolean) => {
        setShouldUpdateSelection(!value);
        if (!value && !isTextInputFocused(textInput)) {
            textInput.current?.focus();
        }
    }, []);

    /**
     * Submit amount and navigate to a proper page
     */
    const submitAndNavigateToNextPage = useCallback(
        (iouPaymentType?: PaymentMethodType | undefined) => {
            const isTaxAmountForm = Navigation.getActiveRoute().includes('taxAmount');

            // Skip the check for tax amount form as 0 is a valid input
            const currentAmount = moneyRequestAmountInput.current?.getAmount() ?? '';
            if (!currentAmount.length || (!isTaxAmountForm && isAmountInvalid(currentAmount))) {
                setFormError(translate('iou.error.invalidAmount'));
                return;
            }

            if (isTaxAmountInvalid(currentAmount, taxAmount, isTaxAmountForm, currency)) {
                setFormError(translate('iou.error.invalidTaxAmount', {amount: formattedTaxAmount}));
                return;
            }

            const newAmount = isNegative ? `-${currentAmount}` : currentAmount;

            onSubmitButtonPress({amount: newAmount, currency, paymentMethod: iouPaymentType});
        },
        [taxAmount, currency, isNegative, onSubmitButtonPress, translate, formattedTaxAmount],
    );

    const buttonText: string = useMemo(() => {
        if (skipConfirmation) {
            if (iouType === CONST.IOU.TYPE.SPLIT) {
                return translate('iou.splitExpense');
            }
            return translate('iou.createExpense');
        }
        return isEditing ? translate('common.save') : translate('common.next');
    }, [skipConfirmation, iouType, isEditing, translate]);

    const canUseTouchScreen = canUseTouchScreenUtil();

    useEffect(() => {
        setFormError('');
    }, [selectedTab]);

    const toggleNegative = useCallback(() => {
        setIsNegative((prevIsNegative) => !prevIsNegative);
    }, []);

    const clearNegative = useCallback(() => {
        setIsNegative(false);
    }, []);

    return (
        <ScrollView contentContainerStyle={styles.flexGrow1}>
            <View style={[styles.flex1, styles.justifyContentCenter, styles.alignItemsCenter]}>
                <View
                    id={AMOUNT_VIEW_ID}
                    onMouseDown={(event) => onMouseDown(event, [AMOUNT_VIEW_ID])}
                    style={[styles.moneyRequestAmountContainer, styles.flexRow, styles.w100, styles.alignItemsCenter, styles.justifyContentCenter]}
                >
                    <MoneyRequestAmountInput
                        amount={absoluteAmount}
                        autoGrowExtraSpace={variables.w80}
                        currency={currency}
                        isCurrencyPressable={false}
                        onCurrencyButtonPress={onCurrencyButtonPress}
                        onAmountChange={() => {
                            if (!formError) {
                                return;
                            }
                            setFormError('');
                        }}
                        shouldUpdateSelection={shouldUpdateSelection}
                        ref={(ref) => {
                            if (typeof forwardedRef === 'function') {
                                forwardedRef(ref);
                            } else if (forwardedRef?.current) {
                                // eslint-disable-next-line no-param-reassign
                                forwardedRef.current = ref;
                            }
                            textInput.current = ref;
                        }}
                        shouldKeepUserInput={shouldKeepUserInput}
                        moneyRequestAmountInputRef={moneyRequestAmountInput}
                        inputStyle={[styles.iouAmountTextInput]}
                        containerStyle={[styles.iouAmountTextInputContainer]}
                        toggleNegative={toggleNegative}
                        clearNegative={clearNegative}
                        isNegative={isNegative}
                        allowFlippingAmount={allowFlippingAmount}
                    />
                    {!!formError && (
                        <FormHelpMessage
                            style={[styles.pAbsolute, styles.b0, styles.mb0, styles.ph5, styles.w100]}
                            isError
                            message={formError}
                        />
                    )}
                </View>
                {isCurrencyPressable && !canUseTouchScreen && (
                    <Button
                        shouldShowRightIcon
                        small
                        iconRight={Expensicons.DownArrow}
                        onPress={onCurrencyButtonPress}
                        style={styles.minWidth18}
                        isContentCentered
                        text={currency}
                    />
                )}
            </View>
            <View>
                <View style={[styles.flexRow, styles.justifyContentCenter, styles.mb2, styles.gap2]}>
                    {isCurrencyPressable && canUseTouchScreen && (
                        <Button
                            shouldShowRightIcon
                            small
                            iconRight={Expensicons.DownArrow}
                            onPress={onCurrencyButtonPress}
                            style={styles.minWidth18}
                            isContentCentered
                            text={currency}
                        />
                    )}
                    {allowFlippingAmount && canUseTouchScreen && (
                        <Button
                            shouldShowRightIcon
                            small
                            iconRight={Expensicons.PlusMinus}
                            onPress={toggleNegative}
                            style={styles.minWidth18}
                            isContentCentered
                            text={translate('iou.flip')}
                        />
                    )}
                </View>
            </View>
            <View
                onMouseDown={(event) => onMouseDown(event, [NUM_PAD_CONTAINER_VIEW_ID, NUM_PAD_VIEW_ID])}
                style={[styles.w100, styles.justifyContentEnd, styles.pageWrapper, styles.pt0]}
                id={NUM_PAD_CONTAINER_VIEW_ID}
            >
                {canUseTouchScreen ? (
                    <BigNumberPad
                        id={NUM_PAD_VIEW_ID}
                        numberPressed={updateAmountNumberPad}
                        longPressHandlerStateChanged={updateLongPressHandlerState}
                    />
                ) : null}
                <View style={styles.w100}>
                    {iouType === CONST.IOU.TYPE.PAY && skipConfirmation ? (
                        <SettlementButton
                            pressOnEnter
                            onPress={submitAndNavigateToNextPage}
                            enablePaymentsRoute={ROUTES.IOU_SEND_ENABLE_PAYMENTS}
                            addBankAccountRoute={bankAccountRoute}
                            addDebitCardRoute={ROUTES.IOU_SEND_ADD_DEBIT_CARD}
                            currency={currency ?? CONST.CURRENCY.USD}
                            policyID={policyID}
                            style={[styles.w100, canUseTouchScreen ? styles.mt5 : styles.mt3]}
                            buttonSize={CONST.DROPDOWN_BUTTON_SIZE.LARGE}
                            kycWallAnchorAlignment={{
                                horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT,
                                vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
                            }}
                            paymentMethodDropdownAnchorAlignment={{
                                horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.RIGHT,
                                vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
                            }}
                            shouldShowPersonalBankAccountOption
                            enterKeyEventListenerPriority={1}
                        />
                    ) : (
                        <Button
                            success
                            // Prevent bubbling on edit amount Page to prevent double page submission when two CTA are stacked.
                            allowBubble={!isEditing}
                            pressOnEnter
                            medium={isExtraSmallScreenHeight}
                            large={!isExtraSmallScreenHeight}
                            style={[styles.w100, canUseTouchScreen ? styles.mt5 : styles.mt3]}
                            onPress={() => submitAndNavigateToNextPage()}
                            text={buttonText}
                            testID="next-button"
                        />
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

MoneyRequestAmountForm.displayName = 'MoneyRequestAmountForm';

export default React.forwardRef(MoneyRequestAmountForm);
export type {CurrentMoney};
