// chats/{chatId} kinds. Keep in sync with blood_connect_backend
// (notifications/worker.py) and the mobile chat screens.

/** Placeholder participant for PRC in support chats; not a real user. */
export const PRC_SUPPORT_ID = "prc_support_admin";

/**
 * Retired requester–donor chat: chats/match_{requestId}_{offerId}, type
 * "donor_match". No longer created (donors stay anonymous to requesters);
 * firestore.rules block the users from reading or writing old ones, and
 * PRC can only read them.
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
