import { Navigate, useParams } from 'react-router-dom';

/**
 * /chat/:chatId opens that conversation in the main chat page, which handles
 * PRC support chats (reply) and donor–requester chats (read-only) the same
 * way everywhere. No greeting is sent from here: the mobile app sends the
 * support welcome when the user opens their chat.
 */
export default function AdminChatRoomPage() {
  const { chatId } = useParams();
  return <Navigate to="/chats" replace state={{ chatId }} />;
}
