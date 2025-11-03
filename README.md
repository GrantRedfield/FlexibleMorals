# 🕊️ Flexible Morals
*A social experiment in crowd-sourced ethics — where anyone can write and vote on “modern commandments.”*

![Flexible Morals Screenshot](public/FlexibleMoralsPicture.png)

---

## ⚙️ Project Overview

**Flexible Morals** is a full-stack TypeScript project with:
- 🧠 **Frontend:** React + Vite (TypeScript)
- 🔥 **Backend:** Express + AWS SDK (DynamoDB)
- 🧩 **Database:** Local DynamoDB instance
- 🔐 **Authentication:** Lightweight username-based (no external provider)
- 📜 **Core Feature:** Users create and vote on commandments, forming a living moral code.

---

## 🏗️ Tech Stack

| Layer | Technology | Description |
|-------|-------------|-------------|
| **Frontend** | React (Vite) | Commandment feed, voting, submission, tooltips |
| **Backend** | Node.js + Express | REST API for posts and votes |
| **Database** | AWS DynamoDB (Local) | Stores posts, votes, and authors |
| **Language** | TypeScript | Shared types and structured logic |
| **Dev Tools** | npm-run-all + concurrently | Parallel execution of backend, frontend, and DB |

---

## 📁 Project Structure

```
FlexibleMorals/
│
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express server w/ DynamoDB logic
│   │   ├── routes/            # (optional) future route splits
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx       # Main page, shows commandments
│   │   │   ├── Vote.tsx       # Create and vote on posts
│   │   │   ├── About.tsx      # “What in the world is this?!”
│   │   ├── context/AuthContext.tsx
│   │   ├── utils/api.ts
│   └── package.json
│
├── package.json               # Root workspace runner
├── README.md
└── .env.example               # (optional) for remote Dynamo setup
```

---

## ⚡ Quick Start (Local)

### 1️⃣ Prerequisites

- **Node.js** v18+
- **npm** v9+
- **Java** (for DynamoDB local)
- **AWS CLI** installed (optional, for managing DynamoDB)

### 2️⃣ Clone the repo

```bash
git clone https://github.com/YOUR-USERNAME/FlexibleMorals.git
cd FlexibleMorals
```

### 3️⃣ Install dependencies

```bash
npm install
```

This installs dependencies for **root**, **backend**, and **frontend** workspaces.

---

## 🧱 Local DynamoDB Setup

### 1️⃣ Place DynamoDB Local files
Ensure your local DB is at:

```
C:\DynamoDB\
├── DynamoDBLocal.jar
├── DynamoDBLocal_lib/
```

If not installed yet:
```bash
mkdir C:\DynamoDB
cd C:\DynamoDB
curl -O https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.zip
tar -xf dynamodb_local_latest.zip
```

---

### 2️⃣ Start DynamoDB manually (optional)

```bash
java -Djava.library.path=C:\DynamoDB\DynamoDBLocal_lib -jar C:\DynamoDB\DynamoDBLocal.jar -sharedDb -port 8000
```

or let the root script handle it automatically (see below 👇).

---

### 3️⃣ Create the table

```bash
aws dynamodb create-table ^
  --table-name FlexibleTable ^
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S ^
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE ^
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 ^
  --endpoint-url http://localhost:8000
```

Confirm it exists:
```bash
aws dynamodb list-tables --endpoint-url http://localhost:8000
```

---

### 4️⃣ (Optional) Seed Example Data

```bash
aws dynamodb put-item ^
  --table-name FlexibleTable ^
  --item "{\"PK\": {\"S\": \"POST#1\"}, \"SK\": {\"S\": \"META\"}, \"title\": {\"S\": \"Thou shalt be chill\"}, \"votes\": {\"N\": \"5\"}, \"authorId\": {\"S\": \"test-user-123\"}}" ^
  --endpoint-url http://localhost:8000
```

---

## 🧩 Run the Entire App

The root `package.json` has everything wired together:

```json
"scripts": {
  "dev": "npm run dev:all",
  "dev:all": "npm-run-all -p dev:dynamodb dev:backend dev:frontend",
  "dev:dynamodb": "java -Djava.library.path=C:\\DynamoDB\\DynamoDBLocal_lib -jar C:\\DynamoDB\\DynamoDBLocal.jar -sharedDb -port 8000",
  "dev:backend": "npm --workspace backend run dev",
  "dev:frontend": "npm --workspace frontend start"
}
```

Start everything:
```bash
npm run dev
```

This launches:
- 🗃️ DynamoDB Local → `http://localhost:8000`
- ⚙️ Backend → `http://localhost:3001`
- 🎨 Frontend → `http://localhost:5173`

---

## 🌐 Frontend Details

- **Home Page:** Displays commandments split between two stone-like panels.
- **Vote Page:** Lets users log in (username only), create new commandments, and vote.
- **About Page:** Explains the concept (“What in the world is this?!”).
- **Character Limit:** 80 per commandment (live counter + validation).

Tooltips on the Home page show who created each commandment.

---

## 🧠 Backend API

| Method | Endpoint | Description |
|--------|-----------|-------------|
| `GET` | `/posts` | Get all commandments |
| `POST` | `/posts` | Create a new commandment |
| `POST` | `/posts/:id/vote` | Upvote or downvote a commandment |

---

## 🧩 Example API Call (via cURL)

```bash
curl -X POST http://localhost:3001/posts \
  -H "Content-Type: application/json" \
  -d '{"content":"Thou shalt hydrate","username":"Grant"}'
```

---

## 🧰 Useful Commands

| Command | Description |
|----------|-------------|
| `npm run dev` | Run full stack (frontend + backend + local DynamoDB) |
| `npm run dev:backend` | Run backend only |
| `npm run dev:frontend` | Run frontend only |
| `aws dynamodb list-tables --endpoint-url http://localhost:8000` | Verify local tables |
| `aws dynamodb scan --table-name FlexibleTable --endpoint-url http://localhost:8000` | View all posts |

---

## 💾 Data Model (FlexibleTable)

| Field | Type | Description |
|--------|------|-------------|
| `PK` | String | Partition key (`POST#<id>`) |
| `SK` | String | Sort key (`META`) |
| `title` | String | Commandment text |
| `votes` | Number | Vote count |
| `authorId` | String | Username that created the post |
| `userVotes` | Map | User-specific voting record |

---

## 🔒 Authentication (Simple)

- No passwords or external providers.
- Users log in by typing a username.
- Stored in local context (`AuthContext`) and persists for the session.

---

## 🎨 Design Notes

- Home background: `FlexibleMoralsPicture.png`
- Vote background: `Voting_Background.png`
- Tooltip shows “username: <name>”
- “Offering” link → PayPal donation
- “Merch” button → “Coming Soon!” popup
- “What in the world is this?!” → `/about` page

---

## 🚀 Future Improvements

- Add persistent login w/ cookies or JWT
- Deploy DynamoDB remotely (AWS cloud)
- Add pagination or trending feed
- Add mobile layout for commandments
- User avatars or custom color themes

---

## 🧹 Quick Reset (Local DynamoDB)

If your local database becomes messy or out of sync, run the following commands in PowerShell to **reset and re-seed**:

```bash
# Remove the existing table
aws dynamodb delete-table --table-name FlexibleTable --endpoint-url http://localhost:8000

# Recreate the table
aws dynamodb create-table ^
  --table-name FlexibleTable ^
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S ^
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE ^
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 ^
  --endpoint-url http://localhost:8000

# Reinsert a test item
aws dynamodb put-item ^
  --table-name FlexibleTable ^
  --item "{\"PK\": {\"S\": \"POST#1\"}, \"SK\": {\"S\": \"META\"}, \"title\": {\"S\": \"Thou shalt be chill\"}, \"votes\": {\"N\": \"5\"}, \"authorId\": {\"S\": \"test-user-123\"}}" ^
  --endpoint-url http://localhost:8000
```

This brings your local database back to a clean state with a single sample post.

---

## 🧑‍💻 Author
**Grant Redfield**  
[grant.a.redfield@gmail.com](mailto:grant.a.redfield@gmail.com)
