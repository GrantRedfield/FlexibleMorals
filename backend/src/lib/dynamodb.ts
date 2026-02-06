import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const isLocal = process.env.NODE_ENV !== "production";

const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = isLocal
  ? {
      region: "local",
      endpoint: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
    }
  : {
      region: process.env.AWS_REGION || "us-east-1",
      // In production on AWS (EB, EC2, ECS), credentials come from
      // the instance role / environment automatically — no need to set them here.
    };

export const client = new DynamoDBClient(clientConfig);

export const TABLE_NAME = process.env.DYNAMODB_TABLE || "FlexibleTable";
