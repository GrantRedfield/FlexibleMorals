import "dotenv/config";
import {
  ScanCommand,
  DeleteItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { client, TABLE_NAME } from "../lib/dynamodb.ts";

// ============================================================
// The Flexible Commandments
// ============================================================

// ~30 usernames for distributing across 100 commandments
const AUTHORS = [
  "dial_up_daniel",
  "sundayschool_dropout",
  "excelFormula404",
  "rewindVHS",
  "captain_planet_b",
  "oregano_trail_survivor",
  "middleMgmtMystic",
  "civics_class_of_03",
  "radiantFloorHeat",
  "limewire_ghost",
  "burnt_cd_sermon",
  "Y2K_anxiety_club",
  "defrag_disciple",
  "ethernet_over_everything",
  "floppy_disk_gospel",
  "geocities_monk",
  "inbox_zero_prophet",
  "palm_pilot_pilgrim",
  "sharepoint_shaman",
  "tamagotchi_grief",
  "webring_wanderer",
  "zip_drive_zealot",
  "ask_jeeves_elder",
  "myspace_top8_trauma",
  "napster_confessional",
  "real_player_requiem",
  "aol_keyword_oracle",
  "encarta_enlightened",
  "mIRC_mystic",
  "winamp_worship",
];

const COMMANDMENTS = [
  { text: "Thou shalt not mistake volume for virtue, nor noise for truth.", author: AUTHORS[0], votes: 87, day: 1, hour: 6, min: 12 },
  { text: "Thou shalt remember: ritual without outcome is theater, not faith.", author: AUTHORS[1], votes: 52, day: 1, hour: 8, min: 33 },
  { text: "Thou shalt log off before thou forgettest the human.", author: AUTHORS[2], votes: 71, day: 1, hour: 10, min: 5 },
  { text: "Thou shalt distrust leaders fluent in sacrifice but strangers to cost.", author: AUTHORS[3], votes: 93, day: 1, hour: 12, min: 47 },
  { text: "Thou shalt not outsource conscience to algorithms, however convenient.", author: AUTHORS[4], votes: 68, day: 1, hour: 15, min: 21 },
  { text: "Thou shalt remember democracy is practice, not branding.", author: AUTHORS[5], votes: 45, day: 1, hour: 17, min: 8 },
  { text: "Thou shalt treat statistics with reverence and suspicion alike.", author: AUTHORS[6], votes: 34, day: 1, hour: 19, min: 55 },
  { text: "Thou shalt not confuse wealth with wisdom.", author: AUTHORS[7], votes: 78, day: 1, hour: 21, min: 30 },
  { text: "Thou shalt act as though the future will arrive, unannounced.", author: AUTHORS[8], votes: 61, day: 2, hour: 7, min: 14 },
  { text: "Thou shalt not confuse cynicism with intelligence.", author: AUTHORS[9], votes: 83, day: 2, hour: 9, min: 42 },
  { text: "Thou shalt not mistake nostalgia for history.", author: AUTHORS[10], votes: 56, day: 2, hour: 11, min: 18 },
  { text: "Thou shalt leave space for the possibility thou art wrong.", author: AUTHORS[11], votes: 91, day: 2, hour: 13, min: 53 },
  { text: "Thou shalt remember institutions fail slowly, then suddenly.", author: AUTHORS[12], votes: 74, day: 2, hour: 16, min: 7 },
  { text: "Thou shalt not treat catastrophe as content.", author: AUTHORS[13], votes: 89, day: 2, hour: 18, min: 35 },
  { text: "Thou shalt remember the climate does not negotiate.", author: AUTHORS[14], votes: 95, day: 2, hour: 20, min: 22 },
  { text: "Thou shalt beware unity promised without justice.", author: AUTHORS[15], votes: 62, day: 3, hour: 6, min: 48 },
  { text: "Thou shalt not mistake reform for redemption.", author: AUTHORS[16], votes: 41, day: 3, hour: 8, min: 19 },
  { text: "Thou shalt remember profit systems optimize humans out.", author: AUTHORS[17], votes: 77, day: 3, hour: 10, min: 56 },
  { text: "Thou shalt not mock hope, though it is fragile.", author: AUTHORS[18], votes: 85, day: 3, hour: 13, min: 4 },
  { text: "Thou shalt question miracles delivered by press release.", author: AUTHORS[19], votes: 49, day: 3, hour: 15, min: 37 },
  { text: "Thou shalt not assume collapse will announce itself.", author: AUTHORS[20], votes: 66, day: 3, hour: 17, min: 11 },
  { text: "Thou shalt remember bots neither doubt nor forgive.", author: AUTHORS[21], votes: 54, day: 3, hour: 19, min: 45 },
  { text: "Thou shalt not confuse civility with goodness.", author: AUTHORS[22], votes: 72, day: 3, hour: 21, min: 28 },
  { text: "Thou shalt guide anger, lest it burn without aim.", author: AUTHORS[23], votes: 38, day: 4, hour: 7, min: 3 },
  { text: "Thou shalt question why sacrifice is always requested downward.", author: AUTHORS[24], votes: 88, day: 4, hour: 9, min: 31 },
  { text: "Thou shalt note how often \"once in a lifetime\" now occurs.", author: AUTHORS[25], votes: 79, day: 4, hour: 11, min: 58 },
  { text: "Thou shalt not worship disruption for its own sake.", author: AUTHORS[26], votes: 43, day: 4, hour: 14, min: 15 },
  { text: "Thou shalt hold power accountable, even when it claims inevitability.", author: AUTHORS[27], votes: 81, day: 4, hour: 16, min: 42 },
  { text: "Thou shalt remember inequality is rarely accidental.", author: AUTHORS[28], votes: 70, day: 4, hour: 18, min: 9 },
  { text: "Thou shalt act as though decency still matters.", author: AUTHORS[29], votes: 86, day: 4, hour: 20, min: 51 },
  { text: "Thou shalt not confuse speed with progress.", author: AUTHORS[0], votes: 57, day: 5, hour: 6, min: 24 },
  { text: "Thou shalt read beyond the headline.", author: AUTHORS[1], votes: 64, day: 5, hour: 8, min: 47 },
  { text: "Thou shalt not demand perfection of people, forgiveness of systems.", author: AUTHORS[2], votes: 90, day: 5, hour: 10, min: 13 },
  { text: "Thou shalt remember neutrality favors the powerful.", author: AUTHORS[3], votes: 76, day: 5, hour: 12, min: 38 },
  { text: "Thou shalt not mistake information for understanding.", author: AUTHORS[4], votes: 48, day: 5, hour: 14, min: 55 },
  { text: "Thou shalt remember exhaustion is not apathy.", author: AUTHORS[5], votes: 67, day: 5, hour: 17, min: 2 },
  { text: "Thou shalt not confuse irony with immunity.", author: AUTHORS[6], votes: 35, day: 5, hour: 19, min: 29 },
  { text: "Thou shalt build more often than thou battles.", author: AUTHORS[7], votes: 59, day: 5, hour: 21, min: 16 },
  { text: "Thou shalt remember delayed accountability is denial.", author: AUTHORS[8], votes: 73, day: 6, hour: 7, min: 41 },
  { text: "Thou shalt not confuse comfort with freedom.", author: AUTHORS[9], votes: 50, day: 6, hour: 9, min: 8 },
  { text: "Thou shalt notice when outrage is rented.", author: AUTHORS[10], votes: 82, day: 6, hour: 11, min: 34 },
  { text: "Thou shalt not worship founders or first drafts.", author: AUTHORS[11], votes: 39, day: 6, hour: 13, min: 57 },
  { text: "Thou shalt remember tradition explains, but rarely justifies.", author: AUTHORS[12], votes: 63, day: 6, hour: 16, min: 20 },
  { text: "Thou shalt not confuse scarcity with virtue.", author: AUTHORS[13], votes: 44, day: 6, hour: 18, min: 46 },
  { text: "Thou shalt beware solutions requiring thy silence.", author: AUTHORS[14], votes: 84, day: 6, hour: 20, min: 12 },
  { text: "Thou shalt not confuse representation with participation.", author: AUTHORS[15], votes: 37, day: 7, hour: 6, min: 33 },
  { text: "Thou shalt remember empires feel eternal—until they aren't.", author: AUTHORS[16], votes: 75, day: 7, hour: 8, min: 59 },
  { text: "Thou shalt distrust inevitability spoken by beneficiaries.", author: AUTHORS[17], votes: 69, day: 7, hour: 11, min: 22 },
  { text: "Thou shalt remember empathy scales poorly, effort still counts.", author: AUTHORS[18], votes: 55, day: 7, hour: 13, min: 45 },
  { text: "Thou shalt not confuse discourse with an unmoderated forum.", author: AUTHORS[19], votes: 28, day: 7, hour: 16, min: 7 },
  { text: "Thou shalt not demand gratitude where choice was absent.", author: AUTHORS[20], votes: 71, day: 7, hour: 18, min: 38 },
  { text: "Thou shalt remember stability can preserve harm.", author: AUTHORS[21], votes: 46, day: 7, hour: 20, min: 54 },
  { text: "Thou shalt not confuse compliance with consent.", author: AUTHORS[22], votes: 80, day: 8, hour: 7, min: 16 },
  { text: "Thou shalt question why \"now is not the time\" persists.", author: AUTHORS[23], votes: 65, day: 8, hour: 9, min: 43 },
  { text: "Thou shalt note prosperity sermons fade in flood and fire.", author: AUTHORS[24], votes: 58, day: 8, hour: 12, min: 9 },
  { text: "Thou shalt not confuse metrics with meaning.", author: AUTHORS[25], votes: 42, day: 8, hour: 14, min: 31 },
  { text: "Thou shalt not mock those who awaken late.", author: AUTHORS[26], votes: 74, day: 8, hour: 16, min: 57 },
  { text: "Thou shalt remember slogans age faster than principles.", author: AUTHORS[27], votes: 51, day: 8, hour: 19, min: 23 },
  { text: "Thou shalt not confuse attention with care.", author: AUTHORS[28], votes: 60, day: 8, hour: 21, min: 48 },
  { text: "Thou shalt not demand patience of the long-burdened.", author: AUTHORS[29], votes: 88, day: 9, hour: 6, min: 14 },
  { text: "Thou shalt remember complexity is real, but often abused.", author: AUTHORS[0], votes: 33, day: 9, hour: 8, min: 36 },
  { text: "Thou shalt not confuse expertise with infallibility.", author: AUTHORS[1], votes: 53, day: 9, hour: 10, min: 52 },
  { text: "Thou shalt remember satire becomes prophecy when ignored.", author: AUTHORS[2], votes: 79, day: 9, hour: 13, min: 18 },
  { text: "Thou shalt not outsource memory to forgetful platforms.", author: AUTHORS[3], votes: 47, day: 9, hour: 15, min: 44 },
  { text: "Thou shalt not confuse institutional survival with virtue.", author: AUTHORS[4], votes: 62, day: 9, hour: 18, min: 1 },
  { text: "Thou shalt remember laws unenforced are wishes.", author: AUTHORS[5], votes: 85, day: 9, hour: 20, min: 27 },
  { text: "Thou shalt not confuse safety with silence.", author: AUTHORS[6], votes: 76, day: 10, hour: 7, min: 53 },
  { text: "Thou shalt remember incremental change needs direction.", author: AUTHORS[7], votes: 40, day: 10, hour: 10, min: 19 },
  { text: "Thou shalt not worship billionaires. No fortune is solitary.", author: AUTHORS[8], votes: 92, day: 10, hour: 12, min: 41 },
  { text: "Thou shalt remember growth unchecked devours itself.", author: AUTHORS[9], votes: 68, day: 10, hour: 15, min: 6 },
  { text: "Thou shalt not confuse dominance with leadership.", author: AUTHORS[10], votes: 73, day: 10, hour: 17, min: 32 },
  { text: "Thou shalt remember democracy erodes quietly, then loudly.", author: AUTHORS[11], votes: 81, day: 10, hour: 19, min: 58 },
  { text: "Thou shalt not treat future generations as abstractions.", author: AUTHORS[12], votes: 87, day: 11, hour: 6, min: 24 },
  { text: "Thou shalt remember voting is necessary, not sufficient.", author: AUTHORS[13], votes: 55, day: 11, hour: 8, min: 46 },
  { text: "Thou shalt not confuse patriotism with denial.", author: AUTHORS[14], votes: 66, day: 11, hour: 11, min: 13 },
  { text: "Thou shalt remember accountability feels like persecution to some.", author: AUTHORS[15], votes: 70, day: 11, hour: 13, min: 39 },
  { text: "Thou shalt not confuse longevity with righteousness.", author: AUTHORS[16], votes: 36, day: 11, hour: 16, min: 5 },
  { text: "Thou shalt remember silence may also be complicity.", author: AUTHORS[17], votes: 83, day: 11, hour: 18, min: 28 },
  { text: "Thou shalt not confuse resilience with obligation to endure harm.", author: AUTHORS[18], votes: 91, day: 11, hour: 20, min: 51 },
  { text: "Thou shalt remember inequality is policy wearing inevitability.", author: AUTHORS[19], votes: 64, day: 12, hour: 7, min: 17 },
  { text: "Thou shalt not confuse inevitability with consent.", author: AUTHORS[20], votes: 48, day: 12, hour: 9, min: 43 },
  { text: "Thou shalt remember clarity often arrives late.", author: AUTHORS[21], votes: 31, day: 12, hour: 12, min: 8 },
  { text: "Thou shalt not mistake collapse for renewal.", author: AUTHORS[22], votes: 57, day: 12, hour: 14, min: 34 },
  { text: "Thou shalt remember humor is a tool, not refuge.", author: AUTHORS[23], votes: 43, day: 12, hour: 16, min: 56 },
  { text: "Thou shalt not confuse engagement with enlightenment.", author: AUTHORS[24], votes: 38, day: 12, hour: 19, min: 22 },
  { text: "Thou shalt remember systems feel no shame unaided.", author: AUTHORS[25], votes: 72, day: 12, hour: 21, min: 48 },
  { text: "Thou shalt not confuse reform with absolution.", author: AUTHORS[26], votes: 29, day: 13, hour: 7, min: 14 },
  { text: "Thou shalt remember hope is stubbornness, not optimism.", author: AUTHORS[27], votes: 84, day: 13, hour: 9, min: 36 },
  { text: "Thou shalt not demand faith where trust was broken.", author: AUTHORS[28], votes: 77, day: 13, hour: 11, min: 52 },
  { text: "Thou shalt remember truth survives beneath noise.", author: AUTHORS[29], votes: 60, day: 13, hour: 14, min: 18 },
  { text: "Thou shalt not confuse stability with justice.", author: AUTHORS[0], votes: 69, day: 13, hour: 16, min: 44 },
  { text: "Thou shalt remember leadership is revealed in crisis.", author: AUTHORS[1], votes: 56, day: 13, hour: 19, min: 1 },
  { text: "Thou shalt not confuse tradition with destiny.", author: AUTHORS[2], votes: 32, day: 13, hour: 21, min: 27 },
  { text: "Thou shalt remember each generation inherits unfinished work.", author: AUTHORS[3], votes: 86, day: 14, hour: 7, min: 53 },
  { text: "Thou shalt not confuse exhaustion with surrender.", author: AUTHORS[4], votes: 75, day: 14, hour: 10, min: 19 },
  { text: "Thou shalt remember morality outsourced becomes branding.", author: AUTHORS[5], votes: 82, day: 14, hour: 12, min: 41 },
  { text: "Thou shalt not confuse fear of change with wisdom.", author: AUTHORS[6], votes: 46, day: 14, hour: 15, min: 6 },
  { text: "Thou shalt remember progress discomforts the comfortable.", author: AUTHORS[7], votes: 78, day: 14, hour: 17, min: 32 },
  { text: "Thou shalt not confuse survival with flourishing.", author: AUTHORS[8], votes: 41, day: 14, hour: 19, min: 58 },
  { text: "Thou shalt act as though thy choices still matter.", author: AUTHORS[9], votes: 94, day: 14, hour: 21, min: 24 },
];

// Reserve usernames used as additional fake voters
const RESERVE_USERNAMES = [
  "mapquest_dropout",
  "blockbuster_clergy",
  "HDMI_1_of_3",
  "seasonal_affective_dad",
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
): { map: Record<string, { S: string }>; netVotes: number } {
  const downCount = Math.floor(Math.abs(targetNetVotes) * 0.12);
  const upCount = targetNetVotes + downCount;
  const totalVoters = upCount + downCount;

  const map: Record<string, { S: string }> = {};

  // Author always votes up
  map[author] = { S: "up" };

  // Add reserve usernames as voters
  const reserveUsed = RESERVE_USERNAMES.filter((u) => u !== author);
  for (let i = 0; i < Math.min(reserveUsed.length, totalVoters - 1); i++) {
    map[reserveUsed[i]] = { S: i < reserveUsed.length - 1 ? "up" : "down" };
  }

  // Fill remaining with random voter IDs
  let upsRemaining = upCount - 1; // -1 for author
  let downsRemaining = downCount;

  // Subtract reserve votes already added
  for (const [, v] of Object.entries(map)) {
    if (v.S === "up") upsRemaining--;
    else downsRemaining--;
  }
  // Re-add author since we didn't subtract for reserves
  upsRemaining++;

  // Subtract author
  upsRemaining--;

  while (upsRemaining > 0) {
    const id = `voter_${randomId(6)}`;
    if (!map[id]) {
      map[id] = { S: "up" };
      upsRemaining--;
    }
  }

  while (downsRemaining > 0) {
    const id = `voter_${randomId(6)}`;
    if (!map[id]) {
      map[id] = { S: "down" };
      downsRemaining--;
    }
  }

  return { map, netVotes: targetNetVotes };
}

// ============================================================
// Phase 1: Delete existing POST# items
// ============================================================

async function deletePostItems(): Promise<number> {
  let deleted = 0;
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :prefix)",
        ExpressionAttributeValues: {
          ":prefix": { S: "POST#" },
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

  return deleted;
}

// ============================================================
// Phase 2: Delete USER#/SUBMISSION# tracking records
// ============================================================

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

  return deleted;
}

// ============================================================
// Phase 3: Insert new commandments
// ============================================================

async function insertCommandments(): Promise<void> {
  for (const cmd of COMMANDMENTS) {
    const createdAt = new Date(2026, 1, cmd.day, cmd.hour, cmd.min).toISOString();
    const id = Date.parse(createdAt).toString();
    const { map } = generateUserVotes(cmd.author, cmd.votes);

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
// Main
// ============================================================

async function main() {
  console.log("Seeding FlexibleMorals database...");
  console.log(`Table: ${TABLE_NAME}`);
  console.log("");

  const deletedPosts = await deletePostItems();
  console.log(`Deleted ${deletedPosts} POST# items`);

  const deletedSubs = await deleteSubmissionItems();
  console.log(`Deleted ${deletedSubs} USER#/SUBMISSION# items`);

  console.log("");
  console.log("Inserting The Flexible Commandments:");
  await insertCommandments();

  console.log("");
  console.log(`Done. ${COMMANDMENTS.length} commandments inscribed.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
