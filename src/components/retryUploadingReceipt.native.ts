import {Str} from 'expensify-common';
import ImageSize from 'react-native-image-size';
import {replaceReceipt} from '@libs/actions/IOU';
import {getDataForUpload} from './AttachmentPicker/index.native';

function retryUploadingReceipt(message) {
    const fileDataObject: FileResponse = {
        name: message.filename ?? '',
        uri: message.source,
        type: message.filetype ?? '',
    };
    if (Str.isPDF(fileDataObject.name ?? '')) {
        replaceReceipt(message.transactionID, fileDataObject, fileDataObject.uri, false);
    }

    return ImageSize.getSize(fileDataObject.uri)
        .then(({width, height}) => {
            fileDataObject.width = width;
            fileDataObject.height = height;
            return fileDataObject;
        })
        .then((file) => {
            return getDataForUpload(file).then((fileObj) => replaceReceipt(message.transactionID, fileObj, fileObj.uri, false));
        });
}

export default retryUploadingReceipt;
