import dotEnv from "dotenv";
import AppError from "../app/errorHelper/AppError";
import status from "http-status";
dotEnv.config();
interface EnvConfig {
    NODE_ENV: string,
    PORT: string,
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    DATABASE_URL: string
}

const loadVariabales = (): EnvConfig => {
    const requirementVariables = [

        "NODE_ENV",
        "PORT",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "DATABASE_URL",
    ]
    requirementVariables.forEach((variable) => {
        if (!process.env[variable]) {
            throw new AppError(status.INTERNAL_SERVER_ERROR, `Environment Variable ${variable} is required but not set in the .env file`)
        }
    })
    return {
        NODE_ENV: process.env.NODE_ENV as string,
        PORT: process.env.PORT as string,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL as string,
        DATABASE_URL: process.env.DATABASE_URL as string,
    }
}

export const envConfig = loadVariabales()