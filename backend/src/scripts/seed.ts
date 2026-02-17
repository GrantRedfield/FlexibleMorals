import "dotenv/config";
import {
  ScanCommand,
  DeleteItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { client, TABLE_NAME } from "../lib/dynamodb.ts";

// ============================================================
// 10 Believable Usernames
// ============================================================

const AUTHORS = [
  "marcus_t",
  "jenna_speaks",
  "oldmanwinters",
  "nora_faye",
  "dusty_roads99",
  "halftime_hero",
  "savannah_k",
  "thecalmdude",
  "rita_in_reno",
  "brickwall_ben",
];

// ============================================================
// 10 Commandments — mix of serious and witty/funny
// "Thou Shall Not Murder" is #1 (highest votes)
// ============================================================

const COMMANDMENTS = [
  // Serious
  { text: "Thou Shall Not Murder", author: AUTHORS[0], votes: 12, day: 1, hour: 9, min: 15 },
  // Funny
  { text: "Thou shalt not microwave fish in the office", author: AUTHORS[4], votes: 9, day: 1, hour: 11, min: 42 },
  // Serious
  { text: "Thou shalt not lie to those who trust thee", author: AUTHORS[1], votes: 8, day: 1, hour: 14, min: 5 },
  // Funny
  { text: "Thou shalt not ghost someone after three dates", author: AUTHORS[8], votes: 7, day: 2, hour: 8, min: 30 },
  // Serious
  { text: "Thou shalt stand up for those who cannot stand alone", author: AUTHORS[3], votes: 6, day: 2, hour: 12, min: 20 },
  // Funny
  { text: "Thou shalt use thy turn signal", author: AUTHORS[5], votes: 5, day: 2, hour: 16, min: 50 },
  // Serious
  { text: "Thou shalt admit when thou art wrong", author: AUTHORS[7], votes: 5, day: 3, hour: 7, min: 10 },
  // Funny
  { text: "Thou shalt not reply all to company-wide emails", author: AUTHORS[6], votes: 4, day: 3, hour: 10, min: 45 },
  // Serious
  { text: "Thou shalt leave the world better than thou found it", author: AUTHORS[9], votes: 3, day: 3, hour: 15, min: 25 },
  // Funny
  { text: "Thou shalt not spoil the ending", author: AUTHORS[2], votes: 3, day: 4, hour: 9, min: 0 },
];

// ============================================================
// Chat conversation — a brief exchange between the 10 users
// ============================================================

const CHAT_MESSAGES = [
  // Original conversation (oldest messages)
  { username: AUTHORS[0], message: "alright who put the murder one up there", minutesAgo: 360 },
  { username: AUTHORS[0], message: "oh wait that was me", minutesAgo: 359 },
  { username: AUTHORS[4], message: "I'm just glad the fish commandment is getting love", minutesAgo: 357 },
  { username: AUTHORS[1], message: "dusty that one is personal for you huh", minutesAgo: 355 },
  { username: AUTHORS[4], message: "you have NO idea what I've been through", minutesAgo: 353 },
  { username: AUTHORS[8], message: "the ghosting one is gonna be controversial lol", minutesAgo: 350 },
  { username: AUTHORS[5], message: "honestly the turn signal one should be number one", minutesAgo: 348 },
  { username: AUTHORS[3], message: "I love that we have serious ones and funny ones", minutesAgo: 345 },
  { username: AUTHORS[7], message: "that's the beauty of democracy", minutesAgo: 343 },
  { username: AUTHORS[6], message: "the reply all commandment is saving corporate america", minutesAgo: 340 },
  { username: AUTHORS[2], message: "whoever spoils a show finale deserves jail time", minutesAgo: 337 },
  { username: AUTHORS[9], message: "ben that's a little extreme", minutesAgo: 335 },
  { username: AUTHORS[2], message: "is it though", minutesAgo: 333 },
  { username: AUTHORS[1], message: "the mix of silly and real ones is what makes this work", minutesAgo: 330 },
  { username: AUTHORS[7], message: "agreed. morals don't have to be boring", minutesAgo: 327 },
  { username: AUTHORS[3], message: "the serious ones hit different when they're next to a fish joke", minutesAgo: 324 },
  { username: AUTHORS[5], message: "flexible morals flexible vibes", minutesAgo: 321 },
  { username: AUTHORS[0], message: "ok but for real don't murder people", minutesAgo: 318 },

  // Extended conversation — lunch break debate
  { username: AUTHORS[8], message: "wait can we talk about the dating commandments", minutesAgo: 300 },
  { username: AUTHORS[1], message: "oh here we go", minutesAgo: 298 },
  { username: AUTHORS[8], message: "three dates is not enough time to decide anything", minutesAgo: 296 },
  { username: AUTHORS[6], message: "agree to disagree rita", minutesAgo: 294 },
  { username: AUTHORS[3], message: "I think the point is just don't disappear without a word", minutesAgo: 292 },
  { username: AUTHORS[8], message: "ok fine that's fair", minutesAgo: 290 },
  { username: AUTHORS[5], message: "brb someone just cut me off without signaling", minutesAgo: 288 },
  { username: AUTHORS[0], message: "halftime living the commandment life in real time", minutesAgo: 286 },
  { username: AUTHORS[7], message: "this is exactly why we need these rules lol", minutesAgo: 284 },
  { username: AUTHORS[4], message: "I'm filing a formal complaint about the microwave in building C", minutesAgo: 282 },
  { username: AUTHORS[9], message: "dusty let it go", minutesAgo: 280 },
  { username: AUTHORS[4], message: "NEVER", minutesAgo: 278 },

  // Philosophical tangent
  { username: AUTHORS[7], message: "serious question though — who decides what's moral", minutesAgo: 270 },
  { username: AUTHORS[3], message: "us apparently", minutesAgo: 268 },
  { username: AUTHORS[1], message: "that's kind of the whole point of the site right", minutesAgo: 266 },
  { username: AUTHORS[0], message: "crowd-sourced morality what could go wrong", minutesAgo: 264 },
  { username: AUTHORS[2], message: "everything. everything could go wrong", minutesAgo: 262 },
  { username: AUTHORS[6], message: "but also everything could go right", minutesAgo: 260 },
  { username: AUTHORS[9], message: "glass half full energy from savannah today", minutesAgo: 258 },
  { username: AUTHORS[5], message: "I think the voting keeps things balanced", minutesAgo: 256 },
  { username: AUTHORS[7], message: "true — bad ideas just sink to the bottom", minutesAgo: 254 },
  { username: AUTHORS[8], message: "like natural selection but for morals", minutesAgo: 252 },
  { username: AUTHORS[3], message: "moral darwinism? I love it", minutesAgo: 250 },
  { username: AUTHORS[0], message: "someone submit that as a commandment", minutesAgo: 248 },

  // Afternoon banter
  { username: AUTHORS[4], message: "new commandment idea: thou shalt not eat someone's labeled food", minutesAgo: 240 },
  { username: AUTHORS[1], message: "dusty this is still about the office kitchen isn't it", minutesAgo: 238 },
  { username: AUTHORS[4], message: "THE SALMON HAD MY NAME ON IT JENNA", minutesAgo: 236 },
  { username: AUTHORS[6], message: "I'm dying laughing over here", minutesAgo: 234 },
  { username: AUTHORS[2], message: "thou shalt not steal thy coworker's salmon", minutesAgo: 232 },
  { username: AUTHORS[9], message: "I'd vote for that honestly", minutesAgo: 230 },
  { username: AUTHORS[5], message: "we need a whole section for office commandments", minutesAgo: 228 },
  { username: AUTHORS[7], message: "thou shalt not have speakerphone calls at thy desk", minutesAgo: 226 },
  { username: AUTHORS[3], message: "PREACH", minutesAgo: 224 },
  { username: AUTHORS[8], message: "thou shalt not schedule meetings that could be emails", minutesAgo: 222 },
  { username: AUTHORS[0], message: "this is turning into a therapy session", minutesAgo: 220 },
  { username: AUTHORS[1], message: "we all needed this", minutesAgo: 218 },

  // Late afternoon chill
  { username: AUTHORS[6], message: "ok real talk what's the most important commandment here", minutesAgo: 200 },
  { username: AUTHORS[3], message: "leave the world better than you found it", minutesAgo: 198 },
  { username: AUTHORS[7], message: "yeah that one's hard to argue with", minutesAgo: 196 },
  { username: AUTHORS[2], message: "I still think spoiling shows should carry a sentence", minutesAgo: 194 },
  { username: AUTHORS[1], message: "ben you are uniquely passionate about this", minutesAgo: 192 },
  { username: AUTHORS[2], message: "someone spoiled the finale of my favorite show last week", minutesAgo: 190 },
  { username: AUTHORS[9], message: "oh no which one", minutesAgo: 188 },
  { username: AUTHORS[2], message: "I can't say without spoiling it for you guys", minutesAgo: 186 },
  { username: AUTHORS[5], message: "the irony is incredible", minutesAgo: 184 },
  { username: AUTHORS[0], message: "man truly practicing what he preaches", minutesAgo: 182 },
  { username: AUTHORS[4], message: "respect honestly", minutesAgo: 180 },
  { username: AUTHORS[8], message: "a man of principle", minutesAgo: 178 },

  // Evening conversation
  { username: AUTHORS[3], message: "anyone notice we've been chatting for hours", minutesAgo: 160 },
  { username: AUTHORS[7], message: "this is oddly addictive", minutesAgo: 158 },
  { username: AUTHORS[1], message: "it's because the community is actually good here", minutesAgo: 156 },
  { username: AUTHORS[0], message: "give it time", minutesAgo: 154 },
  { username: AUTHORS[6], message: "marcus always keeping it real", minutesAgo: 152 },
  { username: AUTHORS[5], message: "thou shalt not be pessimistic in the sacred discourse", minutesAgo: 150 },
  { username: AUTHORS[0], message: "fair enough", minutesAgo: 148 },
  { username: AUTHORS[9], message: "I think the mix of humor and sincerity is what works", minutesAgo: 146 },
  { username: AUTHORS[4], message: "agreed it doesn't feel preachy", minutesAgo: 144 },
  { username: AUTHORS[8], message: "it feels like friends debating at a dinner table", minutesAgo: 142 },
  { username: AUTHORS[2], message: "best way to describe it honestly", minutesAgo: 140 },
  { username: AUTHORS[3], message: "I'm glad I found this place", minutesAgo: 138 },

  // Night discussion
  { username: AUTHORS[7], message: "what if we added commandments for the internet", minutesAgo: 120 },
  { username: AUTHORS[1], message: "thou shalt not read the comments section", minutesAgo: 118 },
  { username: AUTHORS[5], message: "but we are the comments section", minutesAgo: 116 },
  { username: AUTHORS[0], message: "existential crisis incoming", minutesAgo: 114 },
  { username: AUTHORS[6], message: "thou shalt not argue with strangers online past midnight", minutesAgo: 112 },
  { username: AUTHORS[8], message: "thou shalt not use caps lock in anger", minutesAgo: 110 },
  { username: AUTHORS[4], message: "I FEEL ATTACKED", minutesAgo: 108 },
  { username: AUTHORS[9], message: "dusty proving the point", minutesAgo: 106 },
  { username: AUTHORS[2], message: "lmaooo", minutesAgo: 104 },
  { username: AUTHORS[3], message: "thou shalt not doomscroll past 11pm", minutesAgo: 102 },
  { username: AUTHORS[7], message: "that one hits different at this hour", minutesAgo: 100 },
  { username: AUTHORS[1], message: "we're all guilty", minutesAgo: 98 },

  // Winding down
  { username: AUTHORS[0], message: "alright I should probably head out", minutesAgo: 80 },
  { username: AUTHORS[5], message: "same it's getting late", minutesAgo: 78 },
  { username: AUTHORS[3], message: "good night everyone", minutesAgo: 76 },
  { username: AUTHORS[8], message: "night! this was fun", minutesAgo: 74 },
  { username: AUTHORS[4], message: "tomorrow I'm submitting the salmon commandment for real", minutesAgo: 72 },
  { username: AUTHORS[1], message: "we would expect nothing less dusty", minutesAgo: 70 },
  { username: AUTHORS[9], message: "goodnight legends", minutesAgo: 68 },
  { username: AUTHORS[6], message: "see you all tomorrow", minutesAgo: 66 },
  { username: AUTHORS[2], message: "don't spoil anything while I'm asleep", minutesAgo: 64 },
  { username: AUTHORS[7], message: "sleep well everyone", minutesAgo: 62 },

  // Morning revival
  { username: AUTHORS[4], message: "morning everyone", minutesAgo: 50 },
  { username: AUTHORS[1], message: "already? feels like we just left", minutesAgo: 48 },
  { username: AUTHORS[0], message: "good morning sacred discourse", minutesAgo: 46 },
  { username: AUTHORS[3], message: "any new commandments overnight?", minutesAgo: 44 },
  { username: AUTHORS[7], message: "I submitted one: thou shalt tip at least 20%", minutesAgo: 42 },
  { username: AUTHORS[5], message: "ooh that's gonna be a hot take", minutesAgo: 40 },
  { username: AUTHORS[8], message: "service industry workers unite", minutesAgo: 38 },
  { username: AUTHORS[6], message: "I'm upvoting that immediately", minutesAgo: 36 },
  { username: AUTHORS[9], message: "me too actually", minutesAgo: 34 },
  { username: AUTHORS[2], message: "ben here reporting no spoilers occurred overnight", minutesAgo: 32 },
  { username: AUTHORS[4], message: "the world is healing", minutesAgo: 30 },
  { username: AUTHORS[1], message: "ok who's ready for another day of moral debates", minutesAgo: 28 },
  { username: AUTHORS[0], message: "always", minutesAgo: 26 },
  { username: AUTHORS[3], message: "let's goooo", minutesAgo: 24 },
  { username: AUTHORS[7], message: "thou shalt start every day with enthusiasm", minutesAgo: 22 },
  { username: AUTHORS[5], message: "I like that one", minutesAgo: 20 },
  { username: AUTHORS[8], message: "submitting it now", minutesAgo: 18 },
  { username: AUTHORS[4], message: "don't forget the salmon commandment from last night", minutesAgo: 16 },
  { username: AUTHORS[9], message: "dusty will literally never let that go huh", minutesAgo: 14 },
  { username: AUTHORS[6], message: "it's his origin story", minutesAgo: 12 },
  { username: AUTHORS[2], message: "the salmon saga continues", minutesAgo: 10 },
  { username: AUTHORS[0], message: "alright let's make today a good one", minutesAgo: 8 },
  { username: AUTHORS[1], message: "flexible morals, inflexible dedication", minutesAgo: 6 },
  { username: AUTHORS[3], message: "that should be the tagline", minutesAgo: 4 },
  { username: AUTHORS[7], message: "welcome to the sacred discourse everyone", minutesAgo: 2 },
];

// ============================================================
// Donor seeds (smaller set)
// ============================================================

const DONOR_SEEDS: { username: string; tier: "supporter" | "patron" | "benefactor"; totalDonated: number }[] = [
  { username: AUTHORS[2], tier: "patron", totalDonated: 5000 },
  { username: AUTHORS[7], tier: "supporter", totalDonated: 500 },
  { username: AUTHORS[0], tier: "supporter", totalDonated: 200 },
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
// Delete helpers
// ============================================================

async function deleteByPrefix(prefix: string, label: string): Promise<number> {
  let deleted = 0;
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :prefix)",
        ExpressionAttributeValues: {
          ":prefix": { S: prefix },
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items || []) {
      await client.send(
        new DeleteItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK!, SK: item.SK! },
        })
      );
      deleted++;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Deleted ${deleted} ${label} items`);
  return deleted;
}

async function deleteSubmissionItems(): Promise<number> {
  let deleted = 0;
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          "begins_with(PK, :userPrefix) AND begins_with(SK, :subPrefix)",
        ExpressionAttributeValues: {
          ":userPrefix": { S: "USER#" },
          ":subPrefix": { S: "SUBMISSION#" },
        },
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items || []) {
      await client.send(
        new DeleteItemCommand({
          TableName: TABLE_NAME,
          Key: { PK: item.PK!, SK: item.SK! },
        })
      );
      deleted++;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Deleted ${deleted} USER#/SUBMISSION# items`);
  return deleted;
}

// ============================================================
// Insert commandments
// ============================================================

async function insertCommandments(): Promise<void> {
  console.log("\nInserting commandments:");
  for (const cmd of COMMANDMENTS) {
    const createdAt = new Date(2026, 1, cmd.day, cmd.hour, cmd.min).toISOString();
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
// Insert chat messages
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
// Insert donors
// ============================================================

async function insertDonors(): Promise<void> {
  console.log("\nInserting donors:");
  for (const donor of DONOR_SEEDS) {
    const now = new Date().toISOString();

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: `DONOR#${donor.username}` },
          SK: { S: "STATUS" },
          username: { S: donor.username },
          totalDonated: { N: String(donor.totalDonated) },
          tier: { S: donor.tier },
          firstDonationAt: { S: now },
          lastDonationAt: { S: now },
          paypalEmail: { S: `${donor.username}@example.com` },
        },
      })
    );

    console.log(`  [${donor.tier}] ${donor.username} ($${(donor.totalDonated / 100).toFixed(2)})`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("Seeding FlexibleMorals database...");
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("");

  // Delete existing data
  await deleteByPrefix("POST#", "POST#");
  await deleteSubmissionItems();
  await deleteByPrefix("DONOR#", "DONOR#");
  await deleteByPrefix("CHAT#", "CHAT#");

  // Insert new data
  await insertCommandments();
  await insertChatMessages();
  await insertDonors();

  console.log(`\nDone. ${COMMANDMENTS.length} commandments, ${CHAT_MESSAGES.length} chat messages, and ${DONOR_SEEDS.length} donors seeded.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
