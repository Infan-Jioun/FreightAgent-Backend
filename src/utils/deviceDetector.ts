import { Request } from "express";

export interface IDeviceInfo {
    deviceName: string;
    deviceType: "desktop" | "mobile" | "tablet";
    browser: string;
    os: string;
}

export const parseUserAgent = (userAgent?: string | null): IDeviceInfo => {
    if (!userAgent) {
        return {
            deviceName: "Desktop PC",
            deviceType: "desktop",
            browser: "Web Browser",
            os: "Unknown OS",
        };
    }

    const ua = userAgent.toLowerCase();

    // 1. Device Type
    const isTablet = /ipad|tablet|(android(?!.*mobile))/i.test(ua);
    const isMobile = !isTablet && /mobile|iphone|ipod|android|windows phone|blackberry/i.test(ua);
    const deviceType: "desktop" | "mobile" | "tablet" = isTablet
        ? "tablet"
        : isMobile
        ? "mobile"
        : "desktop";

    // 2. Operating System
    let os = "Unknown OS";
    if (ua.includes("windows nt 10")) os = "Windows 10/11";
    else if (ua.includes("windows nt 6.3")) os = "Windows 8.1";
    else if (ua.includes("windows nt 6.1")) os = "Windows 7";
    else if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("macintosh") || ua.includes("mac os x")) os = "macOS";
    else if (ua.includes("iphone")) os = "iOS (iPhone)";
    else if (ua.includes("ipad")) os = "iPadOS";
    else if (ua.includes("android")) os = "Android";
    else if (ua.includes("linux")) os = "Linux";

    // 3. Browser
    let browser = "Web Browser";
    if (ua.includes("edg/")) browser = "Microsoft Edge";
    else if (ua.includes("opr/") || ua.includes("opera")) browser = "Opera";
    else if (ua.includes("chrome") || ua.includes("crios")) browser = "Google Chrome";
    else if (ua.includes("firefox") || ua.includes("fxios")) browser = "Mozilla Firefox";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Apple Safari";

    // 4. Device Name
    let deviceName = `${os} (${browser})`;
    if (isTablet) {
        deviceName = ua.includes("ipad") ? `Apple iPad (${browser})` : `Android Tablet (${browser})`;
    } else if (isMobile) {
        if (ua.includes("iphone")) deviceName = `Apple iPhone (${browser})`;
        else if (ua.includes("android")) deviceName = `Android Phone (${browser})`;
        else deviceName = `Mobile Device (${browser})`;
    }

    return {
        deviceName,
        deviceType,
        browser,
        os,
    };
};

export const getClientIp = (req: Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    let ip = "";

    if (typeof forwarded === "string") {
        ip = forwarded.split(",")[0]?.trim() || "";
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
        ip = forwarded[0]?.trim() || "";
    }

    if (!ip) {
        ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    }

    // Normalize IPv6 loopback
    if (ip === "::1" || ip === "::ffff:127.0.0.1") {
        ip = "127.0.0.1";
    }

    return ip;
};
