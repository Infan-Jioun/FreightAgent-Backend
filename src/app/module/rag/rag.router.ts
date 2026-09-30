import { Router } from "express";
import { validateRequest } from "../../../middleware/validateRequest";
import { ragRateLimit } from "../../../utils/rateLimit";
import { ragController } from "./rag.controller";
import { ragQuerySchema, ragSessionParamsSchema } from "./rag.validation";

const router = Router();

// ─── 1. Public RAG Chat (OpenRouter + Redis Cache + Dynamic DB Retrieval) ───
router.post(
    "/chat",
    ragRateLimit,
    validateRequest(ragQuerySchema),
    ragController.askQuestion
);

// ─── 2. Session Conversation History (Multi-turn Redis Memory) ──────────────
router.get(
    "/session/:sessionId",
    ragRateLimit,
    validateRequest(ragSessionParamsSchema),
    ragController.getSessionHistory
);

// ─── 3. Clear Session History ───────────────────────────────────────────────
router.delete(
    "/session/:sessionId",
    validateRequest(ragSessionParamsSchema),
    ragController.clearSession
);

// ─── 4. Live Public Logistics Directory (Ports, Corridors, Rules) ───────────
router.get(
    "/public-directory",
    ragRateLimit,
    ragController.getPublicDirectory
);

export const ragRouter = router;
