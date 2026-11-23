import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { PRC_SUPPORT_ID, isMatchChat, matchChatTitle, senderName } from './chatTypes';
import { bloodRequestReference } from '../../utils/references';

const TABS = {
  support: { label: 'PRC Support', empty: 'No support conversations yet.' },
  match: { label: 'Donor–Requester', empty: 'No donor–requester chats yet. They open when PRC confirms a donor.' },
};

const formatTime = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export default function AdminChatPage() {
  // /chat/:chatId redirects here with the chat to open.
  const openChatId = useLocation().state?.chatId || null;
  const [chats, setChats] = useState([]);
  const [tab, setTab] = useState(openChatId?.startsWith('match_') ? 'match' : 'support');
  const [selectedId, setSelectedId] = useState(openChatId);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [requestRef, setRequestRef] = useState({});

  // --- SMOOTH RESIZABLE SIDEBAR STATES & LOGIC ---
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(320);
  const minWidth = 80;   // Minimum width (icon/avatar mode)
  const maxWidth = 480;  // Maximum width

  const handlePointerDown = (e) => {
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(sidebarWidth);
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (isResizing) {
      const newWidth = startWidth + (e.clientX - startX);
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (isResizing) {
      setIsResizing(false);
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer already released.
      }
    }
  };
  // ----------------------------------------------

  // 1. All chats in real time; split into support and donor–requester below.
  useEffect(() => {
    const q = query(collection(db, 'chats'), orderBy('lastMessageTime', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        setChats(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadError('');
        setLoadingChats(false);
      },
      (error) => {
        console.error('Error fetching chats: ', error);
        setLoadError('Could not load conversations. Check your connection and refresh.');
        setLoadingChats(false);
      }
    );
  }, []);

  const lists = useMemo(
    () => ({
      support: chats.filter((c) => !isMatchChat(c)),
      match: chats.filter(isMatchChat),
    }),
    [chats]
  );
  const visible = lists[tab];
  // Fall back to the newest chat in the tab when nothing (valid) is selected.
  const selectedChat = visible.find((c) => c.id === selectedId) || visible[0] || null;
  const readOnly = isMatchChat(selectedChat);

  // 2. Messages of the selected chat.
  const selectedChatId = selectedChat?.id;
  useEffect(() => {
    if (!selectedChatId) return undefined;
    const q = query(collection(db, 'chats', selectedChatId, 'messages'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error('Error fetching messages: ', error)
    );
  }, [selectedChatId]);

  // 3. Request reference ("BR-20261120-ABC") for donor–requester chats.
  const selectedRequestId = readOnly ? selectedChat?.requestId : null;
  useEffect(() => {
    if (!selectedRequestId || requestRef[selectedRequestId]) return;
    getDoc(doc(db, 'blood_requests', selectedRequestId))
      .then((snap) =>
        setRequestRef((prev) => ({
          ...prev,
          [selectedRequestId]: snap.exists()
            ? bloodRequestReference(selectedRequestId, snap.data().createdAt)
            : 'Request deleted',
        }))
      )
      .catch((error) => console.error('Error loading request reference:', error));
  }, [selectedRequestId, requestRef]);

  // 4. PRC reply, support chats only. No automatic greeting: the mobile app
  // sends the welcome when the user opens their support chat.
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedChat || readOnly) return;

    const text = inputText.trim();
    setInputText('');
    setSendError('');

    try {
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
        senderId: PRC_SUPPORT_ID,
        message: text,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'chats', selectedChat.id),
        { lastMessage: `Admin: ${text}`, lastMessageTime: serverTimestamp() },
        { merge: true }
      );
    } catch (error) {
      console.error('Failed to send reply:', error);
      setInputText(text);
      setSendError('Message not sent. Try again.');
    }
  };

  if (loadingChats) {
    return <div className="p-8 text-center text-gray-500">Loading conversations...</div>;
  }

  const titleOf = (chat) => (isMatchChat(chat) ? matchChatTitle(chat) : chat.userName || 'Anonymous User');

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden select-none">

      {/* LEFT SIDE: Conversations List (Resizable Sidebar) */}
      <div
        style={{ width: `${sidebarWidth}px` }}
        className="border-r border-gray-200 flex flex-col bg-gray-50 relative flex-shrink-0 transition-all duration-75"
      >
        <div className="p-4 border-b border-gray-200 bg-white space-y-3">
          {sidebarWidth > 150 ? (
            <>
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Conversations</h2>
                <p className="text-xs text-gray-500">
                  {tab === 'support' ? 'PRC Support Inquiries' : 'Chats between matched donors and requesters (read-only)'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl" role="tablist">
                {Object.entries(TABS).map(([key, { label }]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => { setTab(key); setSelectedId(null); }}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      tab === key ? 'bg-white text-[#D32F2F] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {label} <span className="font-semibold text-gray-400">{lists[key].length}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center font-bold text-red-700 text-lg">💬</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {loadError ? (
            <p role="alert" className="p-4 text-xs text-rose-700">{loadError}</p>
          ) : visible.length === 0 ? (
            sidebarWidth > 150 && <p className="p-4 text-sm text-gray-400 text-center">{TABS[tab].empty}</p>
          ) : (
            visible.map((chat) => {
              const isSelected = selectedChat?.id === chat.id;
              const name = titleOf(chat);
              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedId(chat.id)}
                  className={`p-4 cursor-pointer transition-colors flex flex-col gap-1 ${
                    isSelected ? 'bg-red-50 border-l-4 border-red-600' : 'hover:bg-gray-100'
                  }`}
                >
                  {sidebarWidth > 150 ? (
                    <>
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 truncate">{name}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(chat.lastMessageTime)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{chat.lastMessage || 'No messages yet'}</p>
                    </>
                  ) : (
                    <div className="flex justify-center" title={name}>
                      <span className="w-9 h-9 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                        {name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drag Handle */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute top-0 right-0 w-3 h-full cursor-col-resize bg-transparent hover:bg-red-200 transition flex items-center justify-center group z-10"
          title="Drag to resize sidebar"
        >
          <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-red-500 rounded-full"></div>
        </div>
      </div>

      {/* RIGHT SIDE: Active Chat Room */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedChat ? (
          <>
            {/* Chat Room Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-800 text-sm truncate">{titleOf(selectedChat)}</h3>
                {readOnly ? (
                  <span className="text-[11px] text-gray-500 font-medium">
                    Donor–requester chat · {requestRef[selectedChat.requestId] || 'Loading request…'}
                  </span>
                ) : (
                  <span className="text-[11px] text-green-600 font-medium">● Live Support Thread</span>
                )}
              </div>
              {readOnly && (
                <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  Read-only
                </span>
              )}
            </div>

            {/* Messages View */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse space-y-reverse space-y-3 bg-gray-50">
              {messages.length === 0 && (
                <p className="text-center text-xs text-gray-400">No messages yet.</p>
              )}
              {messages.map((msg) => {
                const fromPrc = msg.senderId === PRC_SUPPORT_ID || msg.senderId === 'prc_bot_support';
                // Support: PRC on the right. Donor–requester: the donor on the right.
                const rightSide = readOnly
                  ? msg.senderId === (selectedChat.participants || [])[1]
                  : fromPrc;
                return (
                  <div key={msg.id} className={`flex flex-col ${rightSide ? 'items-end' : 'items-start'}`}>
                    {readOnly && (
                      <span className="text-[10px] text-gray-400 mb-0.5 px-1">{senderName(selectedChat, msg.senderId)}</span>
                    )}
                    <div
                      className={`max-w-md p-3 rounded-2xl text-sm shadow-xs ${
                        fromPrc
                          ? 'bg-[#D32F2F] text-white rounded-br-sm'
                          : rightSide
                            ? 'bg-blue-50 border border-blue-100 text-gray-800 rounded-br-sm'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Bar (support chats only) */}
            {readOnly ? (
              <div className="p-3 border-t border-gray-200 bg-gray-50 text-center text-xs text-gray-500">
                This chat is between the requester and the donor. PRC can read it but not reply.
              </div>
            ) : (
              <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white space-y-1">
                {sendError && <p role="alert" className="text-xs text-rose-700 px-2">{sendError}</p>}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your reply as PRC staff..."
                    className="flex-1 bg-gray-100 border border-transparent rounded-full px-4 py-2 text-sm focus:outline-none focus:bg-white focus:border-red-500 transition-colors"
                  />
                  <button
                    type="submit"
                    className="bg-[#D32F2F] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition-colors shadow-xs"
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a conversation from the left to view it.
          </div>
        )}
      </div>

    </div>
  );
}
