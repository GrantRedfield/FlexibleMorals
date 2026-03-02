// Only load .env in local dev — production uses real IAM credentials
if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { client, TABLE_NAME } from "../lib/dynamodb.ts";

// ============================================================
// 10 Fresh Usernames
// ============================================================

const AUTHORS = [
  "jake_from_maine",
  "quietstormm",
  "linds_22",
  "big_ted_talks",
  "morningglory_k",
  "not_a_robot_07",
  "danielle_rae",
  "the_real_steve",
  "pocketwatch_phil",
  "sunsetsally",
];

// ============================================================
// 10 Commandments — 5 serious, 5 funny, alternating
// Votes 3–12, dates spread across early March 2026
// ============================================================

const COMMANDMENTS = [
  // #1 — Always on top
  { text: "Thou Shall Not Murder", author: AUTHORS[0], votes: 25, day: 1, hour: 6, min: 0 },
  // Serious
  { text: "Thou shalt protect the vulnerable even when it costs thee", author: AUTHORS[0], votes: 12, day: 1, hour: 8, min: 20 },
  // Funny
  { text: "Thou shalt not wear socks with sandals unless thou art a dad", author: AUTHORS[1], votes: 10, day: 1, hour: 13, min: 45 },
  // Serious
  { text: "Thou shalt listen more than thou speakest", author: AUTHORS[2], votes: 9, day: 2, hour: 9, min: 10 },
  // Funny
  { text: "Thou shalt not take the last slice without offering it first", author: AUTHORS[3], votes: 8, day: 2, hour: 15, min: 30 },
  // Serious
  { text: "Thou shalt forgive but remember the lesson", author: AUTHORS[4], votes: 7, day: 3, hour: 7, min: 55 },
  // Funny
  { text: "Thou shalt not send voice messages longer than 30 seconds", author: AUTHORS[5], votes: 6, day: 3, hour: 12, min: 15 },
  // Serious
  { text: "Thou shalt not profit from another's suffering", author: AUTHORS[6], votes: 5, day: 4, hour: 10, min: 40 },
  // Funny
  { text: "Thou shalt return thy shopping cart to the corral", author: AUTHORS[7], votes: 5, day: 4, hour: 17, min: 5 },
  // Serious
  { text: "Thou shalt teach thy children kindness before ambition", author: AUTHORS[8], votes: 4, day: 5, hour: 8, min: 0 },
  // Funny
  { text: "Thou shalt not recline thy airplane seat during a short flight", author: AUTHORS[9], votes: 3, day: 5, hour: 14, min: 25 },
];

// ============================================================
// Chat messages — a brief exchange referencing the new commandments
// ============================================================

const CHAT_MESSAGES = [
  { username: AUTHORS[0], message: "just submitted one about protecting the vulnerable", minutesAgo: 300 },
  { username: AUTHORS[1], message: "jake that's solid, voted it up", minutesAgo: 298 },
  { username: AUTHORS[3], message: "ok but did anyone see the socks and sandals one", minutesAgo: 295 },
  { username: AUTHORS[1], message: "guilty as charged lol", minutesAgo: 293 },
  { username: AUTHORS[2], message: "the listening commandment is underrated honestly", minutesAgo: 290 },
  { username: AUTHORS[5], message: "I submitted the voice message one because my mom sends 4 minute voice notes", minutesAgo: 287 },
  { username: AUTHORS[4], message: "lmaooo 4 minutes??", minutesAgo: 285 },
  { username: AUTHORS[5], message: "she has a lot of feelings", minutesAgo: 283 },
  { username: AUTHORS[7], message: "the shopping cart one is the ultimate test of character", minutesAgo: 280 },
  { username: AUTHORS[6], message: "steve that's actually deep in a weird way", minutesAgo: 278 },
  { username: AUTHORS[7], message: "no one's watching, no reward, you just do the right thing", minutesAgo: 276 },
  { username: AUTHORS[8], message: "that's basically the whole site in one sentence", minutesAgo: 274 },
  { username: AUTHORS[9], message: "the airplane seat one is gonna start a war", minutesAgo: 271 },
  { username: AUTHORS[3], message: "I'm already prepared for debate", minutesAgo: 269 },
  { username: AUTHORS[0], message: "sally you're brave for that one", minutesAgo: 267 },
  { username: AUTHORS[9], message: "I said what I said", minutesAgo: 265 },
  { username: AUTHORS[2], message: "I love how we have actual moral philosophy next to pizza etiquette", minutesAgo: 262 },
  { username: AUTHORS[4], message: "that's the whole point of flexible morals right", minutesAgo: 260 },
  { username: AUTHORS[6], message: "the forgiveness one really hit me today", minutesAgo: 257 },
  { username: AUTHORS[8], message: "same. forgive but remember the lesson is real", minutesAgo: 255 },
  { username: AUTHORS[1], message: "ok but who here actually returns their shopping cart every time", minutesAgo: 252 },
  { username: AUTHORS[7], message: "EVERY. TIME.", minutesAgo: 250 },
  { username: AUTHORS[5], message: "steve takes this personally", minutesAgo: 248 },
  { username: AUTHORS[3], message: "the last slice commandment should be taught in schools", minutesAgo: 245 },
  { username: AUTHORS[0], message: "honestly all of these should be taught in schools", minutesAgo: 243 },
  { username: AUTHORS[9], message: "curriculum: flexible morals 101", minutesAgo: 241 },
  { username: AUTHORS[2], message: "I'd take that class", minutesAgo: 239 },
  { username: AUTHORS[4], message: "professor quietstormm teaching socks and sandals ethics", minutesAgo: 237 },
  { username: AUTHORS[1], message: "I'd be honored", minutesAgo: 235 },
  { username: AUTHORS[6], message: "this community is something special honestly", minutesAgo: 232 },
  { username: AUTHORS[8], message: "agreed. good vibes only in here", minutesAgo: 230 },
  { username: AUTHORS[7], message: "thou shalt keep the good vibes going", minutesAgo: 228 },
];

// ============================================================
// Helpers
// ============================================================

function randomId(len = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateUserVotes(
  author: string,
  targetNetVotes: number
): Record<string, { S: string }> {
  const map: Record<string, { S: string }> = {};

  // Author always votes up
  map[author] = { S: "up" };

  // Fill with random voter IDs for remaining upvotes
  let upsRemaining = targetNetVotes - 1;
  while (upsRemaining > 0) {
    const id = `voter_${randomId(6)}`;
    if (!map[id]) {
      map[id] = { S: "up" };
      upsRemaining--;
    }
  }

  return map;
}

// ============================================================
// Insert commandments (additive — no deletes)
// ============================================================

async function insertCommandments(): Promise<void> {
  console.log("\nInserting commandments:");
  for (const cmd of COMMANDMENTS) {
    // March 2026 = month index 2
    const createdAt = new Date(2026, 2, cmd.day, cmd.hour, cmd.min).toISOString();
    const id = Date.parse(createdAt).toString();
    const map = generateUserVotes(cmd.author, cmd.votes);

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: `POST#${id}` },
          SK: { S: "META#POST" },
          title: { S: cmd.text },
          body: { S: cmd.text },
          votes: { N: String(cmd.votes) },
          authorId: { S: cmd.author },
          createdAt: { S: createdAt },
          userVotes: { M: map },
        },
      })
    );

    console.log(`  [${cmd.votes}v] ${cmd.author}: ${cmd.text}`);
  }
}

// ============================================================
// Insert chat messages (additive — no deletes)
// ============================================================

async function insertChatMessages(): Promise<void> {
  console.log("\nInserting chat messages:");
  const now = Date.now();

  for (const msg of CHAT_MESSAGES) {
    const createdAt = new Date(now - msg.minutesAgo * 60 * 1000).toISOString();
    const messageId = randomId(8);

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: "CHAT#global" },
          SK: { S: `MSG#${createdAt}#${messageId}` },
          messageId: { S: messageId },
          username: { S: msg.username },
          message: { S: msg.message },
          createdAt: { S: createdAt },
        },
      })
    );

    console.log(`  ${msg.username}: ${msg.message}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("Adding seed commandments to FlexibleMorals database...");
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("Mode: ADDITIVE (no deletes)");

  await insertCommandments();
  await insertChatMessages();

  console.log(`\nDone. ${COMMANDMENTS.length} commandments and ${CHAT_MESSAGES.length} chat messages added.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
