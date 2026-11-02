import nodemailer from "nodemailer";
import { envConfig } from "../_config/env";
import status from "http-status";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ejs from 'ejs';
import AppError from "../errorHelper/AppError";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isGmail = envConfig.EMAIL_HOST?.toLowerCase().includes("gmail");

const transporter = isGmail
    ? nodemailer.createTransport({
          service: "gmail",
          pool: true,
          maxConnections: 3,
          maxMessages: 100,
          auth: {
              user: envConfig.EMAIL_SMTP_USER,
              pass: envConfig.EMAIL_SMTP_PASS.replace(/\s+/g, ""),
          },
      })
    : nodemailer.createTransport({
          host: envConfig.EMAIL_HOST,
          port: Number(envConfig.EMAIL_PORT),
          secure: Number(envConfig.EMAIL_PORT) === 465,
          pool: true,
          maxConnections: 5,
          auth: {
              user: envConfig.EMAIL_SMTP_USER,
              pass: envConfig.EMAIL_SMTP_PASS.replace(/\s+/g, ""),
          },
      });

interface SendEmailOption {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, any>;
    attachments?: {
        fileName: string;
        content: string | Buffer;
        contentType?: string;
    }[];
}

/**
 * Resolves the absolute path of an EJS template across development (src/)
 * and production builds (dist/ or Vercel bundle).
 */
const resolveTemplatePath = (templateName: string): string => {
    const candidates = [
        path.resolve(process.cwd(), `dist/app/template/${templateName}.ejs`),
        path.resolve(process.cwd(), `src/app/template/${templateName}.ejs`),
        path.resolve(process.cwd(), `app/template/${templateName}.ejs`),
        path.resolve(__dirname, `../app/template/${templateName}.ejs`),
        path.resolve(__dirname, `app/template/${templateName}.ejs`),
        path.resolve(__dirname, `../../app/template/${templateName}.ejs`),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        `Email template '${templateName}.ejs' not found. Searched candidate paths:\n` +
        candidates.map((c) => ` - ${c}`).join("\n")
    );
};

export const sendEmail = async ({ subject, templateData, templateName, to, attachments }: SendEmailOption) => {
    try {
        const templatePath = resolveTemplatePath(templateName);
        const html = await ejs.renderFile(templatePath, templateData);

        const info = await transporter.sendMail({
            from: envConfig.EMAIL_SMTP_FROM,
            subject: subject,
            to: to,
            html: html,
            attachments: attachments?.map((attachment) => ({
                filename: attachment.fileName,
                content: attachment.content,
                contentType: typeof attachment.contentType === 'string' ? attachment.contentType : undefined
            }))
        });

        console.log(`📧 [Email] Successfully sent "${subject}" to ${to} (MessageId: ${info.messageId})`);
    } catch (error) {
        console.error(`❌ [Email] Failed to send email "${subject}" to ${to}:`, error);
        throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to send email");
    }
};