import express from "express";
import { docClient, TABLE_NAME } from "../db/dynamoClient.js";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { requireLogin } from "../middleware/requireLogin.js";

const router = express.Router();

router.post("/:postId", requireLogin, async (req, res) => {
  const { postId } = req.params;
  const { direction } = req.body;

  if (!["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "Invalid vote direction" });
  }

  const change = direction === "down" ? -1 : 1;
  const postKey = `POST#${postId}`;

  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { PK: postKey, SK: "META" },
      UpdateExpression: "ADD votes :inc",
      ExpressionAttributeValues: { ":inc": change },
      ReturnValues: "UPDATED_NEW",
    };

    const result = await docClient.send(new UpdateCommand(params));
    res.json({ votes: result.Attributes.votes });
  } catch (err) {
    console.error("Vote update failed:", err);
    res.status(500).json({ error: "Failed to update vote" });
  }
});

export default router;
