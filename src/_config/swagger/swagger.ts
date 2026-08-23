import swaggerJsdoc from "swagger-jsdoc";
import { authSwaggerDocs } from "./auth.schema";
import { envConfig } from "../env";


const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "FreightAgent API",
            version: "1.0.0",
        },
        servers: [
            {
                url: `${envConfig.BACKEND_URL}`,
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "accessToken",
                },
            },
        },
        // ✅ সব schema এখানে merge হবে
        paths: {
            ...authSwaggerDocs,
            // ...shipmentSwaggerDocs, ← পরে add করো
        },
    },
    apis: [], // ← এখন আর file scan করতে হবে না
};

export const swaggerSpec = swaggerJsdoc(options);