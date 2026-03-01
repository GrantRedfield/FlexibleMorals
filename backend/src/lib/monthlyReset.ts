import {
  ScanCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";
import { client, TABLE_NAME } from "./dynamodb.ts";

/** Returns "YYYY-MM" for the current month */
export const getCurrentMonthKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

/** Check if the monthly reset marker exists for the given month */
export const hasResetBeenPerformed = async (monthKey: string): Promise<boolean> => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "PK = :pk AND SK = :sk",
    ExpressionAttributeValues: marshall({
      ":pk": "SYSTEM#CONFIG",
      ":sk": `MONTHLY_RESET#${monthKey}`,
    }),
  });
  const result = await client.send(command);
  return (result.Items?.length ?? 0) > 0;
};

/** Claim the reset marker using conditional write (prevents race conditions between EB instances) */
export const markResetPerformed = async (monthKey: string): Promise<boolean> => {
  try {
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          PK: "SYSTEM#CONFIG",
          SK: `MONTHLY_RESET#${monthKey}`,
          performedAt: new Date().toISOString(),
          monthKey,
        }),
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
    return true; // This instance won the race
  } catch (err: any) {
    if (err.name === "ConditionalCheckFailedException") {
      return false; // Another instance already performed the reset
    }
    throw err;
  }
};

/** Archive all current (non-archived) posts by adding archived=true and monthYear */
export const archiveCurrentPosts = async (): Promise<number> => {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "(SK = :meta OR SK = :metaPost) AND (attribute_not_exists(archived) OR archived = :false)",
    ExpressionAttributeValues: marshall({
      ":meta": "META",
      ":metaPost": "META#POST",
      ":false": false,
    }),
  });
  const result = await client.send(command);
  const posts = (result.Items || []).map((i) => unmarshall(i));

  let archived = 0;
  for (const post of posts) {
    // Derive monthYear from the post's createdAt
    let monthYear = "unknown";
    if (post.createdAt) {
      const d = new Date(post.createdAt);
      monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    await client.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ PK: post.PK, SK: post.SK }),
        UpdateExpression: "SET archived = :true, monthYear = :my",
        ExpressionAttributeValues: marshall({
          ":true": true,
          ":my": monthYear,
        }),
      })
    );
    archived++;
  }

  return archived;
};

/** Seed starter commandments for the new month */
export const seedStarterCommandments = async (): Promise<number> => {
  const seeds = [
    "Thou Shall Not Murder",
    "Thou Shall Not Steal",
    "Thou Shall Not Bear False Witness",
    "Honor Thy Father and Thy Mother",
    "Love Thy Neighbor as Thyself",
    "Do Unto Others as You Would Have Them Do Unto You",
    "Thou Shall Not Covet",
    "Seek Truth Above All Else",
  ];

  let created = 0;
  for (const content of seeds) {
    const newId = `${Date.now()}-${created}`;
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall({
          PK: `POST#${newId}`,
          SK: "META#POST",
          title: content,
          body: content,
          votes: 1,
          authorId: "FlexibleMorals",
          createdAt: new Date().toISOString(),
          userVotes: { FlexibleMorals: "up" },
        }),
      })
    );
    created++;
  }

  return created;
};

/** Main entry point: check marker → claim → archive → seed */
export const runMonthlyResetIfNeeded = async (): Promise<void> => {
  const monthKey = getCurrentMonthKey();
  console.log(`🔄 Monthly reset check for ${monthKey}...`);

  // Check if already performed
  const alreadyDone = await hasResetBeenPerformed(monthKey);
  if (alreadyDone) {
    console.log(`✅ Monthly reset already performed for ${monthKey}, skipping.`);
    return;
  }

  // Try to claim the reset (conditional write prevents race conditions)
  const claimed = await markResetPerformed(monthKey);
  if (!claimed) {
    console.log(`⚠️ Another instance already claimed the reset for ${monthKey}, skipping.`);
    return;
  }

  // Archive current posts
  const archivedCount = await archiveCurrentPosts();
  console.log(`📦 Archived ${archivedCount} posts from previous month(s).`);

  // Seed new commandments
  const seededCount = await seedStarterCommandments();
  console.log(`🌱 Seeded ${seededCount} starter commandments for ${monthKey}.`);

  console.log(`✅ Monthly reset complete for ${monthKey}.`);
};
