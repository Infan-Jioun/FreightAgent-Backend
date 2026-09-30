import { prisma } from "../src/lib/prisma.js";

async function main() {
  const convCols = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'conversations';
  `;
  console.log("conversations columns:", convCols);

  const msgCols = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'conversation_messages';
  `;
  console.log("conversation_messages columns:", msgCols);
}

main().catch(console.error).finally(() => prisma.$disconnect());
