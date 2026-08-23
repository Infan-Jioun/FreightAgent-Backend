import dotEnv from "dotenv";
import status from "http-status";
import AppError from "../errorHelper/AppError";
dotEnv.config();

interface EnvConfig {
    NODE_ENV: string;
    PORT: string;
    BACKEND_URL: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    DATABASE_URL: string;
    ACCESS_TOKEN_SECRET: string;
    ACCESS_TOKEN_EXPIRES_IN: string;
    REFRESH_TOKEN_SECRET: string;
    REFRESH_TOKEN_EXPIRES_IN: string;
    EMAIL_HOST: string;
    EMAIL_SMTP_USER: string;
    EMAIL_SMTP_PASS: string;
    EMAIL_PORT: string;
    EMAIL_SMTP_FROM: string;
    SWAGGER_USER: string
    SWAGGER_PASS: string
}

const loadVariabales = (): EnvConfig => {
    const requirementVariables = [
        "NODE_ENV",
        "PORT",
        "BACKEND_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "DATABASE_URL",
        "ACCESS_TOKEN_SECRET",
        "ACCESS_TOKEN_EXPIRES_IN",
        "REFRESH_TOKEN_SECRET",
        "REFRESH_TOKEN_EXPIRES_IN",
        "EMAIL_HOST",
        "EMAIL_SMTP_USER",
        "EMAIL_SMTP_PASS",
        "EMAIL_PORT",
        "EMAIL_SMTP_FROM",
        "SWAGGER_USER",
        "SWAGGER_PASS"
    ];

    requirementVariables.forEach((variable) => {
        if (!process.env[variable]) {
            throw new AppError(
                status.INTERNAL_SERVER_ERROR,
                `Environment Variable ${variable} is required but not set in the .env file`
            );
        }
    });

    return {
        NODE_ENV: process.env.NODE_ENV as string,
        PORT: process.env.PORT as string,
        BACKEND_URL: process.env.BACKEND_URL as string,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL as string,
        DATABASE_URL: process.env.DATABASE_URL as string,
        ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET as string,
        ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN as string,
        REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET as string,
        REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN as string,
        EMAIL_HOST: process.env.EMAIL_HOST as string,
        EMAIL_SMTP_USER: process.env.EMAIL_SMTP_USER as string,
        EMAIL_SMTP_PASS: process.env.EMAIL_SMTP_PASS as string,
        EMAIL_PORT: process.env.EMAIL_PORT as string,
        EMAIL_SMTP_FROM: process.env.EMAIL_SMTP_FROM as string,
        SWAGGER_USER: process.env.SWAGGER_USER as string,
        SWAGGER_PASS: process.env.SWAGGER_PASS as string
    };
};

export const envConfig = loadVariabales();