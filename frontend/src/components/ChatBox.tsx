import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useDonor } from "../context/DonorContext";
import { getChatMessages, sendChatMessage, getPosts } from "../utils/api";
import { replaceEmoticons, CUSTOM_EMOJIS, STANDARD_EMOJIS } from "../utils/emoji";
import { useMediaQuery } from "../hooks/useMediaQuery";
import DonorBadge from "./DonorBadge";
import UserProfilePopup from "./UserProfilePopup";
import "./ChatBox.css";

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";

interface GiphyGif {
  id: string;
  images: {
    fixed_height_small: { url: string; width: string; height: string };
    fixed_height: { url: string; width: string; height: string };
    original: { url: string };
  };
  title: string;
}

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
  const { user, openLoginModal } = useAuth();
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
  const [replyTarget, setReplyTarget] = useState<{ username: string; message: string } | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<GiphyGif[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifPickerRef = useRef<HTMLDivElement>(null);
  const gifSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Giphy search — debounced
  const searchGiphy = useCallback(async (query: string) => {
    if (!GIPHY_API_KEY) return;
    setGifLoading(true);
    try {
      const endpoint = query.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query.trim())}&limit=20&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`;
      const res = await fetch(endpoint);
      const json = await res.json();
      setGifResults(json.data || []);
    } catch (err) {
      console.error("Giphy search failed:", err);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGifPicker && gifResults.length === 0 && GIPHY_API_KEY) {
      searchGiphy("");
    }
  }, [showGifPicker, gifResults.length, searchGiphy]);

  // Close GIF picker when clicking outside
  useEffect(() => {
    if (!showGifPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGifPicker]);

  const handleGifSearchChange = (value: string) => {
    setGifSearch(value);
    if (gifSearchTimeoutRef.current) clearTimeout(gifSearchTimeoutRef.current);
    gifSearchTimeoutRef.current = setTimeout(() => {
      searchGiphy(value);
    }, 400);
  };

  const sendGif = async (gif: GiphyGif) => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (cooldown > 0) return;

    const gifUrl = gif.images.original.url;
    setShowGifPicker(false);
    setGifSearch("");
    setSending(true);

    try {
      const sent = await sendChatMessage(user, gifUrl);
      setMessages((prev) => {
        const combined = [...prev, sent];
        return combined.length > 100 ? combined.slice(-100) : combined;
      });
      lastTimestampRef.current = sent.createdAt;
      setReplyTarget(null);
      setCooldown(15);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.error || "Failed to send GIF";
      if (data?.cooldown) setCooldown(data.cooldown);
      if (data?.muted) {
        const muteMsg: ChatMessage = {
          id: `mute-${Date.now()}`,
          username: "⚠️ System",
          message: msg,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, muteMsg]);
        setTimeout(scrollToBottom, 50);
      }
      console.error("GIF send error:", msg);
    } finally {
      setSending(false);
    }
  };

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
    // On mobile, keep picker open so users can tap multiple emojis
    // On desktop, close picker and refocus input
    if (!isMobile) {
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    }
  };

  const containsLink = (text: string): boolean => {
    const urlPattern = /https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.gg|\.co|\.xyz|\.dev/i;
    return urlPattern.test(text);
  };

  // Must match backend's isAllowedGifUrl in chatRoutes.ts
  // These are dedicated media CDNs — domain match alone is sufficient
  const ALLOWED_GIF_DOMAINS = [
    /^https:\/\/media[0-9]*\.giphy\.com\//,
    /^https:\/\/i\.giphy\.com\//,
    /^https:\/\/giphy\.com\/gifs\//,
    /^https:\/\/media\.tenor\.com\//,
    /^https:\/\/c\.tenor\.com\//,
    /^https:\/\/tenor\.com\/view\//,
    /^https:\/\/i\.imgur\.com\//,
    /^https:\/\/media\.discordapp\.net\//,
  ];

  const isAllowedGifUrl = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.includes(" ") || trimmed.includes("\n")) return false;
    if (!trimmed.startsWith("https://")) return false;
    if (!ALLOWED_GIF_DOMAINS.some((pattern) => pattern.test(trimmed))) return false;
    return true;
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (cooldown > 0) return;

    if (!user) {
      openLoginModal();
      return;
    }

    if (containsLink(inputValue) && !isAllowedGifUrl(inputValue)) {
      alert("Links are not allowed in chat. (GIFs from Giphy, Tenor, and Imgur are allowed)");
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
      setReplyTarget(null);
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

  const handleReply = (msg: ChatMessage) => {
    if (!user) {
      openLoginModal();
      return;
    }
    setReplyTarget({ username: msg.username, message: msg.message });
    setInputValue(`@${msg.username} `);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTarget(null);
    // Remove the @username prefix if it's still at the start
    setInputValue((prev) => {
      if (replyTarget && prev.startsWith(`@${replyTarget.username} `)) {
        return prev.slice(`@${replyTarget.username} `.length);
      }
      return prev;
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;

    // Check HTML content first — when you "Copy Image" from a browser,
    // the clipboard often contains an <img src="..."> in the HTML flavor
    const html = clipboardData.getData("text/html");
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1] && isAllowedGifUrl(match[1])) {
        e.preventDefault();
        setInputValue(match[1]);
        return;
      }
    }

    // Check plain text — sometimes the URL comes through as plain text
    const text = clipboardData.getData("text/plain");
    if (text && isAllowedGifUrl(text.trim())) {
      e.preventDefault();
      setInputValue(text.trim());
      return;
    }

    // Otherwise let the default paste behavior happen (normal text)
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyTarget) {
      cancelReply();
    }
  };

  const renderMessageContent = (message: string) => {
    if (isAllowedGifUrl(message)) {
      return (
        <div className="chat-gif-container">
          <img
            src={message.trim()}
            alt="GIF"
            className="chat-gif"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              if (e.currentTarget.parentElement) {
                const fallback = document.createElement("span");
                fallback.className = "chat-text";
                fallback.textContent = "[GIF failed to load]";
                e.currentTarget.parentElement.appendChild(fallback);
              }
            }}
          />
        </div>
      );
    }

    // Detect @username reply prefix
    const replyMatch = message.match(/^@(\S+)\s(.*)/s);
    if (replyMatch) {
      const replyTo = replyMatch[1];
      const rest = replyMatch[2];
      return (
        <>
          <span className="chat-reply-tag" style={{ color: getUsernameColor(replyTo) }}>
            ↩ @{replyTo}
          </span>
          <span className="chat-text">{rest}</span>
        </>
      );
    }

    return <span className="chat-text">{message}</span>;
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
            <div
              className="chat-message"
              key={msg.id}
              onClick={() => handleReply(msg)}
              style={{ cursor: "pointer" }}
            >
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
              {renderMessageContent(msg.message)}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {/* Reply banner */}
      {replyTarget && (
        <div className="chat-reply-banner">
          <span className="chat-reply-banner-text">
            Replying to <strong style={{ color: getUsernameColor(replyTarget.username) }}>@{replyTarget.username}</strong>
          </span>
          <button className="chat-reply-cancel" onClick={cancelReply} aria-label="Cancel reply">
            ✕
          </button>
        </div>
      )}
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
        {/* GIF Search Picker */}
        {showGifPicker && (
          <div className="chat-gif-picker" ref={gifPickerRef}>
            <div className="gif-picker-header">
              <input
                className="gif-search-input"
                type="text"
                value={gifSearch}
                onChange={(e) => handleGifSearchChange(e.target.value)}
                placeholder="Search GIFs..."
                autoFocus
              />
            </div>
            <div className="gif-picker-grid">
              {gifLoading && (
                <div className="gif-picker-loading">Searching...</div>
              )}
              {!gifLoading && gifResults.length === 0 && !GIPHY_API_KEY && (
                <div className="gif-picker-empty">Giphy API key not configured</div>
              )}
              {!gifLoading && gifResults.length === 0 && GIPHY_API_KEY && (
                <div className="gif-picker-empty">No GIFs found</div>
              )}
              {gifResults.map((gif) => (
                <button
                  key={gif.id}
                  className="gif-picker-item"
                  onClick={() => sendGif(gif)}
                  title={gif.title}
                >
                  <img
                    src={gif.images.fixed_height_small.url}
                    alt={gif.title}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            <div className="gif-picker-attribution">
              Powered by GIPHY
            </div>
          </div>
        )}
        <button
          className="chat-emoji-toggle"
          onClick={() => {
            setShowEmojiPicker((prev) => !prev);
            setShowGifPicker(false);
          }}
          type="button"
        >
          😀
        </button>
        {GIPHY_API_KEY && (
          <button
            className="chat-gif-toggle"
            onClick={() => {
              setShowGifPicker((prev) => !prev);
              setShowEmojiPicker(false);
            }}
            type="button"
            title="Search GIFs"
          >
            GIF
          </button>
        )}
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(replaceEmoticons(e.target.value))}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={user ? "Speak thy mind..." : "Click here to chat..."}
          disabled={sending}
          onFocus={(e) => {
            if (!user) {
              e.target.blur();
              openLoginModal();
            }
          }}
          maxLength={500}
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
