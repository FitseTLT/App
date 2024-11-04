import {replaceReceipt} from '@libs/actions/IOU';

function retryUploadingReceipt(message) {
    fetch(message.source)
        .then((res) => res.blob())
        .then((blob) => {
            const file = new File([blob], message.filename, {type: message.type});

            replaceReceipt(message.transactionID, file, message.source, false);
        });
}
export default retryUploadingReceipt;
