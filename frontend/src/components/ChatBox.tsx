import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { getChatMessages, sendChatMessage } from "../utils/api";
import DonorBadge from "./DonorBadge";
import "./ChatBox.css";

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  createdAt: string;
}

export default function ChatBox() {
  const { user, login } = useAuth();
  const { getDonorStatus, loadDonorStatuses } = useDonor();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const loadedUsernamesRef = useRef<Set<string>>(new Set());

  const isAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 40;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load donor statuses for new usernames
  const loadNewDonorStatuses = useCallback(
    (msgs: ChatMessage[]) => {
      const newUsernames = msgs
        .map((m) => m.username)
        .filter((u) => !loadedUsernamesRef.current.has(u));
      if (newUsernames.length > 0) {
        newUsernames.forEach((u) => loadedUsernamesRef.current.add(u));
        loadDonorStatuses(newUsernames);
      }
    },
    [loadDonorStatuses]
  );

  // Initial load
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const data = await getChatMessages();
        setMessages(data.messages || []);
        const msgs = data.messages || [];
        if (msgs.length > 0) {
          lastTimestampRef.current = msgs[msgs.length - 1].createdAt;
        }
        loadNewDonorStatuses(msgs);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error("Failed to load chat:", err);
      }
    };
    fetchInitial();
  }, [loadNewDonorStatuses, scrollToBottom]);

  // Polling for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const since = lastTimestampRef.current;
        const data = await getChatMessages(since || undefined);
        const newMsgs: ChatMessage[] = data.messages || [];
        if (newMsgs.length > 0) {
          const wasAtBottom = isAtBottom();
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const filtered = newMsgs.filter((m) => !existingIds.has(m.id));
            if (filtered.length === 0) return prev;
            const combined = [...prev, ...filtered];
            // Keep max 100 messages
            return combined.length > 100 ? combined.slice(-100) : combined;
          });
          lastTimestampRef.current = newMsgs[newMsgs.length - 1].createdAt;
          loadNewDonorStatuses(newMsgs);
          if (wasAtBottom) setTimeout(scrollToBottom, 50);
        }
      } catch (err) {
        // Silent fail on poll
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isAtBottom, scrollToBottom, loadNewDonorStatuses]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const containsLink = (text: string): boolean => {
    const urlPattern = /https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.gg|\.co|\.xyz|\.dev/i;
    return urlPattern.test(text);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (cooldown > 0) return;

    if (!user) {
      const name = prompt("Enter your username to chat:");
      if (name && name.trim()) {
        login(name.trim());
      }
      return;
    }

    if (containsLink(inputValue)) {
      alert("Links are not allowed in chat.");
      return;
    }

    setSending(true);
    try {
      const sent = await sendChatMessage(user, inputValue.trim());
      // Optimistically add
      setMessages((prev) => {
        const combined = [...prev, sent];
        return combined.length > 100 ? combined.slice(-100) : combined;
      });
      lastTimestampRef.current = sent.createdAt;
      setInputValue("");
      setCooldown(15);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to send message";
      console.error("Chat send error:", msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h3>Sacred Discourse</h3>
      </div>
      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Be the first to speak.</div>
        )}
        {messages.map((msg) => {
          const donorStatus = getDonorStatus(msg.username);
          return (
            <div className="chat-message" key={msg.id}>
              <span className="chat-username">{msg.username}</span>
              {donorStatus?.tier && (
                <DonorBadge tier={donorStatus.tier} size="small" />
              )}
              <span className="chat-text">{msg.message}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <input
          className="chat-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={user ? "Speak thy mind..." : "Click here to chat..."}
          disabled={sending}
          onFocus={() => {
            if (!user) {
              const name = prompt("Enter your username to chat:");
              if (name && name.trim()) {
                login(name.trim());
              }
            }
          }}
          maxLength={200}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim() || sending || cooldown > 0}
        >
          {cooldown > 0 ? `${cooldown}s` : "Proclaim"}
        </button>
      </div>
    </div>
  );
}
