import Navigation from '@libs/Navigation/Navigation';
import navigationRef from '@libs/Navigation/navigationRef';
import TransitionTracker from '@libs/Navigation/TransitionTracker';

import NAVIGATORS from '@src/NAVIGATORS';

function dismissOnboardingModalBeforeExit(afterTransition: () => void) {
    // Onboarding can already be gone by the time this runs, leaving another modal on top — a share started
    // before sign-in, for one. Dismissing then would tear down a modal this was never meant to touch.
    if (navigationRef.getRootState()?.routes.at(-1)?.name !== NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR) {
        TransitionTracker.runAfterTransitions({callback: afterTransition});
        return;
    }
    Navigation.dismissModal({afterTransition});
}

export default dismissOnboardingModalBeforeExit;
