import nodemailer from "nodemailer"
import { envConfig } from "../_config/env"
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
export const sendEmail = () => {

}