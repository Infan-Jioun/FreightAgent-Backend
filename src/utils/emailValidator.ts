
import axios from "axios";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const disposableDomains: string[] = require("disposable-email-domains");
export const isTempEmail = async (email: string): Promise<boolean> => {
    const domain = email.split("@")[1]?.toLowerCase();

    // Step 1: package দিয়ে fast check
    if (disposableDomains.includes(domain as string)) return true;

    // Step 2: API দিয়ে accurate check
    try {
        const res = await axios.get(
            `https://disposable.debounce.io/?email=${email}`
        );
        return res.data.disposable === "true";
    } catch {
        return false; //
    }
};