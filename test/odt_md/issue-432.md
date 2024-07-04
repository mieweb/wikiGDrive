#### Test Methodology

MIE will report a count of messages for each supported message type:

* NewRx
* RxChangeRequest
* RxChangeResponse
* CancelRx
* CancelRxResponse
* RxRenewalRequest
* RxRenewalResponse
* RxFill
* RxHistoryRequest
* RxHistoryResponse
* Status
* Error
* Verify

The report will also include a count of outbound messages unable to be transmitted due to connectivity issues or other errors, for each message type. This report will be based on the contents of each client's local database table of stored messages. MIE will run the report for each client under consideration and aggregate the results.
