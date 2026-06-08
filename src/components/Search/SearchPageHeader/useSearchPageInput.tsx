import {useEffect, useRef, useState} from 'react';
import type {TextInputKeyPressEvent} from 'react-native';
import type {AnimatedTextInputRef} from '@components/RNTextInput';
import type {SearchQueryJSON, SearchQueryString} from '@components/Search/types';
import useOnyx from '@hooks/useOnyx';
import {setSearchContext} from '@libs/actions/Search';
import Navigation from '@libs/Navigation/Navigation';
import {buildQueryWithKeyword, getQueryWithUpdatedValues} from '@libs/SearchQueryUtils';
import StringUtils from '@libs/StringUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

type UseSearchPageInputProps = {
    queryJSON: SearchQueryJSON;
    onSearch: (value: string) => void;
    onSubmit: () => void;
};

function useSearchPageInput({queryJSON, onSubmit}: UseSearchPageInputProps) {
    const [searchContext] = useOnyx(ONYXKEYS.SEARCH_CONTEXT);

    const [textInputValue, setTextInputValue] = useState('');
    const [selection] = useState({start: 0, end: 0});

    const textInputRef = useRef<AnimatedTextInputRef>(null);

    const {inputQuery: originalInputQuery} = queryJSON;
    const shouldShowQuery = searchContext?.shouldShowSearchQuery ?? false;

    const keywordText = queryJSON.flatFilters
        .filter((f) => f.key === CONST.SEARCH.SYNTAX_FILTER_KEYS.KEYWORD)
        .map((f) => f.filters.map((v) => String(v.value)).join(' '))
        .join(' ');

    useEffect(() => {
        setTextInputValue(shouldShowQuery ? keywordText : '');
    }, [keywordText, shouldShowQuery]);

    function submitSearch(queryString: SearchQueryString) {
        const keywordQuery = buildQueryWithKeyword(queryString, queryJSON);
        const updatedQuery = getQueryWithUpdatedValues(keywordQuery);

        if (!updatedQuery) {
            return;
        }

        setSearchContext(true);
        Navigation.navigate(
            ROUTES.SEARCH_ROOT.getRoute({
                query: updatedQuery,
            }),
        );
        onSubmit();
        if (updatedQuery !== originalInputQuery) {
            setTextInputValue('');
        }
    }

    function handleKeyPress(e: TextInputKeyPressEvent) {
        const keyEvent = e as unknown as KeyboardEvent;

        if (keyEvent.key === CONST.KEYBOARD_SHORTCUTS.ESCAPE.shortcutKey && textInputRef.current?.isFocused()) {
            keyEvent.preventDefault();
            textInputRef.current.blur();
        }
    }

    function onSearchQueryChange(userQuery: string) {
        setTextInputValue(StringUtils.lineBreaksToSpaces(userQuery, true));
    }

    function clearKeywordAndSearch() {
        submitSearch('');
    }

    return {
        selection,
        textInputRef,
        textInputValue,
        handleKeyPress,
        clearKeywordAndSearch,
        onSearchQueryChange,
        submitSearch,
    };
}

export default useSearchPageInput;
