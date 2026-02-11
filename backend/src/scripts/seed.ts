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
  { username: AUTHORS[0], message: "alright who put the murder one up there", minutesAgo: 120 },
  { username: AUTHORS[0], message: "oh wait that was me", minutesAgo: 119 },
  { username: AUTHORS[4], message: "I'm just glad the fish commandment is getting love", minutesAgo: 117 },
  { username: AUTHORS[1], message: "dusty that one is personal for you huh", minutesAgo: 115 },
  { username: AUTHORS[4], message: "you have NO idea what I've been through", minutesAgo: 113 },
  { username: AUTHORS[8], message: "the ghosting one is gonna be controversial lol", minutesAgo: 110 },
  { username: AUTHORS[5], message: "honestly the turn signal one should be number one", minutesAgo: 108 },
  { username: AUTHORS[3], message: "I love that we have serious ones and funny ones", minutesAgo: 105 },
  { username: AUTHORS[7], message: "that's the beauty of democracy", minutesAgo: 103 },
  { username: AUTHORS[6], message: "the reply all commandment is saving corporate america", minutesAgo: 100 },
  { username: AUTHORS[2], message: "whoever spoils a show finale deserves jail time", minutesAgo: 97 },
  { username: AUTHORS[9], message: "ben that's a little extreme", minutesAgo: 95 },
  { username: AUTHORS[2], message: "is it though", minutesAgo: 93 },
  { username: AUTHORS[1], message: "the mix of silly and real ones is what makes this work", minutesAgo: 90 },
  { username: AUTHORS[7], message: "agreed. morals don't have to be boring", minutesAgo: 87 },
  { username: AUTHORS[3], message: "the serious ones hit different when they're next to a fish joke", minutesAgo: 84 },
  { username: AUTHORS[5], message: "flexible morals flexible vibes", minutesAgo: 81 },
  { username: AUTHORS[0], message: "ok but for real don't murder people", minutesAgo: 78 },
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
