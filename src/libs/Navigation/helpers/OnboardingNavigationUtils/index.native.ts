import navigationRef from '@libs/Navigation/navigationRef';
import TransitionTracker from '@libs/Navigation/TransitionTracker';

import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';

function dismissOnboardingModalBeforeExit() {
    TransitionTracker.runAfterTransitions({
        callback: () => {
            // Onboarding can already be gone by the time this runs, leaving another modal on top — a share started
            // before sign-in, for one. Dismissing then would tear down a modal this was never meant to touch.
            if (navigationRef.getRootState()?.routes.at(-1)?.name !== NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR) {
                return;
            }
            navigationRef.dispatch({type: CONST.NAVIGATION.ACTION_TYPE.DISMISS_MODAL});
        },
        runImmediately: true,
    });
}

function resetOnboardingStackToRoot() {}

export {dismissOnboardingModalBeforeExit, resetOnboardingStackToRoot};
