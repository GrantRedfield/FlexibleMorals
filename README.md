# Flexible Morals

**The world's first democratic religion.**

Flexible Morals is a full-stack web application where anyone on the internet can write, vote on, and debate "modern commandments" — crowd-sourced moral statements that form a living ethical code. The top 10 most-upvoted commandments are displayed on stone tablets each month before voting resets, letting the collective conscience evolve over time. The site features live chat, threaded comment discussions, a donor system, and a medieval gold-and-stone aesthetic throughout.

**Live site:** [flexiblemorals.org](https://flexiblemorals.org)

![Flexible Morals](frontend/public/FlexibleMoralsPicture.png)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages and Routes](#pages-and-routes)
- [Backend API](#backend-api)
- [Database Schema](#database-schema)
- [Donor System](#donor-system)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Author](#author)

---

## Features

### Commandment Voting
- Submit original commandments (60-character limit, one per day per user)
- Browse and vote on submissions in a card-based UI with thumbs-up (heavenly glow) and thumbs-down (hellfire) buttons
- Sort by Top, Hot (time-decay algorithm), New, or Random
- Authors automatically upvote their own submissions
- Progress tracker shows how many commandments you've voted on

### Home Page — The Tablets
- Top 10 commandments displayed on stone tablet panels with Roman numeral numbering
- Countdown timer to the next monthly "moral reset"
- Prayer hands and falling coins animations
- Clickable usernames open profile popups showing total blessings and donor tier

### Threaded Comments
- Reddit-style threaded discussions on every commandment (up to 3 levels deep)
- Comment voting (upvote/downvote per user)
- Edit and delete your own comments (soft-delete shows "[deleted]" like Reddit)
- Emoji picker with custom Flexible Morals emojis
- Low-score comments (below -5) are auto-hidden with a click-to-reveal
- Collapsible threads and sorting by Top or New

### Live Chat (Sacred Discourse)
- Global live chat with real-time polling
- Giphy GIF search integration
- Emoji picker with custom and standard emojis
- Twitch-style colored usernames (deterministic per user)
- Progressive anti-spam system with escalating mute durations
- Twitch-style "Chat paused" banner when scrolling up, with a Resume button showing new message count
- Reply targeting to reference other users
- GIF URL validation (Giphy, Tenor, Imgur, Discord CDN)

### Donor System
- Three tiers: Supporter ($1+), Patron ($25+), Benefactor ($100+)
- Badges displayed next to usernames across the site
- PayPal and Ethereum donation methods
- Link your PayPal email to claim past donations
- Donor profile page with tier progress

### Authentication
- Lightweight username-based login (no password required)
- Optional Amazon Cognito integration for full auth
- Session persisted in localStorage

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | TailwindCSS, custom CSS with medieval gold theme |
| Animations | Framer Motion |
| Routing | React Router DOM v6 |
| HTTP Client | Axios |
| Backend | Node.js, Express 4, TypeScript |
| Runtime | tsx (TypeScript execution without build step) |
| Database | AWS DynamoDB (single-table design) |
| Auth (optional) | Amazon Cognito |
| Payments | PayPal webhooks, Ethereum address |
| ID Generation | nanoid |
| Frontend Hosting | AWS S3 + CloudFront |
| Backend Hosting | AWS Elastic Beanstalk (Node.js 22) |

---

## Project Structure

```
FlexibleMorals/
├── frontend/
│   ├── public/                     # Static assets (images, icons)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Stone tablets, top 10 commandments, countdown
│   │   │   ├── Vote.tsx            # Submit & vote on commandments
│   │   │   ├── Comments.tsx        # Threaded comment discussions
│   │   │   ├── About.tsx           # "What in the world is this?!"
│   │   │   └── DonorProfile.tsx    # Donor tier status & PayPal linking
│   │   ├── components/
│   │   │   ├── ChatBox.tsx         # Live chat with GIFs, emojis, pause detection
│   │   │   ├── LoginButton.tsx     # Fixed top-left auth button
│   │   │   ├── LoginModal.tsx      # Auth modal (Cognito or legacy)
│   │   │   ├── DonationPopup.tsx   # PayPal / Crypto / Card donation modal
│   │   │   ├── DonorBadge.tsx      # Tier badge next to usernames
│   │   │   └── UserProfilePopup.tsx# User stats popup on name click
│   │   ├── context/
│   │   │   ├── AuthContext.tsx      # Global auth state
│   │   │   └── DonorContext.tsx     # Cached donor status management
│   │   ├── utils/
│   │   │   ├── api.ts              # All API calls (posts, comments, chat, donors)
│   │   │   └── emoji.ts            # Custom emoji definitions & emoticon replacement
│   │   ├── hooks/
│   │   │   └── useMediaQuery.tsx    # Responsive breakpoint hook
│   │   ├── App.tsx                 # Route definitions
│   │   └── main.tsx                # Entry point
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.ts               # Express server, core post/vote endpoints
│   │   ├── routes/
│   │   │   ├── chatRoutes.ts       # Chat messages with rate limiting
│   │   │   ├── commentRoutes.ts    # CRUD comments with threading & voting
│   │   │   ├── donorRoutes.ts      # Donor tiers, email linking, bulk status
│   │   │   ├── postRoutes.js       # Post management
│   │   │   ├── voteRoutes.js       # Vote handling
│   │   │   └── authRoutes.js       # Auth endpoints
│   │   ├── lib/
│   │   │   ├── dynamodb.ts         # DynamoDB client & table config
│   │   │   └── cognito.ts          # Cognito auth utilities
│   │   ├── webhooks/
│   │   │   └── paypal.ts           # PayPal donation webhook & tier calculation
│   │   └── scripts/
│   │       └── seed.ts             # Database seeder (10 commandments, 200+ chat msgs, 3 donors)
│   ├── Procfile                    # Elastic Beanstalk start command
│   └── package.json
│
├── package.json                    # Root workspace config (npm workspaces)
└── README.md
```

---

## Pages and Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Stone tablets displaying the top 10 commandments with monthly reset countdown, live chat sidebar, prayer/coin animations |
| `/vote` | Vote | Card-based voting interface (4 at a time), commandment submission form, sort options, vote progress tracker |
| `/comments/:postId` | Comments | Threaded discussion for a specific commandment with voting, editing, deleting, and emoji support |
| `/about` | About | Project explainer — the charter of Flexible Morals |
| `/donor` | Donor Profile | View your donor tier, total donated, link PayPal email to claim donations |

---

## Backend API

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/posts` | Fetch all commandments |
| `POST` | `/posts` | Create a new commandment (1/day limit) |
| `POST` | `/posts/:id/vote` | Upvote or downvote a commandment |

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/comments/:postId` | Fetch all comments for a commandment |
| `POST` | `/api/comments/:postId` | Create a comment (supports `parentId` for threading) |
| `POST` | `/api/comments/:postId/:commentId/vote` | Vote on a comment |
| `PUT` | `/api/comments/:postId/:commentId` | Edit a comment (owner only) |
| `DELETE` | `/api/comments/:postId/:commentId` | Soft-delete a comment (owner only) |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat/messages` | Fetch messages (supports `?since=<ISO>` for polling) |
| `POST` | `/api/chat/messages` | Send a message (rate-limited with progressive muting) |

### Donors

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/donor/status/:username` | Get a user's donor tier and badge |
| `GET` | `/api/donor/bulk-status` | Batch fetch donor statuses (`?usernames=a,b,c`) |
| `GET` | `/api/donor/my-status` | Get current user's full donor profile |
| `POST` | `/api/donor/link-email` | Link a PayPal email to claim donations |
| `GET` | `/api/donor/tiers` | Fetch tier definitions and thresholds |

---

## Database Schema

The backend uses a **single DynamoDB table** (`FlexibleMoralsPosts`) with a composite primary key (`PK` + `SK`). All record types share the same table using key prefixes:

| Record Type | PK | SK | Key Fields |
|-------------|----|----|-----------|
| Post | `POST#<timestamp>` | `META#POST` | title, votes, authorId, userVotes, createdAt |
| Daily Submission | `USER#<username>` | `SUBMISSION#<YYYY-MM-DD>` | submittedAt |
| Comment | `COMMENTS#<postId>` | `COMMENT#<createdAt>#<commentId>` | commentId, username, text, votes, userVotes, parentId, editedAt, deleted |
| Chat Message | `CHAT#global` | `MSG#<createdAt>#<messageId>` | messageId, username, message, createdAt |
| Donor Record | `DONOR#<username>` | `STATUS` | totalDonated, tier, paypalEmail, firstDonationAt |
| PayPal Link | `PAYPAL#<email>` | `LINK` | username, linkedAt |
| Donation | `DONATION#<transactionId>` | `RECORD` | amount, paypalEmail, processedAt |

---

## Donor System

Users can support Flexible Morals through donations, earning visible badges next to their username across the site.

| Tier | Threshold | Badge | Color |
|------|-----------|-------|-------|
| Supporter | $1+ | ⭐ | Bronze |
| Patron | $25+ | 🙏 | Silver |
| Benefactor | $100+ | 👑 | Gold |

**Donation methods:**
- **PayPal** — Opens a PayPal donation link; a webhook records the transaction automatically
- **Ethereum** — Send ETH to the published wallet address
- **Credit Card** — Coming soon

Users link their PayPal email on the Donor Profile page to claim past donations and unlock their tier badge.

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm v9+
- Java (for DynamoDB Local)
- AWS CLI (optional, for DynamoDB management)

### Install

```bash
git clone https://github.com/GrantRedfield/FlexibleMorals.git
cd FlexibleMorals
npm install
```

This installs dependencies for the root workspace, backend, and frontend.

### Set Up DynamoDB Local

```bash
# Download and extract DynamoDB Local
mkdir C:\DynamoDB && cd C:\DynamoDB
curl -O https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.zip
tar -xf dynamodb_local_latest.zip

# Create the table
aws dynamodb create-table \
  --table-name FlexibleMoralsPosts \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --endpoint-url http://localhost:8000
```

### Run the App

```bash
npm run dev
```

This starts all three services in parallel:
- DynamoDB Local on `http://localhost:8000`
- Backend on `http://localhost:3001`
- Frontend on `http://localhost:5173`

### Seed Sample Data

```bash
cd backend
npx tsx src/scripts/seed.ts
```

This populates the database with 10 sample commandments, 200+ chat messages, and 3 donor accounts.

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3001
SESSION_SECRET=dev_change_me
CORS_ORIGIN=http://localhost:5173

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=localKey
AWS_SECRET_ACCESS_KEY=localSecret
DYNAMO_TABLE=FlexibleMoralsPosts
DYNAMO_ENDPOINT=http://localhost:8000

ACCESS_TOKEN_SECRET=supersecretaccesstoken
REFRESH_TOKEN_SECRET=supersecretrefreshtoken
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3001
```

---

## Deployment

### Frontend
The frontend is built with Vite and deployed as static files to **AWS S3** behind a **CloudFront** distribution.

```bash
cd frontend
npx vite build
aws s3 sync dist/ s3://flexiblemorals.org --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### Backend
The backend runs on **AWS Elastic Beanstalk** (Node.js 22 on Amazon Linux 2023). Deployment involves zipping the backend source and uploading a new application version.

```bash
# Create deployment zip (must use forward-slash paths for Linux)
cd backend
zip -r deploy.zip package.json package-lock.json tsconfig.json Procfile src/

# Upload and deploy
aws s3 cp deploy.zip s3://elasticbeanstalk-us-east-1-<ACCOUNT_ID>/v<N>.zip
aws elasticbeanstalk create-application-version \
  --application-name FlexibleMorals-API \
  --version-label v<N> \
  --source-bundle S3Bucket=elasticbeanstalk-us-east-1-<ACCOUNT_ID>,S3Key=v<N>.zip
aws elasticbeanstalk update-environment \
  --environment-name FlexibleMorals-API-env \
  --version-label v<N>
```

### Infrastructure
- **Frontend CDN:** CloudFront (`d2zt5oaywv8bq7.cloudfront.net`)
- **Backend API:** CloudFront (`d1mjhw1mqe0nf4.cloudfront.net`) proxying to Elastic Beanstalk
- **Database:** AWS DynamoDB (us-east-1)
- **Payments:** PayPal webhook integration

---

## Rate Limits

| Action | Limit |
|--------|-------|
| Commandment submission | 1 per day per user |
| Comment creation | 1 per 3 seconds per user |
| Chat message | 15-second base cooldown, doubles per spam strike (max 10 minutes) |

---

## Author

**Grant Redfield**
[grant.a.redfield@gmail.com](mailto:grant.a.redfield@gmail.com)
