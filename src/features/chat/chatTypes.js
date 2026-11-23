// chats/{chatId} kinds. Keep in sync with blood_connect_backend
// (notifications/match_chat.py) and the mobile chat screens.

/** Placeholder participant for PRC in support chats; not a real user. */
export const PRC_SUPPORT_ID = "prc_support_admin";

/**
 * Requester–donor chat the backend opens when PRC confirms an offer:
 * chats/match_{requestId}_{offerId}, type "donor_match".
 * These are between the two users; PRC only reads them.
 */
export const isMatchChat = (chat) =>
  chat?.type === "donor_match" || String(chat?.id || "").startsWith("match_");

/** "Requester name ↔ Donor name" from participantNames, in participant order. */
export function matchChatTitle(chat) {
  const names = chat?.participantNames || {};
  const [requesterId, donorId] = chat?.participants || [];
  return `${names[requesterId] || "Requester"} ↔ ${names[donorId] || "Donor"}`;
}

/** Name shown for a message sender. */
export function senderName(chat, senderId) {
  if (senderId === PRC_SUPPORT_ID || senderId === "prc_bot_support") return "PRC Support";
  const names = chat?.participantNames || {};
  if (names[senderId]) return names[senderId];
  if (isMatchChat(chat)) {
    const [requesterId] = chat?.participants || [];
    return senderId === requesterId ? "Requester" : "Donor";
  }
  return chat?.userName || "User";
}
