import { sendEmail } from "./email";

export const sendWelcomeEmail = async (name: string, email: string, role: string) => {
    await sendEmail({
        to: email,
        subject: "Welcome to FreightAgent 🎉",
        templateName: "welcome",
        templateData: { name, email, role },
    });
};