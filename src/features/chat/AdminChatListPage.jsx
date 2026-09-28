import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

export default function AdminChatPage() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);

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
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
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
      } catch (err) {}
    }
  };
  // ----------------------------------------------

  // 1. Fetch all support chats in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChats(chatList);
      setLoadingChats(false);

      if (!selectedChat && chatList.length > 0) {
        setSelectedChat(chatList[0]);
      }
    }, (error) => {
      console.error("Error fetching chats: ", error);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch messages whenever an admin selects a chat
  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  // 3. Handle sending a reply as admin
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedChat) return;

    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
        senderId: 'prc_support_admin',
        message: text,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: `Admin: ${text}`,
        lastMessageTime: serverTimestamp(),
      }, { merge: true });

    } catch (error) {
      console.error("Failed to send reply:", error);
    }
  };

  if (loadingChats) {
    return <div className="p-8 text-center text-gray-500">Loading support conversations...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden select-none">

      {/* LEFT SIDE: Conversations List (Resizable Sidebar) */}
      <div 
        style={{ width: `${sidebarWidth}px` }} 
        className="border-r border-gray-200 flex flex-col bg-gray-50 relative flex-shrink-0 transition-all duration-75"
      >
        <div className="p-4 border-b border-gray-200 bg-white">
          {sidebarWidth > 150 ? (
            <>
              <h2 className="font-bold text-gray-800 text-lg">Conversations</h2>
              <p className="text-xs text-gray-500">PRC Support Inquiries</p>
            </>
          ) : (
            <div className="text-center font-bold text-red-700 text-lg">💬</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {chats.length === 0 ? (
            sidebarWidth > 150 && <p className="p-4 text-sm text-gray-400 text-center">No active chats found.</p>
          ) : (
            chats.map(chat => {
              const isSelected = selectedChat?.id === chat.id;
              const name = chat.userName || 'Anonymous User';
              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`p-4 cursor-pointer transition-colors flex flex-col gap-1 ${
                    isSelected ? 'bg-red-50 border-l-4 border-red-600' : 'hover:bg-gray-100'
                  }`}
                >
                  {sidebarWidth > 150 ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm text-gray-900 truncate">
                          {name}
                        </span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {chat.lastMessageTime?.toDate
                            ? chat.lastMessageTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {chat.lastMessage || 'No messages yet'}
                      </p>
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
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">
                  {selectedChat.userName || 'User Support'}
                </h3>
                <span className="text-[11px] text-green-600 font-medium">● Live Support Thread</span>
              </div>
            </div>

            {/* Messages View */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse space-y-reverse space-y-3 bg-gray-50">
              {messages.map((msg) => {
                const isAdmin = msg.senderId === 'prc_support_admin' || msg.senderId === 'prc_bot_support';
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-md p-3 rounded-2xl text-sm shadow-xs ${
                        isAdmin
                          ? 'bg-[#D32F2F] text-white rounded-br-sm'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white flex items-center gap-2">
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
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a conversation from the left to start messaging.
          </div>
        )}
      </div>

    </div>
  );
}