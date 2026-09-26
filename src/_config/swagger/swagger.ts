import swaggerJsdoc from "swagger-jsdoc";
import { authSwaggerDocs } from "./auth.schema";
import { adminSwaggerDocs } from "./admin.schema";
import { agentSwaggerDocs } from "./agent.schema";
import { shipmentSwaggerDocs } from "./shipment.schema";
import { paymentSwaggerDocs } from "./payment.schema";
import { ragSwaggerDocs } from "./rag.schema";
import { envConfig } from "../env";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "FreightAgent API",
            version: "1.0.0",
            description: "Production API Documentation for FreightAgent backend services (Auth, Admin, Agent, Shipment, Payment, and RAG AI Assistant modules)",
        },
        servers: [
            {
                url: `${envConfig.BACKEND_URL}`,
                description: "API Base URL",
            },
        ],
        tags: [
            {
                name: "Auth",
                description: "Authentication and user session management APIs",
            },
            {
                name: "Admin",
                description: "Admin operations, road agent management, and shipment dispatch APIs",
            },
            {
                name: "Agent",
                description: "Road Agent operations, shipment transit updates, acceptance, and availability APIs",
            },
            {
                name: "Shipment",
                description: "Shipment creation, tracking, and customer APIs",
            },
            {
                name: "Payment",
                description: "Freight pricing engine, Stripe payment intents, webhooks, and refunds",
            },
            {
                name: "RAG AI Assistant",
                description: "Public RAG AI Assistant powered by OpenRouter, Redis Caching, and dynamic live database retrieval",
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "accessToken",
                },
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
        // All module schemas merged here
        paths: {
            ...authSwaggerDocs,
            ...adminSwaggerDocs,
            ...agentSwaggerDocs,
            ...shipmentSwaggerDocs,
            ...paymentSwaggerDocs,
            ...ragSwaggerDocs,
        },
    },
    apis: [], // static schemas loaded directly via paths
};

export const swaggerSpec = swaggerJsdoc(options);