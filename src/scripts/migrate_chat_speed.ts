import { prisma } from "../lib/prisma.js";

async function runChatSpeedMigration() {
  console.log("Starting safe SQL migration for chat speed...");

  // 1. Create enum MessageType
  await prisma.$executeRawUnsafe(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageType') THEN 
        CREATE TYPE "MessageType" AS ENUM ('TEXT', 'FILE'); 
      END IF; 
    END $$;
  `);
  console.log("Enum MessageType ensured.");

  // 2. Add columns to conversations
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "conversations" 
    ADD COLUMN IF NOT EXISTS "lastMessageId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerUnread" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "agentUnread" INTEGER NOT NULL DEFAULT 0;
  `);
  console.log("Columns added to conversations.");

  // 3. Add columns to conversation_messages
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "conversation_messages" 
    ADD COLUMN IF NOT EXISTS "clientMessageId" TEXT,
    ADD COLUMN IF NOT EXISTS "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "attachmentName" TEXT,
    ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
  `);
  console.log("Columns added to conversation_messages.");

  // 4. Create indexes
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "conversation_messages_conversationId_senderId_clientMessageId_key" 
    ON "conversation_messages"("conversationId", "senderId", "clientMessageId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "conversation_messages_conversationId_readAt_senderId_idx" 
    ON "conversation_messages"("conversationId", "readAt", "senderId");
  `);
  console.log("Indexes created.");

  // 5. Backfill readAt for messages where isRead = true
  await prisma.$executeRawUnsafe(`
    UPDATE "conversation_messages"
    SET "readAt" = "createdAt"
    WHERE "isRead" = true AND "readAt" IS NULL;
  `);
  console.log("Backfilled readAt for read messages.");

  // 6. Backfill lastMessageId and unread counts for conversations
  const conversations = await prisma.$queryRaw<Array<{ id: string; customerId: string; agentId: string }>>`
    SELECT "id", "customerId", "agentId" FROM "conversations";
  `;

  console.log(`Backfilling ${conversations.length} conversations...`);
  for (const conv of conversations) {
    // Latest message
    const latestMessages = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "conversation_messages" 
      WHERE "conversationId" = ${conv.id} 
      ORDER BY "createdAt" DESC 
      LIMIT 1;
    `;
    const lastMsgId = latestMessages[0]?.id ?? null;

    // customer unread = messages sent by agent not read
    const customerUnreadRes = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "conversation_messages"
      WHERE "conversationId" = ${conv.id}
        AND "senderId" = ${conv.agentId}
        AND ("readAt" IS NULL AND "isRead" = false);
    `;
    const customerUnread = Number(customerUnreadRes[0]?.count || 0);

    // agent unread = messages sent by customer not read
    const agentUnreadRes = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "conversation_messages"
      WHERE "conversationId" = ${conv.id}
        AND "senderId" = ${conv.customerId}
        AND ("readAt" IS NULL AND "isRead" = false);
    `;
    const agentUnread = Number(agentUnreadRes[0]?.count || 0);

    await prisma.$executeRawUnsafe(
      `UPDATE "conversations" 
       SET "lastMessageId" = $1, "customerUnread" = $2, "agentUnread" = $3 
       WHERE "id" = $4;`,
      lastMsgId,
      customerUnread,
      agentUnread,
      conv.id
    );
  }

  console.log("Chat speed migration and backfill completed successfully!");
}

runChatSpeedMigration()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
