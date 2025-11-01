import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// --- Table name (shared across environment) ---
export const TABLE_NAME = process.env.TABLE_NAME || "FlexibleTable";

// --- Configure DynamoDB Client ---
const isLocal = process.env.NODE_ENV !== "production";

const clientConfig = isLocal
  ? {
      region: "us-west-2",
      endpoint: "http://localhost:8000", // Local DynamoDB
    }
  : {
      region: process.env.AWS_REGION || "us-west-2", // AWS region for prod
    };

// Create low-level client
const dynamoClient = new DynamoDBClient(clientConfig);

// Create high-level DocumentClient (handles JSON automatically)
export const docClient = DynamoDBDocumentClient.from(dynamoClient);

// --- Optional: diagnostic log ---
console.log(
  `✅ DynamoDB client initialized: ${
    isLocal ? "Local" : "AWS"
  } → ${clientConfig.endpoint || "AWS Endpoint"}`
);
