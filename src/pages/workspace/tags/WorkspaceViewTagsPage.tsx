import {useIsFocused} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, InteractionManager, View} from 'react-native';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import type {DropdownOption} from '@components/ButtonWithDropdownMenu/types';
import ConfirmModal from '@components/ConfirmModal';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import SearchBar from '@components/SearchBar';
import ListItemRightCaretWithLabel from '@components/SelectionList/ListItemRightCaretWithLabel';
import TableListItem from '@components/SelectionList/TableListItem';
import SelectionListWithModal from '@components/SelectionListWithModal';
import CustomListHeader from '@components/SelectionListWithModal/CustomListHeader';
import Switch from '@components/Switch';
import useFilteredSelection from '@hooks/useFilteredSelection';
import useLocalize from '@hooks/useLocalize';
import useMobileSelectionMode from '@hooks/useMobileSelectionMode';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSearchBackPress from '@hooks/useSearchBackPress';
import useSearchResults from '@hooks/useSearchResults';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';
import {
    clearPolicyTagErrors,
    clearPolicyTagListErrorField,
    clearPolicyTagListErrors,
    deletePolicyTags,
    openPolicyTagsPage,
    setPolicyTagsRequired,
    setWorkspaceTagEnabled,
} from '@libs/actions/Policy/Tag';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import {isDisablingOrDeletingLastEnabledTag, isMakingLastRequiredTagListOptional} from '@libs/OptionsListUtils';
import {getCleanedTagName, getTagListName, hasDependentTags as hasDependentTagsPolicyUtils, isMultiLevelTags as isMultiLevelTagsPolicyUtils} from '@libs/PolicyUtils';
import StringUtils from '@libs/StringUtils';
import type {SettingsNavigatorParamList} from '@navigation/types';
import NotFoundPage from '@pages/ErrorPage/NotFoundPage';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import ToggleSettingOptionRow from '@pages/workspace/workflows/ToggleSettingsOptionRow';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {PolicyTag} from '@src/types/onyx';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type {TagListItem} from './types';

type WorkspaceViewTagsProps =
    | PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.TAG_LIST_VIEW>
    | PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.SETTINGS_TAGS.SETTINGS_TAG_LIST_VIEW>;

function WorkspaceViewTagsPage({route}: WorkspaceViewTagsProps) {
    // We need to use isSmallScreenWidth instead of shouldUseNarrowLayout for the small screen selection mode
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {shouldUseNarrowLayout, isSmallScreenWidth} = useResponsiveLayout();
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate, localeCompare} = useLocalize();
    const dropdownButtonRef = useRef<View>(null);
    const [isDeleteTagsConfirmModalVisible, setIsDeleteTagsConfirmModalVisible] = useState(false);
    const isFocused = useIsFocused();
    const policyID = route.params.policyID;
    const backTo = route.params.backTo;
    const policy = usePolicy(policyID);
    const [policyTags] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`, {canBeMissing: false});
    const isMobileSelectionModeEnabled = useMobileSelectionMode();
    const currentTagListName = useMemo(() => getTagListName(policyTags, route.params.orderWeight), [policyTags, route.params.orderWeight]);
    const hasDependentTags = useMemo(() => hasDependentTagsPolicyUtils(policy, policyTags), [policy, policyTags]);
    const currentPolicyTag = policyTags?.[currentTagListName];
    const isQuickSettingsFlow = route.name === SCREENS.SETTINGS_TAGS.SETTINGS_TAG_LIST_VIEW;
    const [isCannotMakeAllTagsOptionalModalVisible, setIsCannotMakeAllTagsOptionalModalVisible] = useState(false);
    const [isCannotDeleteOrDisableLastTagModalVisible, setIsCannotDeleteOrDisableLastTagModalVisible] = useState(false);
    const fetchTags = useCallback(() => {
        openPolicyTagsPage(policyID);
    }, [policyID]);

    const filterFunction = useCallback((tag: PolicyTag | undefined) => !!tag && tag.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE, []);

    const [selectedTags, setSelectedTags] = useFilteredSelection(currentPolicyTag?.tags, filterFunction);

    const {isOffline} = useNetwork({onReconnect: fetchTags});
    const canSelectMultiple = useMemo(() => {
        if (hasDependentTags) {
            return false;
        }
        return isSmallScreenWidth ? isMobileSelectionModeEnabled : true;
    }, [hasDependentTags, isSmallScreenWidth, isMobileSelectionModeEnabled]);

    useEffect(() => {
        if (isFocused) {
            return;
        }

        return () => {
            turnOffMobileSelectionMode();
        };
    }, [isFocused]);

    useSearchBackPress({
        onClearSelection: () => {
            setSelectedTags([]);
        },
        onNavigationCallBack: () => Navigation.goBack(isQuickSettingsFlow ? ROUTES.SETTINGS_TAGS_ROOT.getRoute(policyID) : undefined),
    });

    const updateWorkspaceTagEnabled = useCallback(
        (value: boolean, tagName: string) => {
            setWorkspaceTagEnabled(policyID, {[tagName]: {name: tagName, enabled: value}}, route.params.orderWeight);
        },
        [policyID, route.params.orderWeight],
    );

    const tagList = useMemo<TagListItem[]>(
        () =>
            Object.values(currentPolicyTag?.tags ?? {}).map((tag) => ({
                value: tag.name,
                text: hasDependentTags ? tag.name : getCleanedTagName(tag.name),
                keyForList: hasDependentTags ? `${tag.name}-${tag.rules?.parentTagsFilter ?? ''}` : tag.name,
                isSelected: selectedTags.includes(tag.name) && canSelectMultiple,
                pendingAction: tag.pendingAction,
                rules: tag.rules,
                errors: tag.errors ?? undefined,
                enabled: tag.enabled,
                isDisabled: tag.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
                rightElement: hasDependentTags ? (
                    <ListItemRightCaretWithLabel shouldShowCaret />
                ) : (
                    <Switch
                        isOn={tag.enabled}
                        disabled={tag.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE}
                        accessibilityLabel={translate('workspace.tags.enableTag')}
                        onToggle={(newValue: boolean) => {
                            if (isDisablingOrDeletingLastEnabledTag(currentPolicyTag, [tag])) {
                                setIsCannotDeleteOrDisableLastTagModalVisible(true);
                                return;
                            }
                            updateWorkspaceTagEnabled(newValue, tag.name);
                        }}
                        showLockIcon={isDisablingOrDeletingLastEnabledTag(currentPolicyTag, [tag])}
                    />
                ),
            })),
        [currentPolicyTag, hasDependentTags, selectedTags, canSelectMultiple, translate, updateWorkspaceTagEnabled],
    );

    const filterTag = useCallback((tag: TagListItem, searchInput: string) => {
        const tagText = StringUtils.normalize(tag.text?.toLowerCase() ?? '');
        const tagValue = StringUtils.normalize(tag.text?.toLowerCase() ?? '');
        const normalizedSearchInput = StringUtils.normalize(searchInput.toLowerCase() ?? '');
        return tagText.includes(normalizedSearchInput) || tagValue.includes(normalizedSearchInput);
    }, []);
    const sortTags = useCallback((tags: TagListItem[]) => tags.sort((tagA, tagB) => localeCompare(tagA.value, tagB.value)), [localeCompare]);
    const [inputValue, setInputValue, filteredTagList] = useSearchResults(tagList, filterTag, sortTags);

    const tagListKeyedByName = useMemo(
        () =>
            filteredTagList.reduce<Record<string, TagListItem>>((acc, tag) => {
                acc[tag.value] = tag;
                return acc;
            }, {}),
        [filteredTagList],
    );

    if (!currentPolicyTag) {
        return <NotFoundPage />;
    }

    const toggleTag = (tag: TagListItem) => {
        setSelectedTags((prev) => {
            if (prev.includes(tag.value)) {
                return prev.filter((selectedTag) => selectedTag !== tag.value);
            }
            return [...prev, tag.value];
        });
    };

    const toggleAllTags = () => {
        const availableTags = filteredTagList.filter((tag) => tag.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
        const anySelected = availableTags.some((tag) => selectedTags.includes(tag.value));

        setSelectedTags(anySelected ? [] : availableTags.map((tag) => tag.value));
    };

    const getCustomListHeader = () => {
        if (filteredTagList.length === 0) {
            return null;
        }
        return (
            <CustomListHeader
                canSelectMultiple={canSelectMultiple}
                leftHeaderText={translate('common.name')}
                rightHeaderText={hasDependentTags ? undefined : translate('common.enabled')}
            />
        );
    };

    const navigateToTagSettings = (tag: TagListItem) => {
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_TAG_SETTINGS.getRoute(policyID, route.params.orderWeight, tag.value, backTo)
                : ROUTES.WORKSPACE_TAG_SETTINGS.getRoute(policyID, route.params.orderWeight, tag.value, tag?.rules?.parentTagsFilter ?? undefined),
        );
    };

    const deleteTags = () => {
        deletePolicyTags(policyID, selectedTags);
        setIsDeleteTagsConfirmModalVisible(false);

        InteractionManager.runAfterInteractions(() => {
            setSelectedTags([]);
        });
    };

    const isLoading = !isOffline && policyTags === undefined;

    const listHeaderContent =
        tagList.length > CONST.SEARCH_ITEM_LIMIT ? (
            <SearchBar
                inputValue={inputValue}
                onChangeText={setInputValue}
                label={translate('workspace.tags.findTag')}
                shouldShowEmptyState={filteredTagList.length === 0 && !isLoading}
            />
        ) : undefined;

    const getHeaderButtons = () => {
        if ((!isSmallScreenWidth && selectedTags.length === 0) || (isSmallScreenWidth && !isMobileSelectionModeEnabled)) {
            return null;
        }

        const options: Array<DropdownOption<DeepValueOf<typeof CONST.POLICY.BULK_ACTION_TYPES>>> = [];
        const isThereAnyAccountingConnection = Object.keys(policy?.connections ?? {}).length !== 0;
        const isMultiLevelTags = isMultiLevelTagsPolicyUtils(policyTags);

        if (!isThereAnyAccountingConnection && !isMultiLevelTags && selectedTags.length > 0) {
            options.push({
                icon: Expensicons.Trashcan,
                text: translate(selectedTags.length === 1 ? 'workspace.tags.deleteTag' : 'workspace.tags.deleteTags'),
                value: CONST.POLICY.BULK_ACTION_TYPES.DELETE,
                onSelected: () => setIsDeleteTagsConfirmModalVisible(true),
            });
        }

        let enabledTagCount = 0;
        const tagsToDisable: Record<string, {name: string; enabled: boolean}> = {};
        let disabledTagCount = 0;
        const tagsToEnable: Record<string, {name: string; enabled: boolean}> = {};
        for (const tagName of selectedTags) {
            if (tagListKeyedByName[tagName]?.enabled) {
                enabledTagCount++;
                tagsToDisable[tagName] = {
                    name: tagName,
                    enabled: false,
                };
            } else {
                disabledTagCount++;
                tagsToEnable[tagName] = {
                    name: tagName,
                    enabled: true,
                };
            }
        }

        if (enabledTagCount > 0) {
            const selectedTagsObject = selectedTags.map((key) => currentPolicyTag?.tags[key]);
            options.push({
                icon: Expensicons.Close,
                text: translate(enabledTagCount === 1 ? 'workspace.tags.disableTag' : 'workspace.tags.disableTags'),
                value: CONST.POLICY.BULK_ACTION_TYPES.DISABLE,
                onSelected: () => {
                    if (isDisablingOrDeletingLastEnabledTag(currentPolicyTag, selectedTagsObject)) {
                        setIsCannotDeleteOrDisableLastTagModalVisible(true);
                        return;
                    }
                    setSelectedTags([]);
                    setWorkspaceTagEnabled(policyID, tagsToDisable, route.params.orderWeight);
                },
            });
        }

        if (disabledTagCount > 0) {
            options.push({
                icon: Expensicons.Checkmark,
                text: translate(disabledTagCount === 1 ? 'workspace.tags.enableTag' : 'workspace.tags.enableTags'),
                value: CONST.POLICY.BULK_ACTION_TYPES.ENABLE,
                onSelected: () => {
                    setSelectedTags([]);
                    setWorkspaceTagEnabled(policyID, tagsToEnable, route.params.orderWeight);
                },
            });
        }

        return (
            <ButtonWithDropdownMenu
                buttonRef={dropdownButtonRef}
                onPress={() => null}
                shouldAlwaysShowDropdownMenu
                isSplitButton={false}
                buttonSize={CONST.DROPDOWN_BUTTON_SIZE.MEDIUM}
                customText={translate('workspace.common.selected', {count: selectedTags.length})}
                options={options}
                style={[shouldUseNarrowLayout && styles.flexGrow1, shouldUseNarrowLayout && styles.mb3]}
                isDisabled={!selectedTags.length}
            />
        );
    };

    if (!!currentPolicyTag?.required && !Object.values(currentPolicyTag?.tags ?? {}).some((tag) => tag.enabled)) {
        setPolicyTagsRequired(policyID, false, route.params.orderWeight);
    }

    const navigateToEditTag = () => {
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_TAGS_EDIT.getRoute(route.params.policyID, currentPolicyTag?.orderWeight ?? 0, backTo)
                : ROUTES.WORKSPACE_EDIT_TAGS.getRoute(route.params.policyID, currentPolicyTag?.orderWeight ?? 0, Navigation.getActiveRoute()),
        );
    };

    const selectionModeHeader = isMobileSelectionModeEnabled && isSmallScreenWidth;

    return (
        <AccessOrNotFoundWrapper
            policyID={policyID}
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN, CONST.POLICY.ACCESS_VARIANTS.PAID]}
            featureName={CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED}
        >
            <ScreenWrapper
                enableEdgeToEdgeBottomSafeAreaPadding
                shouldEnableMaxHeight
                testID={WorkspaceViewTagsPage.displayName}
            >
                <HeaderWithBackButton
                    title={selectionModeHeader ? translate('common.selectMultiple') : currentTagListName}
                    onBackButtonPress={() => {
                        if (isMobileSelectionModeEnabled) {
                            setSelectedTags([]);
                            turnOffMobileSelectionMode();
                            return;
                        }
                        Navigation.goBack(isQuickSettingsFlow ? ROUTES.SETTINGS_TAGS_ROOT.getRoute(policyID) : undefined);
                    }}
                >
                    {!shouldUseNarrowLayout && getHeaderButtons()}
                </HeaderWithBackButton>
                {shouldUseNarrowLayout && <View style={[styles.pl5, styles.pr5]}>{getHeaderButtons()}</View>}
                <ConfirmModal
                    isVisible={isDeleteTagsConfirmModalVisible}
                    onConfirm={deleteTags}
                    onCancel={() => setIsDeleteTagsConfirmModalVisible(false)}
                    title={translate(selectedTags.length === 1 ? 'workspace.tags.deleteTag' : 'workspace.tags.deleteTags')}
                    prompt={translate(selectedTags.length === 1 ? 'workspace.tags.deleteTagConfirmation' : 'workspace.tags.deleteTagsConfirmation')}
                    confirmText={translate('common.delete')}
                    cancelText={translate('common.cancel')}
                    danger
                />
                {!hasDependentTags && (
                    <View style={[styles.pv4, styles.ph5]}>
                        <ToggleSettingOptionRow
                            title={translate('common.required')}
                            switchAccessibilityLabel={translate('common.required')}
                            isActive={!!currentPolicyTag?.required}
                            onToggle={(on) => {
                                if (isMakingLastRequiredTagListOptional(policy, policyTags, [currentPolicyTag])) {
                                    setIsCannotMakeAllTagsOptionalModalVisible(true);
                                    return;
                                }

                                setPolicyTagsRequired(policyID, on, route.params.orderWeight);
                            }}
                            pendingAction={currentPolicyTag.pendingFields?.required}
                            errors={currentPolicyTag?.errorFields?.required ?? undefined}
                            onCloseError={() => clearPolicyTagListErrorField(policyID, route.params.orderWeight, 'required')}
                            disabled={!currentPolicyTag?.required && !Object.values(currentPolicyTag?.tags ?? {}).some((tag) => tag.enabled)}
                            showLockIcon={isMakingLastRequiredTagListOptional(policy, policyTags, [currentPolicyTag])}
                        />
                    </View>
                )}
                <OfflineWithFeedback
                    errors={currentPolicyTag.errors}
                    onClose={() => clearPolicyTagListErrors(policyID, currentPolicyTag.orderWeight)}
                    pendingAction={currentPolicyTag.pendingAction}
                    errorRowStyles={styles.mh5}
                >
                    <MenuItemWithTopDescription
                        title={getCleanedTagName(currentPolicyTag.name)}
                        description={translate(`workspace.tags.customTagName`)}
                        onPress={navigateToEditTag}
                        shouldShowRightIcon
                    />
                </OfflineWithFeedback>
                {isLoading && (
                    <ActivityIndicator
                        size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                        style={[styles.flex1]}
                        color={theme.spinner}
                    />
                )}
                {tagList.length > 0 && !isLoading && (
                    <SelectionListWithModal
                        canSelectMultiple={canSelectMultiple}
                        turnOnSelectionModeOnLongPress={!hasDependentTags}
                        onTurnOnSelectionMode={(item) => item && toggleTag(item)}
                        sections={[{data: filteredTagList, isDisabled: false}]}
                        selectedItems={selectedTags}
                        shouldUseDefaultRightHandSideCheckmark={false}
                        onCheckboxPress={toggleTag}
                        onSelectRow={navigateToTagSettings}
                        onSelectAll={filteredTagList.length > 0 ? toggleAllTags : undefined}
                        showScrollIndicator
                        ListItem={TableListItem}
                        customListHeader={getCustomListHeader()}
                        listHeaderContent={listHeaderContent}
                        shouldShowListEmptyContent={false}
                        shouldPreventDefaultFocusOnSelectRow={!canUseTouchScreen()}
                        listHeaderWrapperStyle={[styles.ph9, styles.pv3, styles.pb5]}
                        addBottomSafeAreaPadding
                        onDismissError={(item) => {
                            clearPolicyTagErrors(policyID, item.value, route.params.orderWeight);
                        }}
                    />
                )}
                <ConfirmModal
                    isVisible={isCannotDeleteOrDisableLastTagModalVisible}
                    onConfirm={() => setIsCannotDeleteOrDisableLastTagModalVisible(false)}
                    onCancel={() => setIsCannotDeleteOrDisableLastTagModalVisible(false)}
                    title={translate('workspace.tags.cannotDeleteOrDisableAllTags.title')}
                    prompt={translate('workspace.tags.cannotDeleteOrDisableAllTags.description')}
                    confirmText={translate('common.buttonConfirm')}
                    shouldShowCancelButton={false}
                />
                <ConfirmModal
                    isVisible={isCannotMakeAllTagsOptionalModalVisible}
                    onConfirm={() => setIsCannotMakeAllTagsOptionalModalVisible(false)}
                    onCancel={() => setIsCannotMakeAllTagsOptionalModalVisible(false)}
                    title={translate('workspace.tags.cannotMakeAllTagsOptional.title')}
                    prompt={translate('workspace.tags.cannotMakeAllTagsOptional.description')}
                    confirmText={translate('common.buttonConfirm')}
                    shouldShowCancelButton={false}
                />
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

WorkspaceViewTagsPage.displayName = 'WorkspaceViewTagsPage';

export default WorkspaceViewTagsPage;
