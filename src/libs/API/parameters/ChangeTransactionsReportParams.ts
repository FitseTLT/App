/**
 * A map linking the optimistic MOVED_TRANSACTION or UNREPORTED_TRANSACTION reportActionID to the transactionID.
 * If we're creating the transactionThread as part of moving the transaction, we should also send the optimistic
 * transactionThreadReportID and transactionThreadCreatedReportActionID
 */
type TransactionThreadInfo = {
    movedReportActionID: string;
    moneyRequestPreviewReportActionID: string;
    transactionThreadReportID?: string;
    transactionThreadCreatedReportActionID?: string;
    selfDMReportID?: string;
    selfDMCreatedReportActionID?: string;
};

type ChangeTransactionsReportParams = {
    transactionList: string;
    reportID: string;
    transactionIDToReportActionAndThreadData: string; // A map of transactionID to TransactionThreadInfo
};

export type {ChangeTransactionsReportParams, TransactionThreadInfo};
