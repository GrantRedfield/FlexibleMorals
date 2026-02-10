import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { getChatMessages, sendChatMessage, getPosts } from "../utils/api";
import { replaceEmoticons, CUSTOM_EMOJIS, STANDARD_EMOJIS } from "../utils/emoji";
import { useMediaQuery } from "../hooks/useMediaQuery";
import DonorBadge from "./DonorBadge";
import UserProfilePopup from "./UserProfilePopup";
import "./ChatBox.css";

// Twitch-style username colors — 15 bright, readable colors on dark backgrounds
const TWITCH_COLORS = [
  "#FF0000", // Red
  "#0000FF", // Blue
  "#00FF00", // Green
  "#B22222", // FireBrick
  "#FF7F50", // Coral
  "#9ACD32", // YellowGreen
  "#FF4500", // OrangeRed
  "#2E8B57", // SeaGreen
  "#DAA520", // GoldenRod
  "#D2691E", // Chocolate
  "#5F9EA0", // CadetBlue
  "#1E90FF", // DodgerBlue
  "#FF69B4", // HotPink
  "#8A2BE2", // BlueViolet
  "#00FF7F", // SpringGreen
];

// Deterministic hash so the same username always gets the same color
function getUsernameColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit int
  }
  return TWITCH_COLORS[Math.abs(hash) % TWITCH_COLORS.length];
}

// Emoticon map and replaceEmoticons imported from ../utils/emoji

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  createdAt: string;
}

export default function ChatBox() {
  const { user, login } = useAuth();
  const { getDonorStatus, loadDonorStatuses } = useDonor();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [profilePopup, setProfilePopup] = useState<{ username: string; x: number; y: number } | null>(null);
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

  // Load posts for blessings calculation
  useEffect(() => {
    getPosts().then((data) => setAllPosts(data)).catch(() => {});
  }, []);

  const getBlessings = useCallback(
    (username: string): number => {
      return allPosts
        .filter((p: any) => p.username === username)
        .reduce((sum: number, p: any) => sum + (p.votes ?? 0), 0);
    },
    [allPosts]
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

  // Scroll to bottom when mobile chat is expanded
  useEffect(() => {
    if (mobileExpanded) {
      setTimeout(scrollToBottom, 150);
    }
  }, [mobileExpanded, scrollToBottom]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const insertEmoji = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const containsLink = (text: string): boolean => {
    const urlPattern = /https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.gg|\.co|\.xyz|\.dev/i;
    return urlPattern.test(text);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (cooldown > 0) return;

    if (!user) {
      const name = prompt("Enter your username:");
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
      const data = err?.response?.data;
      const msg = data?.error || "Failed to send message";

      // If server returned a cooldown (progressive mute), use that instead of default
      if (data?.cooldown) {
        setCooldown(data.cooldown);
      }

      if (data?.muted) {
        // Show mute warning as a system message in chat
        const muteMsg: ChatMessage = {
          id: `mute-${Date.now()}`,
          username: "⚠️ System",
          message: msg,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, muteMsg]);
        setTimeout(scrollToBottom, 50);
      }

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
    <div className={`chat-box${isMobile && mobileExpanded ? " chat-mobile-expanded" : ""}`}>
      {/* Mobile FAB toggle */}
      <button
        className="chat-mobile-toggle"
        onClick={() => setMobileExpanded(true)}
        aria-label="Open chat"
      >
        💬
      </button>

      <div className="chat-header">
        <h3>Sacred Discourse</h3>
        <button
          className="chat-mobile-close"
          onClick={() => setMobileExpanded(false)}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>
      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Be the first to speak.</div>
        )}
        {messages.map((msg) => {
          const donorStatus = getDonorStatus(msg.username);
          return (
            <div className="chat-message" key={msg.id}>
              <span
                className="chat-username"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfilePopup({ username: msg.username, x: e.clientX, y: e.clientY });
                }}
                style={{ cursor: "pointer", color: getUsernameColor(msg.username) }}
              >
                {msg.username}
              </span>
              {donorStatus?.tier && (
                <DonorBadge tier={donorStatus.tier} size="small" />
              )}
              <span className="chat-text">{msg.message}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area" style={{ position: "relative" }}>
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="chat-emoji-picker" ref={emojiPickerRef}>
            {/* Flexible Morals custom emotes */}
            <div className="emoji-section-label">Flexible Morals</div>
            {CUSTOM_EMOJIS.map((item) => (
              <button
                key={item.label}
                className="chat-emoji-btn chat-emoji-custom"
                onClick={() => insertEmoji(item.emoji)}
                title={item.label}
              >
                {item.emoji}
              </button>
            ))}
            {/* Standard emojis */}
            <div className="emoji-section-label">Standard</div>
            {STANDARD_EMOJIS.map((emoji) => (
              <button
                key={`std-${emoji}`}
                className="chat-emoji-btn"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <button
          className="chat-emoji-toggle"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          type="button"
        >
          😀
        </button>
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(replaceEmoticons(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder={user ? "Speak thy mind..." : "Click here to chat..."}
          disabled={sending}
          onFocus={(e) => {
            if (!user) {
              e.target.blur();
              const name = prompt("Enter your username:");
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

      {/* User Profile Popup */}
      {profilePopup && (
        <UserProfilePopup
          username={profilePopup.username}
          blessings={getBlessings(profilePopup.username)}
          donorTier={getDonorStatus(profilePopup.username)?.tier}
          position={{ x: profilePopup.x, y: profilePopup.y }}
          onClose={() => setProfilePopup(null)}
        />
      )}
    </div>
  );
}
