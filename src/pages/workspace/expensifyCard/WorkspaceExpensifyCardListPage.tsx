import React, {useCallback, useContext, useMemo} from 'react';
import type {ListRenderItemInfo} from 'react-native';
import {FlatList, View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import ExpensifyCardImage from '@assets/images/expensify-card.svg';
import Button from '@components/Button';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import {DelegateNoAccessContext} from '@components/DelegateNoAccessModalProvider';
import FeedSelector from '@components/FeedSelector';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {Gear, Plus} from '@components/Icon/Expensicons';
import {HandCard} from '@components/Icon/Illustrations';
import {LockedAccountContext} from '@components/LockedAccountModalProvider';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import {PressableWithFeedback} from '@components/Pressable';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import SearchBar from '@components/SearchBar';
import Text from '@components/Text';
import useBottomSafeSafeAreaPaddingStyle from '@hooks/useBottomSafeSafeAreaPaddingStyle';
import useEmptyViewHeaderHeight from '@hooks/useEmptyViewHeaderHeight';
import useExpensifyCardFeeds from '@hooks/useExpensifyCardFeeds';
import useHandleBackButton from '@hooks/useHandleBackButton';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSearchResults from '@hooks/useSearchResults';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {setIssueNewCardStepAndData} from '@libs/actions/Card';
import {clearDeletePaymentMethodError} from '@libs/actions/PaymentMethods';
import {filterCardsByPersonalDetails, getCardsByCardholderName, sortCardsByCardholderName} from '@libs/CardUtils';
import type {PlatformStackRouteProp} from '@libs/Navigation/PlatformStackNavigation/types';
import {getDescriptionForPolicyDomainCard, getMemberAccountIDsForWorkspace} from '@libs/PolicyUtils';
import Navigation from '@navigation/Navigation';
import type {WorkspaceSplitNavigatorParamList} from '@navigation/types';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {Card, WorkspaceCardsList} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import EmptyCardView from './EmptyCardView';
import WorkspaceCardListHeader from './WorkspaceCardListHeader';
import WorkspaceCardListLabels from './WorkspaceCardListLabels';
import WorkspaceCardListRow from './WorkspaceCardListRow';

type WorkspaceExpensifyCardListPageProps = {
    /** Route from navigation */
    route: PlatformStackRouteProp<WorkspaceSplitNavigatorParamList, typeof SCREENS.WORKSPACE.EXPENSIFY_CARD>;

    /** List of Expensify cards */
    cardsList: OnyxEntry<WorkspaceCardsList>;

    /** Fund ID */
    fundID: number;
};

function WorkspaceExpensifyCardListPage({route, cardsList, fundID}: WorkspaceExpensifyCardListPageProps) {
    const {shouldUseNarrowLayout, isMediumScreenWidth} = useResponsiveLayout();
    const {translate, localeCompare} = useLocalize();
    const styles = useThemeStyles();

    const policyID = route.params.policyID;
    const policy = usePolicy(policyID);
    const workspaceAccountID = policy?.workspaceAccountID ?? CONST.DEFAULT_NUMBER_ID;
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {canBeMissing: false});
    const [cardOnWaitlist] = useOnyx(`${ONYXKEYS.COLLECTION.NVP_EXPENSIFY_ON_CARD_WAITLIST}${policyID}`, {canBeMissing: true});
    const [cardSettings] = useOnyx(`${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${fundID}`, {canBeMissing: false});
    const allExpensifyCardFeeds = useExpensifyCardFeeds(policyID);

    const shouldShowSelector = Object.keys(allExpensifyCardFeeds ?? {}).length > 1;

    const {isActingAsDelegate, showDelegateNoAccessModal} = useContext(DelegateNoAccessContext);
    const {isAccountLocked, showLockedAccountModal} = useContext(LockedAccountContext);

    const shouldChangeLayout = isMediumScreenWidth || shouldUseNarrowLayout;

    const isBankAccountVerified = !cardOnWaitlist;
    const {windowHeight} = useWindowDimensions();
    const headerHeight = useEmptyViewHeaderHeight(shouldUseNarrowLayout, isBankAccountVerified);

    // Currently Expensify Cards only support USD, once support for more currencies is implemented, we will need to update this
    const settlementCurrency = CONST.CURRENCY.USD;

    const allCards = useMemo(() => {
        const policyMembersAccountIDs = Object.values(getMemberAccountIDsForWorkspace(policy?.employeeList));
        return getCardsByCardholderName(cardsList, policyMembersAccountIDs);
    }, [cardsList, policy?.employeeList]);

    const filterCard = useCallback((card: Card, searchInput: string) => filterCardsByPersonalDetails(card, searchInput, personalDetails), [personalDetails]);
    const sortCards = useCallback((cards: Card[]) => sortCardsByCardholderName(cards, personalDetails, localeCompare), [personalDetails, localeCompare]);
    const [inputValue, setInputValue, filteredSortedCards] = useSearchResults(allCards, filterCard, sortCards);

    const handleIssueCardPress = () => {
        if (isAccountLocked) {
            showLockedAccountModal();
            return;
        }
        if (isActingAsDelegate) {
            showDelegateNoAccessModal();
            return;
        }
        const activeRoute = Navigation.getActiveRoute();
        setIssueNewCardStepAndData({policyID, isChangeAssigneeDisabled: false});
        Navigation.navigate(ROUTES.WORKSPACE_EXPENSIFY_CARD_ISSUE_NEW.getRoute(policyID, activeRoute));
    };

    const secondaryActions = useMemo(
        () => [
            {
                icon: Gear,
                text: translate('common.settings'),
                onSelected: () => Navigation.navigate(ROUTES.WORKSPACE_EXPENSIFY_CARD_SETTINGS.getRoute(policyID)),
                value: CONST.POLICY.SECONDARY_ACTIONS.SETTINGS,
            },
        ],
        [policyID, translate],
    );

    const getHeaderButtons = () => (
        <View style={[styles.flexRow, styles.gap2, !shouldShowSelector && shouldUseNarrowLayout && styles.mb3, shouldShowSelector && shouldChangeLayout && styles.mt3]}>
            <Button
                success
                onPress={handleIssueCardPress}
                icon={Plus}
                text={translate('workspace.expensifyCard.issueCard')}
                style={shouldChangeLayout && styles.flex1}
            />
            <ButtonWithDropdownMenu
                success={false}
                onPress={() => {}}
                shouldAlwaysShowDropdownMenu
                customText={translate('common.more')}
                options={secondaryActions}
                isSplitButton={false}
                wrapperStyle={styles.flexGrow0}
            />
        </View>
    );

    const renderItem = useCallback(
        ({item, index}: ListRenderItemInfo<Card>) => (
            <OfflineWithFeedback
                key={`${item.nameValuePairs?.cardTitle}_${index}`}
                pendingAction={item.pendingAction}
                errorRowStyles={styles.ph5}
                errors={item.errors}
                onClose={() => clearDeletePaymentMethodError(`${ONYXKEYS.COLLECTION.WORKSPACE_CARDS_LIST}${workspaceAccountID}_${CONST.EXPENSIFY_CARD.BANK}`, item.cardID)}
            >
                <PressableWithFeedback
                    role={CONST.ROLE.BUTTON}
                    style={[styles.mh5, styles.br3, styles.mb3, styles.highlightBG]}
                    accessibilityLabel="row"
                    hoverStyle={[styles.hoveredComponentBG]}
                    onPress={() => Navigation.navigate(ROUTES.WORKSPACE_EXPENSIFY_CARD_DETAILS.getRoute(policyID, item.cardID.toString()))}
                >
                    <WorkspaceCardListRow
                        lastFourPAN={item.lastFourPAN ?? ''}
                        cardholder={personalDetails?.[item.accountID ?? CONST.DEFAULT_NUMBER_ID]}
                        limit={item.nameValuePairs?.unapprovedExpenseLimit ?? 0}
                        name={item.nameValuePairs?.cardTitle ?? ''}
                        currency={settlementCurrency}
                        isVirtual={!!item.nameValuePairs?.isVirtual}
                    />
                </PressableWithFeedback>
            </OfflineWithFeedback>
        ),
        [personalDetails, settlementCurrency, policyID, workspaceAccountID, styles],
    );

    const isSearchEmpty = filteredSortedCards.length === 0 && inputValue.length > 0;

    const renderListHeader = (
        <>
            <View style={[styles.appBG, styles.flexShrink0, styles.flexGrow1]}>
                <WorkspaceCardListLabels
                    policyID={policyID}
                    cardSettings={cardSettings}
                />
                {allCards.length > CONST.SEARCH_ITEM_LIMIT && (
                    <SearchBar
                        label={translate('workspace.expensifyCard.findCard')}
                        inputValue={inputValue}
                        onChangeText={setInputValue}
                        shouldShowEmptyState={isSearchEmpty}
                        style={[styles.mb0, styles.mt5]}
                    />
                )}
            </View>
            {!isSearchEmpty && <WorkspaceCardListHeader cardSettings={cardSettings} />}
        </>
    );

    const bottomSafeAreaPaddingStyle = useBottomSafeSafeAreaPaddingStyle();

    const handleBackButtonPress = () => {
        Navigation.popToSidebar();
        return true;
    };

    useHandleBackButton(handleBackButtonPress);

    return (
        <ScreenWrapper
            enableEdgeToEdgeBottomSafeAreaPadding
            shouldEnablePickerAvoiding={false}
            shouldShowOfflineIndicatorInWideScreen
            shouldEnableMaxHeight
            testID={WorkspaceExpensifyCardListPage.displayName}
        >
            <HeaderWithBackButton
                icon={HandCard}
                shouldUseHeadlineHeader
                title={translate('workspace.common.expensifyCard')}
                shouldShowBackButton={shouldUseNarrowLayout}
                onBackButtonPress={handleBackButtonPress}
            >
                {!shouldShowSelector && !shouldUseNarrowLayout && isBankAccountVerified && getHeaderButtons()}
            </HeaderWithBackButton>
            {!shouldShowSelector && shouldUseNarrowLayout && isBankAccountVerified && <View style={styles.ph5}>{getHeaderButtons()}</View>}
            {shouldShowSelector && (
                <View style={[styles.w100, styles.ph5, styles.pb3, !shouldChangeLayout && [styles.flexRow, styles.alignItemsCenter, styles.justifyContentBetween]]}>
                    <FeedSelector
                        onFeedSelect={() => Navigation.navigate(ROUTES.WORKSPACE_EXPENSIFY_CARD_SELECT_FEED.getRoute(policyID))}
                        cardIcon={ExpensifyCardImage}
                        feedName={translate('workspace.common.expensifyCard')}
                        supportingText={getDescriptionForPolicyDomainCard(cardSettings?.domainName ?? '')}
                    />
                    {isBankAccountVerified && getHeaderButtons()}
                </View>
            )}
            {isEmptyObject(cardsList) ? (
                <EmptyCardView isBankAccountVerified={isBankAccountVerified} />
            ) : (
                <ScrollView
                    addBottomSafeAreaPadding
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{height: windowHeight - headerHeight}}>
                        <FlatList
                            data={filteredSortedCards}
                            renderItem={renderItem}
                            ListHeaderComponent={renderListHeader}
                            contentContainerStyle={bottomSafeAreaPaddingStyle}
                            keyboardShouldPersistTaps="handled"
                        />
                    </View>
                    <Text style={[styles.textMicroSupporting, styles.m5]}>{translate('workspace.expensifyCard.disclaimer')}</Text>
                </ScrollView>
            )}
        </ScreenWrapper>
    );
}

WorkspaceExpensifyCardListPage.displayName = 'WorkspaceExpensifyCardListPage';

export default WorkspaceExpensifyCardListPage;
