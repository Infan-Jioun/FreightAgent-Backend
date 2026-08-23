import nodemailer from "nodemailer"
import { envConfig } from "../_config/env"
import status from "http-status";
import path from "path";
import ejs from 'ejs';
import AppError from "../errorHelper/AppError";
const transporter = nodemailer.createTransport({
    host: envConfig.EMAIL_HOST,
    secure: false,
    auth: {
        user: envConfig.EMAIL_SMTP_USER,
        pass: envConfig.EMAIL_SMTP_PASS
    },
    port: Number(envConfig.EMAIL_PORT)
})
// *File sneding
interface SendEmailOption {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, any>;
    attachments?: {
        fileName: string,
        content: string,
        contentType: string
    }[]
}
export const sendEmail = async ({ subject, templateData, templateName, to, attachments }: SendEmailOption) => {
    try {
        const templatePath = path.resolve(process.cwd(), `src/app/template/${templateName}.ejs`);
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
        })
        console.log(`Email send to ${to} : ${info.messageId} `);
    } catch (error) {
        console.error("Email Sending failed", error);
        throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to send email");
    }
}