/*
  Warnings:

  - You are about to drop the `account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chat_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_chunks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shipments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `status_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- DropForeignKey
ALTER TABLE "shipments" DROP CONSTRAINT "shipments_userId_fkey";

-- DropForeignKey
ALTER TABLE "status_logs" DROP CONSTRAINT "status_logs_shipmentId_fkey";

-- DropTable
DROP TABLE "account";

-- DropTable
DROP TABLE "chat_sessions";

-- DropTable
DROP TABLE "knowledge_chunks";

-- DropTable
DROP TABLE "session";

-- DropTable
DROP TABLE "shipments";

-- DropTable
DROP TABLE "status_logs";

-- DropTable
DROP TABLE "users";

-- DropTable
DROP TABLE "verification";
