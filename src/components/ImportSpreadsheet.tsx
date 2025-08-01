import React, {useRef, useState} from 'react';
import {PanResponder, PixelRatio, Platform, View} from 'react-native';
import RNFetchBlob from 'react-native-blob-util';
import type {TupleToUnion} from 'type-fest';
import * as XLSX from 'xlsx';
import useLocalize from '@hooks/useLocalize';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {setSpreadsheetData} from '@libs/actions/ImportSpreadsheet';
import {setImportedSpreadsheetIsImportingMultiLevelTags} from '@libs/actions/Policy/Tag';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import {splitExtensionFromFileName} from '@libs/fileDownload/FileUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {FileObject} from '@pages/media/AttachmentModalScreen/types';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type {Route as Routes} from '@src/ROUTES';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import DragAndDropConsumer from './DragAndDrop/Consumer';
import DragAndDropProvider from './DragAndDrop/Provider';
import FilePicker from './FilePicker';
import HeaderWithBackButton from './HeaderWithBackButton';
import * as Expensicons from './Icon/Expensicons';
import ImageSVG from './ImageSVG';
import RenderHTML from './RenderHTML';
import ScreenWrapper from './ScreenWrapper';
import Text from './Text';

type ImportSpreadsheetProps = {
    // The route to navigate to when the back button is pressed.
    backTo?: Routes;

    // The route to navigate to after the file import is completed.
    goTo: Routes;

    /** Whether the spreadsheet is importing multi-level tags */
    isImportingMultiLevelTags?: boolean;
};

function ImportSpreadsheet({backTo, goTo, isImportingMultiLevelTags}: ImportSpreadsheetProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [isReadingFile, setIsReadingFile] = useState(false);
    const [fileTopPosition, setFileTopPosition] = useState(0);
    const [isAttachmentInvalid, setIsAttachmentInvalid] = useState(false);
    const [attachmentInvalidReasonTitle, setAttachmentInvalidReasonTitle] = useState<TranslationPaths>();
    const [attachmentInvalidReason, setAttachmentValidReason] = useState<TranslationPaths>();
    // We need to use isSmallScreenWidth instead of shouldUseNarrowLayout to use different copies depending on the screen size
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isSmallScreenWidth} = useResponsiveLayout();
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const panResponder = useRef(
        PanResponder.create({
            onPanResponderTerminationRequest: () => false,
        }),
    ).current;

    const setUploadFileError = (isInvalid: boolean, title: TranslationPaths, reason: TranslationPaths) => {
        setIsAttachmentInvalid(isInvalid);
        setAttachmentInvalidReasonTitle(title);
        setAttachmentValidReason(reason);
    };

    const validateFile = (file: FileObject) => {
        const {fileExtension} = splitExtensionFromFileName(file?.name ?? '');
        if (!CONST.ALLOWED_SPREADSHEET_EXTENSIONS.includes(fileExtension.toLowerCase() as TupleToUnion<typeof CONST.ALLOWED_SPREADSHEET_EXTENSIONS>)) {
            setUploadFileError(true, 'attachmentPicker.wrongFileType', 'attachmentPicker.notAllowedExtension');
            return false;
        }

        if ((file?.size ?? 0) <= 0) {
            setUploadFileError(true, 'attachmentPicker.attachmentTooSmall', 'spreadsheet.sizeNotMet');
            return false;
        }
        return true;
    };

    const readFile = (file: File) => {
        if (!validateFile(file)) {
            return;
        }

        let fileURI = file.uri ?? URL.createObjectURL(file);
        if (!fileURI) {
            return;
        }
        if (Platform.OS === 'ios') {
            fileURI = fileURI.replace(/^.*\/Documents\//, `${RNFetchBlob.fs.dirs.DocumentDir}/`);
        }
        const {fileExtension} = splitExtensionFromFileName(file?.name ?? '');
        const shouldReadAsText = CONST.TEXT_SPREADSHEET_EXTENSIONS.includes(fileExtension as TupleToUnion<typeof CONST.TEXT_SPREADSHEET_EXTENSIONS>);
        const readWorkbook = () => {
            if (shouldReadAsText) {
                return fetch(fileURI)
                    .then((data) => {
                        setIsReadingFile(true);
                        return data.text();
                    })
                    .then((text) => XLSX.read(text, {type: 'string'}));
            }
            return fetch(fileURI)
                .then((data) => {
                    setIsReadingFile(true);
                    return data.arrayBuffer();
                })
                .then((arrayBuffer) => XLSX.read(new Uint8Array(arrayBuffer), {type: 'buffer'}));
        };
        readWorkbook()
            .then((workbook) => {
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(worksheet, {header: 1, blankrows: false}) as string[][] | unknown[][];
                const formattedSpreadsheetData = data.map((row) => row.map((cell) => String(cell)));
                setSpreadsheetData(formattedSpreadsheetData, fileURI, file.type, file.name, isImportingMultiLevelTags ?? false)
                    .then(() => {
                        Navigation.navigate(goTo);
                    })
                    .catch(() => {
                        setUploadFileError(true, 'spreadsheet.importFailedTitle', 'spreadsheet.invalidFileMessage');
                    });
            })
            .finally(() => {
                setIsReadingFile(false);
            });
    };

    const getTextForImportModal = () => {
        let text = '';
        if (isImportingMultiLevelTags) {
            text = isSmallScreenWidth ? translate('spreadsheet.chooseSpreadsheetMultiLevelTag') : translate('spreadsheet.dragAndDropMultiLevelTag');
        } else {
            text = isSmallScreenWidth ? translate('spreadsheet.chooseSpreadsheet') : translate('spreadsheet.dragAndDrop');
        }
        return text;
    };

    const acceptableFileTypes = isImportingMultiLevelTags
        ? CONST.MULTILEVEL_TAG_ALLOWED_SPREADSHEET_EXTENSIONS.map((extension) => `.${extension}`).join(',')
        : CONST.ALLOWED_SPREADSHEET_EXTENSIONS.map((extension) => `.${extension}`).join(',');

    const desktopView = (
        <>
            <View onLayout={({nativeEvent}) => setFileTopPosition(PixelRatio.roundToNearestPixel((nativeEvent.layout as DOMRect).top))}>
                <ImageSVG
                    src={Expensicons.SpreadsheetComputer}
                    contentFit="contain"
                    style={styles.mb4}
                    width={CONST.IMPORT_SPREADSHEET.ICON_WIDTH}
                    height={CONST.IMPORT_SPREADSHEET.ICON_HEIGHT}
                />
            </View>
            <View
                style={[styles.uploadFileViewTextContainer, styles.userSelectNone]}
                // eslint-disable-next-line react-compiler/react-compiler, react/jsx-props-no-spreading
                {...panResponder.panHandlers}
            >
                <Text style={[styles.textFileUpload, styles.mb1]}>{isImportingMultiLevelTags ? translate('spreadsheet.import') : translate('spreadsheet.upload')}</Text>
                <View style={[styles.flexRow]}>
                    <RenderHTML html={getTextForImportModal()} />
                </View>
            </View>
            <FilePicker acceptableFileTypes={acceptableFileTypes}>
                {({openPicker}) => (
                    <Button
                        success
                        text={translate('common.chooseFile')}
                        accessibilityLabel={translate('common.chooseFile')}
                        style={[styles.pt9]}
                        isLoading={isReadingFile}
                        onPress={() => {
                            openPicker({
                                onPicked: (file) => {
                                    readFile(file as File);
                                },
                            });
                        }}
                    />
                )}
            </FilePicker>
        </>
    );

    const hideInvalidAttachmentModal = () => {
        setIsAttachmentInvalid(false);
    };

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableKeyboardAvoidingView={false}
            testID={ImportSpreadsheet.displayName}
            shouldEnableMaxHeight={canUseTouchScreen()}
            headerGapStyles={isDraggingOver ? [styles.isDraggingOver] : []}
        >
            {({safeAreaPaddingBottomStyle}) => (
                <DragAndDropProvider setIsDraggingOver={setIsDraggingOver}>
                    <View style={[styles.flex1, safeAreaPaddingBottomStyle]}>
                        <HeaderWithBackButton
                            title={translate('spreadsheet.importSpreadsheet')}
                            onBackButtonPress={() => {
                                if (isImportingMultiLevelTags) {
                                    setImportedSpreadsheetIsImportingMultiLevelTags(false);
                                }
                                Navigation.goBack(backTo);
                            }}
                        />

                        <View style={[styles.flex1, styles.uploadFileView(isSmallScreenWidth)]}>
                            {!(isDraggingOver ?? isDraggingOver) && desktopView}

                            <DragAndDropConsumer
                                onDrop={(e) => {
                                    const file = e?.dataTransfer?.files[0];
                                    if (file) {
                                        readFile(file);
                                    }
                                }}
                            >
                                <View style={[styles.fileDropOverlay, styles.w100, styles.h100, styles.justifyContentCenter, styles.alignItemsCenter]}>
                                    <View style={styles.fileUploadImageWrapper(fileTopPosition)}>
                                        <ImageSVG
                                            src={Expensicons.SpreadsheetComputer}
                                            contentFit="contain"
                                            style={styles.mb4}
                                            width={CONST.IMPORT_SPREADSHEET.ICON_WIDTH}
                                            height={CONST.IMPORT_SPREADSHEET.ICON_HEIGHT}
                                        />
                                        <Text style={[styles.textFileUpload]}>{translate('common.dropTitle')}</Text>
                                        <Text style={[styles.subTextFileUpload, styles.themeTextColor]}>{translate('common.dropMessage')}</Text>
                                    </View>
                                </View>
                            </DragAndDropConsumer>
                            <ConfirmModal
                                title={attachmentInvalidReasonTitle ? translate(attachmentInvalidReasonTitle) : ''}
                                onConfirm={hideInvalidAttachmentModal}
                                onCancel={hideInvalidAttachmentModal}
                                isVisible={isAttachmentInvalid}
                                prompt={attachmentInvalidReason ? translate(attachmentInvalidReason) : ''}
                                confirmText={translate('common.close')}
                                shouldShowCancelButton={false}
                                shouldHandleNavigationBack
                            />
                        </View>
                    </View>
                </DragAndDropProvider>
            )}
        </ScreenWrapper>
    );
}

ImportSpreadsheet.displayName = 'ImportSpreadsheet';

export default ImportSpreadsheet;
