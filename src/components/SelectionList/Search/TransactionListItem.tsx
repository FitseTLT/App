import React, {useCallback, useMemo, useRef} from 'react';
import type {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import {getButtonRole} from '@components/Button/utils';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import {useSearchContext} from '@components/Search/SearchContext';
import type {ListItem, TransactionListItemProps, TransactionListItemType} from '@components/SelectionList/types';
import TransactionItemRow from '@components/TransactionItemRow';
import useAnimatedHighlightStyle from '@hooks/useAnimatedHighlightStyle';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useSyncFocus from '@hooks/useSyncFocus';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {handleActionButtonPress as handleActionButtonPressUtil} from '@libs/actions/Search';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import UserInfoAndActionButtonRow from './UserInfoAndActionButtonRow';

function TransactionListItem<TItem extends ListItem>({
    item,
    isFocused,
    showTooltip,
    isDisabled,
    canSelectMultiple,
    onSelectRow,
    onCheckboxPress,
    onFocus,
    onLongPressRow,
    shouldSyncFocus,
    isLoading,
    columns,
}: TransactionListItemProps<TItem>) {
    const transactionItem = item as unknown as TransactionListItemType;
    const styles = useThemeStyles();
    const theme = useTheme();

    const {isLargeScreenWidth, shouldUseNarrowLayout} = useResponsiveLayout();
    const {currentSearchHash, currentSearchKey} = useSearchContext();

    const pressableStyle = [
        styles.transactionListItemStyle,
        !isLargeScreenWidth && styles.pt3,
        item.isSelected && styles.activeComponentBG,
        isLargeScreenWidth ? {...styles.flexRow, ...styles.justifyContentBetween, ...styles.alignItemsCenter} : {...styles.flexColumn, ...styles.alignItemsStretch},
    ];

    const animatedHighlightStyle = useAnimatedHighlightStyle({
        borderRadius: variables.componentBorderRadius,
        shouldHighlight: item?.shouldAnimateInHighlight ?? false,
        highlightColor: theme.messageHighlightBG,
        backgroundColor: theme.highlightBG,
    });

    const {amountColumnSize, dateColumnSize, taxAmountColumnSize} = useMemo(() => {
        return {
            amountColumnSize: transactionItem.isAmountColumnWide ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL,
            taxAmountColumnSize: transactionItem.isTaxAmountColumnWide ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL,
            dateColumnSize: transactionItem.shouldShowYear ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL,
        };
    }, [transactionItem]);

    const handleActionButtonPress = useCallback(() => {
        handleActionButtonPressUtil(currentSearchHash, transactionItem, () => onSelectRow(item), shouldUseNarrowLayout && !!canSelectMultiple, currentSearchKey);
    }, [canSelectMultiple, currentSearchHash, currentSearchKey, item, onSelectRow, shouldUseNarrowLayout, transactionItem]);

    const handleCheckboxPress = useCallback(() => {
        onCheckboxPress?.(item);
    }, [item, onCheckboxPress]);

    const onPress = useCallback(() => {
        onSelectRow(item);
    }, [item, onSelectRow]);

    const onLongPress = useCallback(() => {
        onLongPressRow?.(item);
    }, [item, onLongPressRow]);

    const StyleUtils = useStyleUtils();
    const pressableRef = useRef<View>(null);

    useSyncFocus(pressableRef, !!isFocused, shouldSyncFocus);

    return (
        <OfflineWithFeedback pendingAction={item.pendingAction}>
            <PressableWithFeedback
                ref={pressableRef}
                onLongPress={onLongPress}
                onPress={onPress}
                disabled={isDisabled && !item.isSelected}
                accessibilityLabel={item.text ?? ''}
                role={getButtonRole(true)}
                isNested
                onMouseDown={(e) => e.preventDefault()}
                hoverStyle={[!item.isDisabled && styles.hoveredComponentBG, item.isSelected && styles.activeComponentBG]}
                dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true, [CONST.INNER_BOX_SHADOW_ELEMENT]: false}}
                id={item.keyForList ?? ''}
                style={[
                    pressableStyle,
                    isFocused && StyleUtils.getItemBackgroundColorStyle(!!item.isSelected, !!isFocused, !!item.isDisabled, theme.activeComponentBG, theme.hoverComponentBG),
                ]}
                onFocus={onFocus}
                wrapperStyle={[styles.mb2, styles.mh5, styles.flex1, animatedHighlightStyle, styles.userSelectNone]}
            >
                {!isLargeScreenWidth && (
                    <UserInfoAndActionButtonRow
                        item={transactionItem}
                        handleActionButtonPress={handleActionButtonPress}
                        shouldShowUserInfo={!!transactionItem?.from}
                    />
                )}
                <TransactionItemRow
                    transactionItem={transactionItem}
                    shouldShowTooltip={showTooltip}
                    onButtonPress={handleActionButtonPress}
                    onCheckboxPress={handleCheckboxPress}
                    shouldUseNarrowLayout={!isLargeScreenWidth}
                    columns={columns as Array<ValueOf<typeof CONST.REPORT.TRANSACTION_LIST.COLUMNS>>}
                    isActionLoading={isLoading ?? transactionItem.isActionLoading}
                    isSelected={!!transactionItem.isSelected}
                    dateColumnSize={dateColumnSize}
                    amountColumnSize={amountColumnSize}
                    taxAmountColumnSize={taxAmountColumnSize}
                    shouldShowCheckbox={!!canSelectMultiple}
                />
            </PressableWithFeedback>
        </OfflineWithFeedback>
    );
}

TransactionListItem.displayName = 'TransactionListItem';

export default TransactionListItem;
