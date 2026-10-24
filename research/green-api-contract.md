# GREEN-API HTTP contract (WhatsApp)

Sources, both MIT-licensed and downloaded with `npm pack` (nothing executed):
- `@green-api/whatsapp-api-client-js-v2@1.0.3`: TypeScript source plus types
- `@green-api/whatsapp-api-client@0.4.8`: v1 JS client, which accepts a custom `host`/`media`

Method:
1. `rea analyze-javascript-application` (REA 6.7.0) on each package. Output is in
   `research/rea-out/*.json`. The v2 evidence ID is
   `ev_510b0b933daf979343b71810915521102dea4b29c703d28252b4c39c677518ff`.
   It parsed 39 files with 0 parse failures and recovered 58 client functions
   with their parameter and property names.
2. REA's semantic graph does not keep literal string values. Endpoint names and
   HTTP verbs were therefore read from the shipped source, using REA's function
   inventory as the checklist.
3. Observed vs inferred: everything in the tables below is **observed in the SDK
   source**. Server-side behaviour that the SDK only consumes (status codes, error
   bodies, long-poll semantics) is **from GREEN-API's docs or inferred**, and is
   marked as such.

## URL scheme (observed)

```
{host}/waInstance{idInstance}/{method}/{apiTokenInstance}[/{pathAfterToken}][?query]
host  default https://api.green-api.com
media default https://media.green-api.com   (v1 only routes sendFileByUpload and uploadFile here)
```
- The token is in the path. No auth header.
- v1 sends `ForwardMessages` and v2 sends `forwardMessages`, so **method names must
  be matched case-insensitively**.
- `deleteNotification` puts `receiptId` after the token: `DELETE .../deleteNotification/{token}/{receiptId}`.
- v1 converts `phoneNumber` to `chatId = "{phoneNumber}@c.us"` on the client
  side, so the server only ever receives `chatId`.
- Uploads are `multipart/form-data`. `uploadFile` may carry a `GA-Filename` header
  or a raw `Content-Type`.

## Methods

| Group | Method | Verb | Body / query |
|---|---|---|---|
| Account | `getSettings` | GET | |
| | `setSettings` | POST | Settings (partial) |
| | `getStateInstance` | GET | |
| | `getStateInstanceHistory` (v1) | GET | |
| | `getWaSettings` | GET | |
| | `getDeviceInfo` (v1) | GET | |
| | `reboot` | GET | |
| | `logout` | GET | |
| | `qr` | GET | |
| | `getAuthorizationCode` | POST | `{phoneNumber}` |
| | `setProfilePicture` | POST multipart | `file` |
| | `updateApiToken` (v1) | GET | |
| Sending | `sendMessage` | POST | `{chatId, message, quotedMessageId?, linkPreview?}` |
| | `sendFileByUrl` | POST | `{chatId, urlFile, fileName, caption?, quotedMessageId?}` |
| | `sendFileByUpload` | POST multipart | `file, chatId, fileName, caption?, quotedMessageId?` |
| | `uploadFile` | POST multipart | `file` (+`GA-Filename`) |
| | `sendPoll` | POST | `{chatId, message, options:[{optionName}], multipleAnswers?}` |
| | `sendLocation` | POST | `{chatId, latitude, longitude, nameLocation?, address?}` |
| | `sendContact` | POST | `{chatId, contact:{phoneContact, firstName?, ...}}` |
| | `forwardMessages` | POST | `{chatId, chatIdFrom, messages:[id]}` |
| | `sendTyping` (v1) | POST | `{chatId, typingTime?, typingType?}` |
| | `sendLink`, `sendButtons`, `sendTemplateButtons`, `sendListMessage`, `sendInteractiveButtons(Reply)` (v1) | POST | legacy/interactive; low priority |
| Receiving | `receiveNotification` | GET | `?receiveTimeout=5..60` |
| | `deleteNotification` | DELETE | `/{receiptId}` after token |
| | `downloadFile` | POST | `{chatId, idMessage}` |
| Journals | `getChatHistory` | POST | `{chatId, count?}` |
| | `getMessage` | POST | `{chatId, idMessage}` |
| | `lastIncomingMessages` | GET | `?minutes=` |
| | `lastOutgoingMessages` | GET | `?minutes=` |
| Queues | `showMessagesQueue` | GET | |
| | `clearMessagesQueue` | GET | |
| Read | `readChat` | POST | `{chatId, idMessage?}` |
| Service | `checkWhatsapp` | POST | `{phoneNumber}` |
| | `getAvatar` | POST | `{chatId}` |
| | `getContacts` | GET | |
| | `getChats` (v1) | GET | |
| | `getContactInfo` | POST | `{chatId}` |
| | `editMessage` | POST | `{chatId, idMessage, message}` |
| | `deleteMessage` | POST | `{chatId, idMessage, onlySenderDelete?}` |
| | `archiveChat` / `unarchiveChat` | POST | `{chatId}` |
| | `setDisappearingChat` | POST | `{chatId, ephemeralExpiration}` |
| Groups | `createGroup` | POST | `{groupName, chatIds}` |
| | `updateGroupName` | POST | `{groupId, groupName}` |
| | `getGroupData` | POST | `{groupId}` |
| | `addGroupParticipant` / `removeGroupParticipant` | POST | `{groupId, participantChatId}` |
| | `setGroupAdmin` / `removeAdmin` | POST | `{groupId, participantChatId}` |
| | `setGroupPicture` | POST multipart | `file, groupId` |
| | `leaveGroup` | POST | `{groupId}` |
| Statuses | `sendTextStatus` / `sendVoiceStatus` / `sendMediaStatus` | POST | |
| | `deleteStatus` | POST | `{idMessage}` |
| | `getStatusStatistic` | GET | `?idMessage=` |
| | `getIncomingStatuses` / `getOutgoingStatuses` | GET | `?minutes=` |
| Contacts | `addContact` / `editContact` / `deleteContact` | POST | |

Request and response field types: see the vendored SDK types in `gateway/src/contract/`.

## Key response shapes (observed in SDK types)

- `getStateInstance` → `{stateInstance: "notAuthorized"|"authorized"|"blocked"|"starting"|"yellowCard"}`
- `qr` → `{type: "qrCode"|"error"|"alreadyLogged", message}`. For `qrCode`, `message` is a base64 PNG (per docs).
- `getAuthorizationCode` → `{status, code}`
- `reboot` → `{isReboot}`. `logout` → `{isLogout}`. `setSettings` → `{saveSettings}`
- send* → `{idMessage}`
- `receiveNotification` → `{receiptId, body}`, or `null` when the timeout elapses
- `deleteNotification` → `{result: true}`

## Notifications (observed types + docs)

`typeWebhook`: `incomingMessageReceived`, `outgoingMessageReceived`,
`outgoingAPIMessageReceived`, `outgoingMessageStatus`, `stateInstanceChanged`,
`incomingCall` (plus edited/deleted/poll/block in Settings toggles).
Common envelope: `instanceData: {idInstance, wid, typeInstance}`, `timestamp` (unix s).
The v1 webhook router dispatches on `typeWebhook` + `_` + `messageData.typeMessage`.

Queue semantics (docs): FIFO, 24 h retention, at-least-once. A notification
stays at the head until it is deleted.

## Telegram

There is no GREEN-API Telegram SDK on npm. The contract comes from
https://green-api.com/en/telegram/docs/api/. The method set mirrors WhatsApp,
plus `startAuthorization`, `sendAuthorizationCode` and `sendAuthorizationPassword`.
The URL prefix still needs verifying in Phase 6.
