/* eslint-disable react/jsx-props-no-spreading */
import Str from 'expensify-common/lib/str';
import PropTypes from 'prop-types';
import React from 'react';
import {View} from 'react-native';
import _ from 'underscore';
import AttachmentModal from '@components/AttachmentModal';
import PressableWithoutFocus from '@components/Pressable/PressableWithoutFocus';
import ReceiptImage from '@components/ReceiptImage';
import {ShowContextMenuContext} from '@components/ShowContextMenuContext';
import ThumbnailImage from '@components/ThumbnailImage';
import transactionPropTypes from '@components/transactionPropTypes';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as TransactionUtils from '@libs/TransactionUtils';
import tryResolveUrlFromApiRoot from '@libs/tryResolveUrlFromApiRoot';
import CONST from '@src/CONST';

const propTypes = {
    /** thumbnail URI for the image */
    thumbnail: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

    /** URI for the image or local numeric reference for the image  */
    image: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,

    /** whether or not to enable the image preview modal */
    enablePreviewModal: PropTypes.bool,

    /* The transaction associated with this image, if any. Passed for handling eReceipts. */
    transaction: transactionPropTypes,

    /** whether thumbnail is refer the local file or not */
    isLocalFile: PropTypes.bool,

    /** whether the receipt can be replaced */
    canEditReceipt: PropTypes.bool,
};

const defaultProps = {
    thumbnail: null,
    transaction: {},
    enablePreviewModal: false,
    isLocalFile: false,
    canEditReceipt: false,
};

/**
 * An image with an optional thumbnail that fills its parent container. If the thumbnail is passed,
 * we try to resolve both the image and thumbnail from the API. Similar to ImageRenderer, we show
 * and optional preview modal as well.
 */

function ReportActionItemImage({thumbnail, isThumbnail, image, enablePreviewModal = false, transaction, canEditReceipt = false, isLocalFile = false}: ReportActionItemImageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const imageSource = tryResolveUrlFromApiRoot(image || '');
    const thumbnailSource = tryResolveUrlFromApiRoot(thumbnail || '');
    const isEReceipt = !_.isEmpty(transaction) && TransactionUtils.hasEReceipt(transaction);

    let propsObj;

    if (isEReceipt) {
        propsObj = {isEReceipt: true, transactionID: transaction.transactionID};
    } else if ((thumbnail ?? isThumbnail) && !isLocalFile && !Str.isPDF(imageSource)) {
        propsObj = thumbnailSource ? {shouldUseThumnailImage: true, source: thumbnailSource} : {isThumbnail: true, transactionID: transaction?.transactionID};
    } else {
        propsObj = {isThumbnail, source: thumbnail ?? image};
    }

    if (enablePreviewModal) {
        return (
            <ShowContextMenuContext.Consumer>
                {({report}) => (
                    <AttachmentModal
                        source={imageSource}
                        isAuthTokenRequired={!isLocalFile}
                        report={report}
                        isReceiptAttachment
                        canEditReceipt={canEditReceipt}
                        allowToDownload
                        originalFileName={transaction.filename}
                    >
                        {
                            // @ts-expect-error TODO: Remove this once AttachmentModal (https://github.com/Expensify/App/issues/25130) is migrated to TypeScript.
                            ({show}) => (
                                <PressableWithoutFocus
                                    // @ts-expect-error TODO: Remove this once AttachmentModal (https://github.com/Expensify/App/issues/25130) is migrated to TypeScript.
                                    style={[styles.noOutline, styles.w100, styles.h100]}
                                    onPress={show}
                                    accessibilityRole={CONST.ACCESSIBILITY_ROLE.IMAGEBUTTON}
                                    accessibilityLabel={translate('accessibilityHints.viewAttachment')}
                                >
                                    <ReceiptImage {...propsObj} />
                                </PressableWithoutFocus>
                            )
                        }
                    </AttachmentModal>
                )}
            </ShowContextMenuContext.Consumer>
        );
    }

    return <ReceiptImage {...propsObj} />;
}

ReportActionItemImage.propTypes = propTypes;
ReportActionItemImage.defaultProps = defaultProps;
ReportActionItemImage.displayName = 'ReportActionItemImage';

export default ReportActionItemImage;
