// Emoticon-to-emoji auto-replace (triggered after typing a space or at end of input)
export const EMOTICON_MAP: Record<string, string> = {
  ":)": "😊",
  ":D": "😃",
  ":d": "😃",
  ":(": "😞",
  ":P": "😛",
  ":p": "😛",
  ";)": "😉",
  ":O": "😮",
  ":o": "😮",
  "XD": "😆",
  "xD": "😆",
  "xd": "😆",
  "<3": "❤️",
  ":*": "😘",
  "B)": "😎",
  ":/": "😕",
  ":|": "😐",
  ">:(": "😡",
  ":'(": "😢",
  ":')": "🥲",
  "O:)": "😇",
  "o:)": "😇",
  ">:)": "😈",
  ":fire:": "🔥",
  ":skull:": "💀",
  ":100:": "💯",
  ":pray:": "🙏",
  ":clap:": "👏",
  ":thumbsup:": "👍",
  ":thumbsdown:": "👎",
  ":heart:": "❤️",
  ":star:": "⭐",
  ":crown:": "👑",
  ":trophy:": "🏆",
  ":eyes:": "👀",
  ":muscle:": "💪",
  ":party:": "🎉",
  ":poop:": "💩",
  ":brain:": "🧠",
  ":diamond:": "💎",
  // Flexible Morals custom emotes
  ":offer:": "🙏",
  ":tablet:": "🪨",
  ":amend:": "🔄",
  ":witness:": "👁️",
  ":heresy:": "🔥",
  ":vote:": "🗳️",
  ":moralgray:": "🧠",
  ":repent:": "🧎",
  ":canon:": "✨",
  ":goodword:": "🕊️",
};

export function replaceEmoticons(text: string): string {
  let result = text;
  for (const [emoticon, emoji] of Object.entries(EMOTICON_MAP)) {
    // Only replace if the emoticon is followed by a space or is at the end
    const escaped = emoticon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped + "(?=\\s|$)", "g"), emoji);
  }
  return result;
}

// Flexible Morals custom emotes for the picker
export const CUSTOM_EMOJIS = [
  { emoji: "🙏", label: ":offer:" },
  { emoji: "🪨", label: ":tablet:" },
  { emoji: "🔄", label: ":amend:" },
  { emoji: "👁️", label: ":witness:" },
  { emoji: "🔥", label: ":heresy:" },
  { emoji: "🗳️", label: ":vote:" },
  { emoji: "🧠", label: ":moralgray:" },
  { emoji: "🧎", label: ":repent:" },
  { emoji: "✨", label: ":canon:" },
  { emoji: "🕊️", label: ":goodword:" },
];

// Standard emojis for the picker
export const STANDARD_EMOJIS = [
  "😀","😂","🤣","😍","🥰","😎","🤔","😱","😡","🥺",
  "👍","👎","👏","🙏","🔥","❤️","💀","💯","✨","⭐",
  "🎉","🎊","😈","👀","🤡","💪","🫡","😤","🥳","😇",
  "⚡","🌟","💎","🏆","👑","🗡️","⚖️","📜","🛡️","✝️",
];
