import type {MaterialTopTabNavigationEventMap} from '@react-navigation/material-top-tabs';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import type {EventMapCore, NavigationState, ParamListBase, ScreenListeners} from '@react-navigation/native';
import {useRoute} from '@react-navigation/native';
import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import FocusTrapContainerElement from '@components/FocusTrap/FocusTrapContainerElement';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import type {TabSelectorProps} from '@components/TabSelector/TabSelector';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import type {IOURequestType} from '@libs/actions/IOU';
import Tab from '@userActions/Tab';
import ONYXKEYS from '@src/ONYXKEYS';
import type {SelectedTabRequest} from '@src/types/onyx';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import isLoadingOnyxValue from '@src/types/utils/isLoadingOnyxValue';
import onTabSelectHandler from './onTabSelectHandler';
import {defaultScreenOptions} from './OnyxTabNavigatorConfig';

type OnyxTabNavigatorProps = ChildrenProps & {
    /** ID of the tab component to be saved in onyx */
    id: string;

    /** Name of the selected tab */
    defaultSelectedTab?: SelectedTabRequest;

    /** A function triggered when a tab has been selected */
    onTabSelected?: (newIouType: IOURequestType) => void;

    tabBar: (props: TabSelectorProps) => React.ReactNode;

    screenListeners?: ScreenListeners<NavigationState, MaterialTopTabNavigationEventMap>;

    /** Callback to register the focus trap container elements of the current active tab.
     * Use this in the parent component to get the focus trap container element of the active tab,
     * then pass it to the ScreenWrapper so that only focusable elements of the active tab are included in the focus trap
     * Check the `IOURequestStartPage.tsx` and `NewChatSelectorPage.tsx` components for example usage
     */
    onActiveTabFocusTrapContainerElementChanged?: (containerElement: HTMLElement | null) => void;

    /** Callback to register the focus trap container elements of the tab bar.
     * This callback is useful when the custom-rendered tab bar is supporting the focus trap container element registration (which is the case of `TabSelector.tsx` component).
     * Together, with the `onActiveTabFocusTrapContainerElementChanged` callback, we can manage the focus trap of the tab navigator in the parent component.
     */
    onTabBarFocusTrapContainerElementChanged?: (containerElement: HTMLElement | null) => void;

    /** Whether to show the label when the tab is inactive */
    shouldShowLabelWhenInactive?: boolean;

    /** Disable swipe between tabs */
    disableSwipe?: boolean;

    /** Determines whether the product training tooltip should be displayed to the user. */
    shouldShowProductTrainingTooltip?: boolean;

    /** Function to render the content of the product training tooltip. */
    renderProductTrainingTooltip?: () => React.JSX.Element;

    /** Whether to lazy load the tab screens */
    lazyLoadEnabled?: boolean;

    /** Callback to handle the Pager's internal onPageSelected event callback */
    onTabSelect?: ({index}: {index: number}) => void;
};

const TopTab = createMaterialTopTabNavigator<ParamListBase, string>();

// The TabFocusTrapContext is to collect the focus trap container element of each tab screen.
// This provider is placed in the OnyxTabNavigator component and the consumer is in the TabScreenWithFocusTrapWrapper component.
const TabFocusTrapContext = React.createContext<(tabName: string, containerElement: HTMLElement | null) => void>(() => {});

const getTabNames = (children: React.ReactNode): string[] => {
    const result: string[] = [];

    React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) {
            return;
        }

        const element = child as React.ReactElement<{name?: string}>;

        if (typeof element.props.name === 'string') {
            result.push(element.props.name);
        }
    });

    return result;
};

// This takes all the same props as MaterialTopTabsNavigator: https://reactnavigation.org/docs/material-top-tab-navigator/#props,
// except ID is now required, and it gets a `selectedTab` from Onyx
// It also takes 2 more optional callbacks to manage the focus trap container elements of the tab bar and the active tab
function OnyxTabNavigator({
    id,
    defaultSelectedTab,
    tabBar: TabBar,
    children,
    onTabBarFocusTrapContainerElementChanged,
    onActiveTabFocusTrapContainerElementChanged,
    onTabSelected = () => {},
    screenListeners,
    shouldShowLabelWhenInactive = true,
    disableSwipe = false,
    shouldShowProductTrainingTooltip,
    renderProductTrainingTooltip,
    lazyLoadEnabled = false,
    onTabSelect,
    ...rest
}: OnyxTabNavigatorProps) {
    const isFirstMount = useRef(true);
    // Mapping of tab name to focus trap container element
    const [focusTrapContainerElementMapping, setFocusTrapContainerElementMapping] = useState<Record<string, HTMLElement>>({});
    const [selectedTab, selectedTabResult] = useOnyx(`${ONYXKEYS.COLLECTION.SELECTED_TAB}${id}`, {canBeMissing: true});

    const tabNames = useMemo(() => getTabNames(children), [children]);

    const validInitialTab = selectedTab && tabNames.includes(selectedTab) ? selectedTab : defaultSelectedTab;

    const LazyPlaceholder = useCallback(() => {
        return <FullScreenLoadingIndicator />;
    }, []);

    // This callback is used to register the focus trap container element of each available tab screen
    const setTabFocusTrapContainerElement = useCallback((tabName: string, containerElement: HTMLElement | null) => {
        setFocusTrapContainerElementMapping((prevMapping) => {
            const resultMapping = {...prevMapping};
            if (containerElement) {
                resultMapping[tabName] = containerElement;
            } else {
                delete resultMapping[tabName];
            }
            return resultMapping;
        });
    }, []);

    /**
     * This is a TabBar wrapper component that includes the focus trap container element callback.
     * In `TabSelector.tsx` component, the callback prop to register focus trap container element is supported out of the box
     */
    const TabBarWithFocusTrapInclusion = useCallback(
        (props: TabSelectorProps) => {
            return (
                <TabBar
                    onFocusTrapContainerElementChanged={onTabBarFocusTrapContainerElementChanged}
                    shouldShowLabelWhenInactive={shouldShowLabelWhenInactive}
                    shouldShowProductTrainingTooltip={shouldShowProductTrainingTooltip}
                    renderProductTrainingTooltip={renderProductTrainingTooltip}
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...props}
                />
            );
        },
        [TabBar, onTabBarFocusTrapContainerElementChanged, shouldShowLabelWhenInactive, shouldShowProductTrainingTooltip, renderProductTrainingTooltip],
    );

    // If the selected tab changes, we need to update the focus trap container element of the active tab
    useEffect(() => {
        onActiveTabFocusTrapContainerElementChanged?.(selectedTab ? focusTrapContainerElementMapping[selectedTab] : null);
    }, [selectedTab, focusTrapContainerElementMapping, onActiveTabFocusTrapContainerElementChanged]);

    if (isLoadingOnyxValue(selectedTabResult)) {
        return null;
    }

    return (
        <TabFocusTrapContext.Provider value={setTabFocusTrapContainerElement}>
            <TopTab.Navigator
                /* eslint-disable-next-line react/jsx-props-no-spreading */
                {...rest}
                id={id}
                initialRouteName={validInitialTab}
                backBehavior="initialRoute"
                keyboardDismissMode="none"
                tabBar={TabBarWithFocusTrapInclusion}
                onTabSelect={onTabSelect}
                screenListeners={{
                    state: (e) => {
                        const event = e as unknown as EventMapCore<NavigationState>['state'];
                        const state = event.data.state;
                        const index = state.index;
                        const routeNames = state.routeNames;
                        // For web-based platforms we need to focus the selected tab input once on first mount as well as
                        // when the tab selection is changed via internal Pager onPageSelected (passed to the navigator)
                        if (isFirstMount.current) {
                            onTabSelectHandler(index, onTabSelect);
                            isFirstMount.current = false;
                        }
                        const newSelectedTab = routeNames.at(index);
                        if (selectedTab === newSelectedTab) {
                            return;
                        }
                        Tab.setSelectedTab(id, newSelectedTab as SelectedTabRequest);
                        onTabSelected(newSelectedTab as IOURequestType);
                    },
                    ...(screenListeners ?? {}),
                }}
                screenOptions={{
                    ...defaultScreenOptions,
                    swipeEnabled: !disableSwipe,
                    lazy: lazyLoadEnabled,
                    lazyPlaceholder: LazyPlaceholder,
                }}
            >
                {children}
            </TopTab.Navigator>
        </TabFocusTrapContext.Provider>
    );
}

/**
 * We should use this wrapper for each tab screen. This will help register the focus trap container element of each tab screen.
 * In the OnyxTabNavigator component, depending on the selected tab, we will further register the correct container element of the current active tab to the parent focus trap.
 * This must be used if we want to include all tabbable elements of one tab screen in the parent focus trap if that tab screen is active.
 * Example usage (check the `IOURequestStartPage.tsx` and `NewChatSelectorPage.tsx` components for more info)
 * ```tsx
 * <OnyxTabNavigator>
 *   <Tab.Screen>
 *     {() => (
 *       <TabScreenWithFocusTrapWrapper>
 *          <Content />
 *        </TabScreenWithFocusTrapWrapper>
 *     )}
 *   </Tab.Screen>
 * </OnyxTabNavigator>
 * ```
 */
function TabScreenWithFocusTrapWrapper({children}: {children?: React.ReactNode}) {
    const route = useRoute();
    const styles = useThemeStyles();
    const setTabContainerElement = useContext(TabFocusTrapContext);
    const handleContainerElementChanged = useCallback(
        (element: HTMLElement | null) => {
            setTabContainerElement(route.name, element);
        },
        [setTabContainerElement, route.name],
    );

    return (
        <FocusTrapContainerElement
            onContainerElementChanged={handleContainerElementChanged}
            style={[styles.w100, styles.h100]}
        >
            {children}
        </FocusTrapContainerElement>
    );
}

OnyxTabNavigator.displayName = 'OnyxTabNavigator';

export default OnyxTabNavigator;

export {TabScreenWithFocusTrapWrapper, TopTab};
