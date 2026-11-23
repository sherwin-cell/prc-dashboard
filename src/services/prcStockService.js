import { apiRequest } from "./apiClient";
import { logAdminAction } from "./auditService";

/**
 * "Blood available at PRC": blood_connect_backend
 * (POST /api/admin/requests/{id}/prc-stock) records prcStock /
 * prcStockNotices on the request, approves it if it was still pending, writes
 * the requester's in-app notification (pushed by FCM) and, when chatMessage
 * is given, posts it in their PRC Support chat.
 */
export async function notifyPrcStock(requestId, { reservedUnits, pickupInstructions, chatMessage }, adminUser) {
  const result = await apiRequest(`/api/admin/requests/${encodeURIComponent(requestId)}/prc-stock`, {
    method: "POST",
    body: {
      reservedUnits,
      pickupInstructions,
      ...(chatMessage ? { chatMessage } : {}),
    },
  });
  await logAdminAction(
    adminUser,
    "NOTIFY_PRC_STOCK",
    requestId,
    `${reservedUnits} unit(s) reserved at PRC${result.approved ? "; request approved" : ""}`
  );
  return result;
}
