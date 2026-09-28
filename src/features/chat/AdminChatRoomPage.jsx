import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

export default function AdminChatRoomPage() {
  const { chatId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [userName, setUserName] = useState(location.state?.userName || 'Loading User...');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

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

  // 1. Fetch user's actual name
  useEffect(() => {
    const fetchUserName = async () => {
      let resolvedName = location.state?.userName;

      if (!resolvedName) {
        try {
          const userSnap = await getDoc(doc(db, 'users', chatId));
          if (userSnap.exists() && userSnap.data().fullName) {
            resolvedName = userSnap.data().fullName;
          } else {
            const chatSnap = await getDoc(doc(db, 'chats', chatId));
            if (chatSnap.exists()) {
              const chatData = chatSnap.data();
              const targetUserId = chatData.userId || (chatData.participants && chatData.participants.find(id => id !== 'prc_support_admin'));
              if (targetUserId) {
                const targetUserSnap = await getDoc(doc(db, 'users', targetUserId));
                if (targetUserSnap.exists() && targetUserSnap.data().fullName) {
                  resolvedName = targetUserSnap.data().fullName;
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user name:", error);
        }
      }

      setUserName(resolvedName || 'User Support');
    };

    fetchUserName();
  }, [chatId, location.state]);

  // 2. Listen to messages and trigger automatic greeting if empty
  useEffect(() => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);

      if (snapshot.empty && !isInitialized && userName !== 'Loading User...') {
        setIsInitialized(true);
        try {
          const welcomeMessage = `Hi ${userName}, what can we help you today?`;

          await addDoc(messagesRef, {
            senderId: 'prc_support_admin',
            message: welcomeMessage,
            createdAt: serverTimestamp(),
          });

          await setDoc(doc(db, 'chats', chatId), {
            lastMessage: `Admin: ${welcomeMessage}`,
            lastMessageTime: serverTimestamp(),
          }, { merge: true });

        } catch (error) {
          console.error("Failed to send automatic greeting:", error);
        }
      }
    });

    return () => unsubscribe();
  }, [chatId, userName, isInitialized]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: 'prc_support_admin',
        message: text,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: `Admin: ${text}`,
        lastMessageTime: serverTimestamp(),
      }, { merge: true });

    } catch (error) {
      console.error("Failed to send reply:", error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-700 text-white p-4 flex items-center shadow">
        <button onClick={() => navigate(-1)} className="mr-4 font-bold">← Back</button>
        <h2 className="text-lg font-semibold">{userName} (PRC Support Thread)</h2>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden select-none">
        
        {/* LEFT: CONVERSATIONS SIDEBAR */}
        <div 
          style={{ width: `${sidebarWidth}px` }} 
          className="bg-white border-r flex flex-col relative flex-shrink-0 transition-all duration-75"
        >
          <div className="p-4 border-b">
            {sidebarWidth > 150 ? (
              <>
                <h3 className="font-bold text-gray-800">Conversations</h3>
                <p className="text-xs text-gray-500">PRC Support Inquiries</p>
              </>
            ) : (
              <div className="text-center font-bold text-red-700">💬</div>
            )}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 border-b cursor-pointer bg-red-50 border-l-4 border-red-700">
              {sidebarWidth > 150 ? (
                <div>
                  <p className="font-semibold text-sm text-gray-800">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">Active chat room</p>
                </div>
              ) : (
                <div className="flex justify-center" title={userName}>
                  <span className="w-8 h-8 bg-red-700 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                    {userName.charAt(0)}
                  </span>
                </div>
              )}
            </div>
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

        {/* RIGHT: CHAT ROOM AREA */}
        <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse space-y-reverse space-y-3">
            {messages.map((msg) => {
              const isAdmin = msg.senderId === 'prc_support_admin' || msg.senderId === 'prc_bot_support';
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-md p-3 rounded-lg text-sm ${isAdmin ? 'bg-white border text-gray-800 shadow-sm' : 'bg-red-600 text-white'}`}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="bg-white p-3 border-t flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type reply as PRC Admin..."
              className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:border-red-500 text-sm"
            />
            <button type="submit" className="ml-3 bg-red-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-red-700">
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}