import swaggerJsdoc from "swagger-jsdoc";
import { authSwaggerDocs } from "./auth.schema";
import { adminSwaggerDocs } from "./admin.schema";
import { shipmentSwaggerDocs } from "./shipment.schema";
import { envConfig } from "../env";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "FreightAgent API",
            version: "1.0.0",
            description: "API Documentation for FreightAgent backend services (Auth, Admin, and Shipment modules)",
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
                description: "Authentication and user management APIs",
            },
            {
                name: "Admin",
                description: "Admin panel operations and role management APIs",
            },
            {
                name: "Shipment",
                description: "Shipment creation, tracking, and status update APIs",
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
        // সব module এর schema এখানে merge হবে
        paths: {
            ...authSwaggerDocs,
            ...adminSwaggerDocs,
            ...shipmentSwaggerDocs,
        },
    },
    apis: [], // static schemas loaded directly via paths
};

export const swaggerSpec = swaggerJsdoc(options);