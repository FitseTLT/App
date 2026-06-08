import {useIsFocused} from '@react-navigation/native';
import React, {useEffect} from 'react';
import {View} from 'react-native';
import SearchInputSelectionWrapper from '@components/Search/SearchInputSelectionWrapper';
import {useSearchRouterActions} from '@components/Search/SearchRouter/SearchRouterContext';
import type {SearchQueryJSON} from '@components/Search/types';
import useThemeStyles from '@hooks/useThemeStyles';
import useSearchPageInput from './useSearchPageInput';

type SearchPageInputWideProps = {
    queryJSON: SearchQueryJSON;
    handleSearch: (value: string) => void;
};

function SearchPageInputWide({queryJSON, handleSearch}: SearchPageInputWideProps) {
    const styles = useThemeStyles();
    const isFocused = useIsFocused();
    const {registerSearchPageInput} = useSearchRouterActions();

    const {selection, textInputRef, textInputValue, clearKeywordAndSearch, handleKeyPress, onSearchQueryChange, submitSearch} = useSearchPageInput({
        queryJSON,
        onSearch: handleSearch,
        onSubmit: () => {},
    });

    useEffect(() => {
        if (!isFocused || !textInputRef.current) {
            return;
        }

        registerSearchPageInput(textInputRef.current);
    }, [isFocused, registerSearchPageInput, textInputRef]);

    return (
        <View
            dataSet={{dragArea: false}}
            style={[styles.appBG, styles.searchResultsHeaderBar]}
        >
            <SearchInputSelectionWrapper
                value={textInputValue}
                onSearchQueryChange={onSearchQueryChange}
                isFullWidth
                inputStyle={styles.fontSizeLabel}
                inputContainerStyle={styles.ph2}
                touchableInputWrapperStyle={styles.searchPageInputWideTouchableWrapper}
                clearButtonStyle={styles.mh0}
                onClear={clearKeywordAndSearch}
                isKeywordOnly
                onSubmit={() => submitSearch(textInputValue)}
                autoFocus={false}
                wrapperStyle={{...styles.searchAutocompleteInputResults, ...styles.br2}}
                wrapperFocusedStyle={styles.searchAutocompleteInputResultsFocused}
                outerWrapperStyle={styles.flex1}
                ref={textInputRef}
                selection={selection}
                substitutionMap={{}}
                onKeyPress={handleKeyPress}
            />
        </View>
    );
}

export default SearchPageInputWide;
