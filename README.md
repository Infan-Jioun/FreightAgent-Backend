# 🚢 FreightAgent — Backend Engine & Logistics Operating System

[![Node.js Version](https://img.shields.io/badge/Node.js-v24%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express 5](https://img.shields.io/badge/Express-v5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-v7.9-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Stripe](https://img.shields.io/badge/Stripe-v22-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![OpenRouter](https://img.shields.io/badge/AI%20RAG-OpenRouter-6366F1?style=for-the-badge&logo=openai&logoColor=white)](https://openrouter.ai/)

---

## 📑 Table of Contents

- [Executive Summary](#-executive-summary)
- [System Architecture](#-system-architecture)
- [Key Business Domains & Implementation Highlights](#-key-business-domains--implementation-highlights)
  - [1. Authentication & Enterprise Session Management](#1-authentication--enterprise-session-management)
  - [2. Multi-Role RBAC & Profile Management](#2-multi-role-rbac--profile-management)
  - [3. Agent Credential Compliance & Corridor Routing](#3-agent-credential-compliance--corridor-routing)
  - [4. Shipment Lifecycle & Smart Corridor Dispatch](#4-shipment-lifecycle--smart-corridor-dispatch)
  - [5. Maritime & Air Freight Pricing Calculation Engine](#5-maritime--air-freight-pricing-calculation-engine)
  - [6. Stripe Payment Processing & Webhooks](#6-stripe-payment-processing--webhooks)
  - [7. ISO 32000-1 Vector PDF Generation Engine](#7-iso-32000-1-vector-pdf-generation-engine)
  - [8. Real-Time Socket.IO Communication & Messaging](#8-real-time-socketio-communication--messaging)
  - [9. AI Logistics Assistant & Dynamic RAG Engine](#9-ai-logistics-assistant--dynamic-rag-engine)
  - [10. Distributed Background Queues & Cron Automation](#10-distributed-background-queues--cron-automation)
  - [11. Notification System & Email Broadcasts](#11-notification-system--email-broadcasts)
- [Directory Structure](#-directory-structure)
- [Comprehensive REST API Reference](#-comprehensive-rest-api-reference)
- [Real-Time Socket.IO Protocol](#-real-time-socketio-protocol)
- [Environment Configuration](#-environment-configuration)
- [Database Setup & Migrations](#-database-setup--migrations)
- [Getting Started & Local Development](#-getting-started--local-development)
- [Security, Rate Limiting & Resilience](#-security-rate-limiting--resilience)
- [Production Deployment](#-production-deployment)

---

## 🌟 Executive Summary

**FreightAgent Backend** is an enterprise-grade Digital Freight Forwarding platform and Logistics Operating System. Engineered to automate end-to-end maritime and air cargo logistics, it provides automated cost calculation, intelligent agent assignment, shipment lifecycle tracking, verified agent credential compliance, real-time customer-agent communication, Stripe payment automation, and an OpenRouter-powered Retrieval-Augmented Generation (RAG) assistant.

The backend is built with **Express 5**, strictly typed with **TypeScript**, persistent across a partitioned **Prisma 7 PostgreSQL schema**, and augmented by **Upstash Redis**, **BullMQ**, and **Socket.IO** for event-driven, high-concurrency performance.

---

## 🏛 System Architecture

```mermaid
flowchart TD
    Client[Web & Mobile Clients] -->|HTTPS REST / WSS| NGINX[Gateway / Reverse Proxy]
    NGINX --> ExpressApp[Express 5 Enterprise Server]

    subgraph SecurityLayer[Security & Middleware]
        ExpressApp --> RateLimiter[Redis Rate Limiter]
        ExpressApp --> AuthGuard[Dual Auth: JWT Rotation + Better-Auth]
        ExpressApp --> ZodValidator[Zod Request Validation]
    end

    subgraph CoreModules[Application Domain Services]
        AuthGuard --> AuthModule[Auth & Session Service]
        AuthGuard --> ShipmentModule[Shipment & Lifecycle Service]
        AuthGuard --> AgentModule[Agent Compliance & Corridors]
        AuthGuard --> PaymentModule[Pricing Engine & Stripe Gateway]
        AuthGuard --> ChatModule[WhatsApp-Style Messaging Service]
        AuthGuard --> RagModule[Dynamic RAG & OpenRouter AI]
        AuthGuard --> LocationModule[Global Port & Terminal Registry]
    end

    subgraph RealTimeAndJobs[Real-Time & Background Infrastructure]
        ChatModule <--> SocketServer[Socket.IO Server]
        ShipmentModule --> SocketServer
        LocationModule --> BullQueue[BullMQ Job Queue]
        CronRunner[Node-Cron with Redis Distributed Lock] --> PrismaDB[(PostgreSQL Database)]
        BullQueue --> EmailWorker[Nodemailer Batch Worker]
    end

    subgraph ExternalIntegrations[Third-Party Integrations]
        PaymentModule --> StripeAPI[Stripe Payment Gateway]
        ChatModule --> CloudinaryAPI[Cloudinary Storage]
        RagModule --> OpenRouterAPI[OpenRouter LLM API]
        EmailWorker --> SmtpServer[SMTP Mail Server]
    end

    CoreModules --> PrismaDB
    CoreModules --> RedisCache[(Upstash Redis Cache)]
```

---

## 💎 Key Business Domains & Implementation Highlights

### 1. Authentication & Enterprise Session Management
- **Dual Authentication Architecture**: Leverages `better-auth` combined with a high-throughput JWT access and refresh token rotation model (`accessToken`, `refreshToken` stored in Secure HTTP-Only cookies with fallback to `Bearer` authorization headers).
- **Session Intelligence & Device Fingerprinting**: Stores client hardware metadata, browser type, operating system, and IP address for every active session. Supports remote session inspection and immediate single or multi-session revocation.
- **Security Hardening**:
  - Redis-backed token revocation/blacklisting.
  - Disposable email domain blocking via `disposable-email-domains`.
  - Failed login rate throttling and brute-force lockouts.
  - 6-digit OTP verification for email verification, registration, and password changes.
  - Google OAuth single sign-on integration.

### 2. Multi-Role RBAC & Profile Management
- **Role Hierarchy**: Three strictly enforced roles: `CUSTOMER`, `AGENT`, and `ADMIN`.
- **User Profile Suite**: Comprehensive avatar management via Cloudinary, address formatting, and E.164 phone verification powered by `libphonenumber-js`.
- **Administrative Governance**: Admin dashboard controllers for user role upgrades, account suspension with mandatory audit notes, soft deletion, and real-time session termination.

### 3. Agent Credential Compliance & Corridor Routing
- **Agent Verification Lifecycle**: Agents transition through `NOT_APPLICABLE`, `PENDING`, `VERIFIED`, `REJECTED`, and `SUSPENDED` states.
- **Accreditation Registry**: Validates international freight forwarding licenses:
  - FIATA Membership
  - IATA Accreditation
  - NVOCC License
  - AEO Certificate
  - ISO 9001
  - Local Trade & Customs Brokerage Licenses
- **Automated Suspension Routine**: Daily cron checks verify expiration dates. If a credential expires, the agent's operating status is automatically set to `SUSPENDED`, triggering push notifications to both agent and administrators.
- **Operating Corridors**: Agents register active shipping corridors connecting specific origin and destination ports (e.g., Chattogram Port `CGP` to Port of Rotterdam `RTM`).

### 4. Shipment Lifecycle & Smart Corridor Dispatch
- **Shipment Status State Machine**:
  $$\text{PENDING} \longrightarrow \text{ASSIGNED} \longrightarrow \text{ACCEPTED} \longrightarrow \text{PICKED\_UP} \longrightarrow \text{IN\_TRANSIT} \longrightarrow \text{AT\_CUSTOMS} \longrightarrow \text{OUT\_FOR\_DELIVERY} \longrightarrow \text{DELIVERED}$$
- **Smart Agent Auto-Assignment**: When a customer books a consignment, the system calculates the optimal agent by matching registered corridor routes, geographic proximity, and current agent availability (`isAvailable: true`).
- **Audit Status Logging**: Every status transition generates an immutable `StatusLog` entry detailing actor ID, status, port location, and tracking notes.
- **Public Consignment Tracking**: Public endpoint (`/api/v1/shipment/track/:trackingId`) provides tracking data with real-time milestone visualizers without requiring authentication.

### 5. Maritime & Air Freight Pricing Calculation Engine
The system includes a production-grade logistics pricing engine (`pricing.engine.ts`):
- **Great Circle / Haversine Distance Calculation**: Calculates exact nautical and terrestrial distances between ports using latitude and longitude coordinates.
- **Distance Tier Modifiers**:
  - `SHORT` (< 2,500 km)
  - `MEDIUM` (2,500 km - 8,000 km)
  - `LONG` (> 8,000 km)
- **14-Point Cost Breakdown**:
  1. Base Ocean / Air Freight
  2. Origin Handling Charges (OHC)
  3. Bunker Adjustment Factor (BAF fuel surcharge)
  4. Terminal Handling Charges Origin (THC-O)
  5. Terminal Handling Charges Destination (THC-D)
  6. Transshipment Transfer Fees
  7. Export/Import Customs Clearance
  8. Customs Tariff / Duty Estimates
  9. Value Added Tax (VAT)
  10. Destination Handling Charges (DHC)
  11. Marine Cargo Insurance (ad valorem based on declared value)
  12. Last-Mile Inland Delivery
  13. Agent Freight Forwarding Fee
  14. FreightAgent Platform Commission
- **Multi-Currency Conversion Engine**: Converts calculated USD rates dynamically to any currency (EUR, GBP, BDT, etc.) with real-time conversion cached in Redis.

### 6. Stripe Payment Processing & Webhooks
- **Stripe PaymentIntents**: Dynamic PaymentIntent generation linked to shipment IDs with custom metadata for reconciliation.
- **Cryptographic Webhook Verification**: High-priority `/api/v1/payment/webhook` with `express.raw` payload parsing to verify `stripe-signature` headers.
- **Automated Lifecycle Transitions**:
  - `payment_intent.succeeded`: Automatically marks shipment `PaymentStatus: PAID`, records payment timestamp, generates commercial invoice PDF, and emits real-time notifications to customer and agent.
  - `payment_intent.payment_failed`: Marks `PaymentStatus: FAILED` and triggers recovery email notification.
- **Agent Withdrawals & Commission Settlement**: Dedicated agent wallet for commission balance calculations, minimum threshold verification, withdrawal request handling, and receipt generation.

### 7. ISO 32000-1 Vector PDF Generation Engine
- **Native Pure-Code Vector PDF Engine**: Custom built (`pdfGenerator.ts`) without the memory overhead of headless Chromium (Puppeteer/Playwright).
- **FreightAgent Commercial Invoice**:
  - Clean vector rendering with official FreightAgent maritime branding.
  - Multi-line bill-to / ship-to parties, container tracking codes, route details, and itemized fee tables.
  - Stamp authorization zones, payment verification hashes, and print-ready dimensions.
- **Agent Commission Withdrawal Slips**: Generates transaction receipts for accounting audits.
- **Inline Streaming**: Endpoints stream PDF buffers directly to the browser for viewing and printing.

### 8. Real-Time Socket.IO Communication & Messaging
- **Dual-Channel Messaging**: Fully integrated Socket.IO server (`socket.ts`) accompanied by REST fallback endpoints (`chat.router.ts`).
- **Enterprise Handshake Security**: Validates JWTs, checks Redis token blacklists, auto-disconnects on token expiration, and assigns users to scoped rooms:
  - `user_${userId}`
  - `role_${role}`
  - `admin_room`
  - `conversation_${conversationId}`
- **WhatsApp-Style Instant ACK**: Sends acknowledgement callbacks (`SendMessageAckResponse`) with optimistic `clientMessageId` and `tempId` for instant UI updates.
- **Micro-Features**:
  - Server-side throttled typing indicators (max 1 event per 2 seconds per socket).
  - Real-time read receipts (`mark_read` -> `readAt`).
  - Real-time message editing with historical edit flags (`isEdited: true`).
  - Protected chat attachment streaming (`/api/v1/chat/files/:filename`) with MIME-type security.

### 9. AI Logistics Assistant & Dynamic RAG Engine
- **OpenRouter LLM Integration**: Connects to advanced AI models (e.g. LLaMA 3.3 70B Instruct / Gemini 2.0 Flash) through OpenRouter.
- **Dynamic Context Retrieval (`RagRetriever`)**:
  - Analyzes natural language queries and extracts shipment tracking IDs.
  - Injects live database tracking status, active corridors, verified ports, and pricing matrices directly into prompt context.
  - 5-minute Redis caching prevents database load on repetitive public queries.
- **Deterministic Synthesis Fallback**: If OpenRouter API keys are not supplied or external network outages occur, an in-memory deterministic parser extracts verified facts from live database tables so the user experience never fails.
- **Multi-Turn Chat Sessions**: Conversation history stored in Redis with session persistence.

### 10. Distributed Background Queues & Cron Automation
- **BullMQ Location Announcement Worker**: When an administrator adds a new seaport or airport, a background job (`locationEmailQueue`) broadcasts email announcements to active platform users.
  - Processes users in batches of 500.
  - Sub-concurrency of 5 to respect SMTP rate limits.
  - Exponential backoff with 3 automatic retries.
- **Cron Jobs with Redis Distributed Locking (`withCronLock`)**:
  - Daily unverified account cleanup (removes pending registrations older than 24 hours).
  - Daily agent license compliance audit (sends 30-day renewal warnings and suspends expired accounts).
  - Overlap prevention: `withCronLock` ensures that if multiple server instances are running, only one executes the scheduled maintenance.

### 11. Notification System & Email Broadcasts
- **Omni-Channel Notifications**: Combines in-app persistent notifications with real-time Socket.IO broadcasts and transactional emails.
- **12 Professional EJS Email Templates**:
  - `welcome.ejs`: Account registration welcome
  - `otp.ejs`: 6-digit authentication pin
  - `passwordChanged.ejs`: Security alert upon credential updates
  - `shipment.ejs`: Consignment booking confirmation
  - `shipmentStatus.ejs`: Stage-by-stage milestone updates
  - `agentAssigned.ejs`: Agent dispatch notification
  - `customerAgentAssigned.ejs`: Customer notification of assigned forwarder
  - `newLocation.ejs`: New global port announcement
  - `paymentSuccess.ejs`: Payment receipt confirmation
  - `paymentFailed.ejs`: Payment failure alert and retry instructions
  - `accountSuspended.ejs`: Compliance suspension notice
  - `roleUpdate.ejs`: Role elevation notifications

---

## 📂 Directory Structure

```text
FreightAgent-Backend/
├── prisma/                             # Multi-file Prisma schema configuration
│   ├── schema.prisma                   # Generator & datasource configuration
│   ├── auth.prisma                     # Users, sessions, accounts, verifications
│   ├── shipment.prisma                 # Shipments, cost breakdowns, status logs, withdrawals
│   ├── location.prisma                 # Ports, terminals, agent shipping corridors
│   ├── credential.prisma               # Professional licenses, accreditation audits
│   ├── chat.prisma                     # Chat sessions, conversations, messages, RAG knowledge
│   ├── notification.prisma             # In-app notification records
│   ├── audit.prisma                    # Administrator audit trail
│   ├── enum.prisma                     # Global database enums
│   ├── phoneVerification.prisma        # SMS phone verification records
│   └── seed.ts                         # Complete database seed script
├── src/
│   ├── _config/                        # System configuration & environment
│   │   ├── env.ts                      # Strict environment variable validator
│   │   └── swagger/                    # OpenAPI 3.0 documentation specs
│   ├── app/
│   │   ├── jobs/                       # Cron automation & distributed locks
│   │   │   └── cleanupJobs.ts          # Unverified user cleanup & license expiry monitors
│   │   ├── module/                     # Domain modules (Controller-Service-Router-Validation)
│   │   │   ├── admin/                  # Fleet management, audit, user governance
│   │   │   ├── agent/                  # Assigned shipments, availability, corridor operations
│   │   │   ├── auth/                   # JWT, Better-Auth, OTP, Google OAuth
│   │   │   ├── chat/                   # P2P conversation, attachments, security guards
│   │   │   ├── location/               # Port registry, geocoding, autocomplete
│   │   │   ├── notification/           # Notification dispatch, mark-as-read
│   │   │   ├── payment/                # Pricing engine, Stripe Webhooks, agent withdrawals
│   │   │   ├── rag/                    # OpenRouter AI client, dynamic RAG retriever
│   │   │   ├── shipment/               # Shipment CRUD, smart assignment, tracking
│   │   │   └── user/                   # Profile, phone verification, active sessions
│   │   └── template/                   # 12 Responsive EJS transactional email templates
│   ├── errorHelper/                    # AppError & structured error utilities
│   ├── generated/                      # Auto-generated Prisma client output
│   ├── lib/                            # Core service singletons
│   │   ├── auth.ts                     # Better-Auth initialization
│   │   ├── emailQueue.ts               # BullMQ worker & queue definitions
│   │   ├── prisma.ts                   # Prisma client instance with pg adapter
│   │   ├── redis.ts                    # Upstash Redis client
│   │   └── socket.ts                   # Socket.IO setup, room guards, instant ACK
│   ├── middleware/                     # Express middlewares
│   │   ├── auth.ts                     # JWT authentication & RBAC guards
│   │   ├── fileUpload.ts               # Multer file upload handlers (Memory / Disk)
│   │   ├── globalErrorHandler.ts       # Global centralized error middleware
│   │   ├── notFound.ts                 # 404 handler
│   │   └── validateRequest.ts          # Zod schema validation middleware
│   ├── utils/                          # Cross-cutting utilities
│   │   ├── autoAssignAgent.ts          # Spatial & corridor matching algorithm
│   │   ├── cloudinary.ts               # Document & image CDN management
│   │   ├── deviceDetector.ts           # User-Agent device & platform parser
│   │   ├── email.ts                    # Nodemailer transport & EJS compiler
│   │   ├── exchangeRate.ts             # Dynamic FX conversion tables
│   │   ├── jwt.ts                      # Token signing & verification
│   │   ├── pdfGenerator.ts             # ISO 32000-1 vector PDF generation engine
│   │   ├── rateLimit.ts                # Redis-backed rate limiters
│   │   └── tokenBlacklist.ts           # Revoked token tracking
│   ├── app.ts                          # Express application assembly & route mounting
│   └── server.ts                       # HTTP server entrypoint, Socket.IO binding
├── tsup.config.ts                      # Fast production bundler configuration
├── tsconfig.json                       # TypeScript compiler options
└── package.json                        # Dependencies, scripts, and engine specs
```

---

## 📡 Comprehensive REST API Reference

All protected endpoints require an `Authorization: Bearer <token>` header or a valid `accessToken` HTTP-only cookie.

### 🔐 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Public | Register customer account with email verification OTP |
| `POST` | `/login` | Public | Authenticate user, issue JWTs and device session |
| `POST` | `/logout` | Authenticated | Revoke session and invalidate refresh tokens |
| `POST` | `/refresh-token` | Public | Rotate access token using secure refresh cookie |
| `POST` | `/send-otp` | Public | Request email verification OTP |
| `POST` | `/verify-otp` | Public | Verify 6-digit OTP code |
| `POST` | `/forgot-password` | Public | Dispatch password reset verification OTP |
| `POST` | `/reset-password` | Public | Reset password using valid reset token |
| `GET` | `/me` | Authenticated | Fetch current authenticated user profile |
| `POST` | `/change-password/send-otp`| Authenticated | Request OTP for password modification |
| `POST` | `/change-password` | Authenticated | Change password with active OTP |
| `POST` | `/create-admin` | Admin | Register additional platform administrators |
| `POST` | `/create-agent` | Public/Admin | Register new freight forwarder / agent |
| `GET` | `/google` | Public | Initiate Google OAuth flow |
| `GET` | `/google/callback` | Public | Google OAuth return callback |

### 📦 2. Shipments (`/api/v1/shipment`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/track/:trackingId` | Public | Public real-time consignment milestone tracker |
| `POST` | `/` | Customer, Agent, Admin | Create a new freight shipment booking |
| `GET` | `/` | Admin | List all system shipments with pagination and filters |
| `GET` | `/my` | All Roles | List current user's booked shipments |
| `GET` | `/agent/assigned` | Agent, Admin | List shipments assigned to the logged-in agent |
| `GET` | `/:id` | Authenticated | Retrieve complete shipment details and cost breakdown |
| `PATCH`| `/:id/status` | Agent, Admin | Progress shipment status with notes and port location |
| `DELETE`| `/:id` | Admin | Soft delete or cancel shipment record |

### 💳 3. Payments, Pricing & Billing (`/api/v1/payment`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/calculate-pricing` | Public | Run instant 14-point freight cost calculator |
| `POST` | `/create-intent` | Customer, Admin | Initialize Stripe PaymentIntent for a shipment |
| `POST` | `/verify-status` | Customer, Admin | Check and sync Stripe payment intent status |
| `POST` | `/webhook` | Stripe Webhook | Process raw Stripe webhooks with signature checks |
| `GET` | `/invoice-pdf/:identifier` | Public (Signed) | Stream vector commercial invoice PDF in browser |
| `GET` | `/withdrawal-slip-pdf/:id` | Agent, Admin | Stream official withdrawal receipt PDF |
| `POST` | `/refund` | Admin | Process payment refund through Stripe API |
| `GET` | `/admin/stats` | Admin | Financial metrics, revenue, volume, and commission |
| `GET` | `/admin/withdrawals` | Admin | List all agent withdrawal requests |
| `GET` | `/agent/earnings` | Agent | View earned commissions and available wallet balance |
| `POST` | `/agent/withdraw` | Agent | Submit commission withdrawal request |
| `GET` | `/agent/withdrawals` | Agent | View personal withdrawal transaction history |

### 💬 4. Real-Time Chat & Documents (`/api/v1/chat`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/conversation` | Customer, Agent | Retrieve or create chat room for assigned shipment |
| `GET` | `/conversations` | Authenticated | List all active chat conversations for current user |
| `GET` | `/conversations/:id/messages`| Authenticated | Get message history with cursor pagination (`?after=`) |
| `POST` | `/conversations/:id/messages`| Authenticated | Send message (REST fallback for Socket.io) |
| `PATCH`| `/conversations/:id/messages/:msgId` | Authenticated | Edit previously sent message |
| `PATCH`| `/conversations/:id/read` | Authenticated | Mark conversation messages as read |
| `POST` | `/conversations/:id/upload` | Authenticated | Upload attachment (PDF/image up to 10MB) |
| `GET` | `/files/:filename` | Authenticated | Stream protected chat attachment with access guard |

### 🤖 5. AI Logistics Assistant & RAG (`/api/v1/rag`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/chat` | Public | Ask logistics AI assistant with dynamic RAG context |
| `GET` | `/session/:sessionId` | Public | Retrieve multi-turn conversation session history |
| `DELETE`| `/session/:sessionId` | Public | Clear AI assistant conversation session |
| `GET` | `/public-directory` | Public | Fetch live directory of ports, corridors, and rates |

### 📍 6. Global Port Registry (`/api/v1/locations`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/search?q=...` | Public | Lightweight autocomplete port search |
| `GET` | `/code/:code` | Public | Fetch location details by UN/LOCODE / IATA code |
| `GET` | `/` | Public | List global ports and terminals with filters |
| `GET` | `/:id` | Authenticated | Retrieve location record by primary ID |
| `POST` | `/` | Admin | Register new seaport, airport, or container depot |
| `PATCH`| `/:id` | Admin | Update location coordinates and metadata |
| `PATCH`| `/:id/block` | Admin | Block port from accepting new shipments |
| `PATCH`| `/:id/unblock` | Admin | Restore blocked location to active service |
| `DELETE`| `/:id` | Admin | Soft delete location from directory |
| `PATCH`| `/:id/restore` | Admin | Restore soft-deleted location |

### 🛡️ 7. Admin Fleet & Security Operations (`/api/v1/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/users` | Admin | List all registered platform users with filters |
| `GET` | `/users/:id` | Admin | View detailed user profile and associated activity |
| `PATCH`| `/users/:id/role` | Admin | Update user role (`CUSTOMER`, `AGENT`, `ADMIN`) |
| `PATCH`| `/users/:id/status` | Admin | Update account status or suspend user |
| `DELETE`| `/users/:id` | Admin | Soft delete user account |
| `GET` | `/users/:id/sessions`| Admin | Inspect all active login sessions of a specific user |
| `DELETE`| `/users/:id/sessions/:sid` | Admin | Force-terminate a specific active user session |
| `DELETE`| `/users/:id/sessions` | Admin | Revoke all sessions for a user (force logout all) |
| `GET` | `/sessions` | Admin | View platform-wide active user sessions |
| `GET` | `/agents` | Admin | List all verified freight agents with corridor coverage |
| `PATCH`| `/shipments/:id/assign` | Admin | Manually assign or override agent on a shipment |

### 🔔 8. Notifications (`/api/v1/notifications`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Authenticated | Get paginated list of user notifications |
| `GET` | `/unread-count` | Authenticated | Get count of unread notifications |
| `PATCH`| `/read-all` | Authenticated | Mark all notifications as read |
| `PATCH`| `/:id/read` | Authenticated | Mark single notification as read |
| `DELETE`| `/:id` | Authenticated | Remove notification from inbox |

---

## ⚡ Real-Time Socket.IO Protocol

The Socket.IO server operates on the root HTTP server instance with CORS verification.

### Connection Handshake
```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { token: "YOUR_JWT_ACCESS_TOKEN" },
  transports: ["websocket"],
  withCredentials: true
});
```

### Client to Server Events

| Event | Payload Shape | Description |
| :--- | :--- | :--- |
| `join_conversation` | `{ conversationId: string }` | Enters shipment chat room with access authorization |
| `leave_conversation`| `{ conversationId: string }` | Exits shipment chat room |
| `send_message` | `{ conversationId, content, clientMessageId, tempId, type }` | Dispatches message; returns instant ACK callback |
| `edit_message` | `{ conversationId, messageId, content }` | Edits previously delivered message |
| `mark_read` | `{ conversationId: string }` | Updates delivery status of messages to read |
| `typing` | `{ conversationId: string }` | Emits typing state (throttled to 1 event / 2s) |
| `stop_typing` | `{ conversationId: string }` | Clears typing indicator |

### Server to Client Events

| Event | Payload Shape | Description |
| :--- | :--- | :--- |
| `new_message` | Full `ConversationMessage` object | Broadcast to conversation room on new message |
| `message_edited` | Updated `ConversationMessage` object | Broadcast to conversation room on edit |
| `messages_read` | `{ conversationId, userId, readAt }` | Informs room occupants that messages were read |
| `user_typing` | `{ conversationId, userId }` | Displays active typing bubble |
| `user_stop_typing` | `{ conversationId, userId }` | Dismisses typing bubble |
| `notification` | `{ type, event, ...data }` | Real-time push notification for user or role |
| `session_expired` | `{ message: string }` | Emitted before socket disconnect when JWT expires |

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
# Application Core
NODE_ENV=development
PORT=5000
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
TRACKING_URL=http://localhost:3000/track

# Better-Auth & Session Security
BETTER_AUTH_SECRET=your_super_secret_better_auth_key_min_32_chars
BETTER_AUTH_URL=http://localhost:5000

# PostgreSQL Connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/freightagent_db?schema=public

# JWT Security
ACCESS_TOKEN_SECRET=your_jwt_access_token_secret_key_here
ACCESS_TOKEN_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=your_jwt_refresh_token_secret_key_here
REFRESH_TOKEN_EXPIRES_IN=7d

# SMTP Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_gmail_app_password
EMAIL_SMTP_FROM="FreightAgent Logistics" <noreply@freightagent.com>

# Swagger Documentation Auth
SWAGGER_USER=admin
SWAGGER_PASS=freightagent2026!

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-upstash-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cron Security Secret (for manual or Vercel trigger verification)
CRON_SECRET=your_secure_cron_trigger_secret

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Stripe Financial Integration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_signing_secret

# OpenRouter AI & RAG Engine
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
```

---

## 🗄️ Database Setup & Migrations

The database schema is organized across 10 modular `.prisma` files in `prisma/`.

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Push schema changes directly to development database
npx prisma db push

# 3. (Alternative) Run formal migrations
npx prisma migrate dev --name init

# 4. Populate database with complete seed data
# (Creates admin, test agents, customers, ports, sample shipments, and credentials)
npx tsx prisma/seed.ts
```

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Node.js**: `v20.x` or later
- **npm** or **pnpm**
- **PostgreSQL**: `v15` or later
- **Redis**: Local Redis instance or active Upstash Redis database

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/Infan-Jioun/FreightAgent-Backend.git
cd FreightAgent-Backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Start local development server with hot-reload
npm run dev
```

Upon startup, the terminal outputs the server status card:

```text
┌─────────────────────────────────────────┐
│         🚢 FreightAgent Server          │
├─────────────────────────────────────────┤
│  Status  :  Running                     │
│  Port    : 5000                         │
│  Mode    : development                  │
│  Redis   : Connected                    │
│  Socket  : Ready                        │
└─────────────────────────────────────────┘
```

- **API Root**: `http://localhost:5000/`
- **Swagger Documentation**: `http://localhost:5000/api/v1/api-docs` *(Requires HTTP Basic Auth credentials configured in `.env`)*

---

## 🛡️ Security, Rate Limiting & Resilience

- **Express Rate Limiting with Redis Store**:
  - `loginRateLimit`: 5 requests per 15 minutes.
  - `registerRateLimit`: 5 requests per hour.
  - `otpRateLimit`: 3 requests per 10 minutes.
  - `createShipmentRateLimit`: 10 requests per 15 minutes.
  - `ragRateLimit`: 20 requests per minute.
- **Strict Request Validation**: Every route is protected with custom Zod schemas preventing malicious payload injections.
- **Credential Protection**: Passwords hashed with secure cryptographic algorithms via `better-auth`.
- **CORS Protection**: Normalized origin validation with wildcard support for local development and authorized production domains.
- **Centralized Error Handling**: Standardized HTTP response structure:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorSources": [
    {
      "path": "weight",
      "message": "Cargo weight must be greater than 0 kg"
    }
  ]
}
```

---

## 🚢 Production Deployment

### Build Command
The project utilizes `tsup` for rapid bundling along with `shx` to bundle email templates:

```bash
npm run build
```

This generates:
- Bundled server binary in `dist/server.js`.
- Copies all EJS email templates into `dist/app/template/`.

### Start Production Server
```bash
npm run start
```

### Vercel Serverless Deployment
The repository includes a root `vercel.json` configuration and `trust proxy` configuration for serverless deployment. Cron routines can be scheduled via HTTP calls to `/api/cron/cleanup` using the `x-cron-secret` header.

---

## 👨‍💻 Maintainers & Author

- **FreightAgent Core Engineering Team**
- **Repository**: [Infan-Jioun/FreightAgent-Backend](https://github.com/Infan-Jioun/FreightAgent-Backend)
- **License**: ISC License
