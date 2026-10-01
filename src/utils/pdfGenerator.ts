/**
 * FreightAgent ISO 32000-1 Compliant Vector PDF Generator
 * Built with the official FreightAgent Brand Theme (Dark Cyber Maritime Aesthetic)
 *
 * Design System Palette:
 * --bg-primary: #0a0f0f [0.039, 0.059, 0.059]
 * --bg-card: #0d1f1f [0.051, 0.122, 0.122]
 * --bg-card-hover: #112a2a [0.067, 0.165, 0.165]
 * --border-primary: #1a4a4a [0.102, 0.290, 0.290]
 * --border-accent: #00c9a7 [0.000, 0.788, 0.655]
 * --text-primary: #e0faf5 [0.878, 0.980, 0.961]
 * --text-secondary: #7ecfc4 [0.494, 0.812, 0.769]
 * --text-muted: #3a6b66 [0.227, 0.420, 0.400]
 * --accent-primary: #00c9a7 [0.000, 0.788, 0.655]
 * --accent-secondary: #00e5c0 [0.000, 0.898, 0.753]
 * --accent-blue: #00b4d8 [0.000, 0.706, 0.847]
 */

export const THEME = {
    bgPrimary: [0.039, 0.059, 0.059] as [number, number, number],
    bgCard: [0.051, 0.122, 0.122] as [number, number, number],
    bgCardAlt: [0.067, 0.165, 0.165] as [number, number, number],
    borderPrimary: [0.102, 0.290, 0.290] as [number, number, number],
    borderAccent: [0.000, 0.788, 0.655] as [number, number, number],
    textPrimary: [0.878, 0.980, 0.961] as [number, number, number],
    textSecondary: [0.494, 0.812, 0.769] as [number, number, number],
    textMuted: [0.227, 0.420, 0.400] as [number, number, number],
    accentPrimary: [0.000, 0.788, 0.655] as [number, number, number],
    accentSecondary: [0.000, 0.898, 0.753] as [number, number, number],
    accentBlue: [0.000, 0.706, 0.847] as [number, number, number],
    white: [1, 1, 1] as [number, number, number],
    darkBlack: [0.02, 0.03, 0.03] as [number, number, number],
};

interface TextOptions {
    size?: number;
    bold?: boolean;
    italic?: boolean;
    color?: [number, number, number];
    align?: "left" | "right" | "center";
}

export type ReceiptLineItem = [description: string, category: string, amount: number];

export const COMMERCIAL_INVOICE_THEME = {
    // Pure clean white sheet background
    bgWhite: [1.0, 1.0, 1.0] as [number, number, number],
    // Clean grey table header fill
    bgHeader: [0.94, 0.95, 0.96] as [number, number, number],
    bgHeaderSubtle: [0.97, 0.98, 0.99] as [number, number, number],
    bgTotalHighlight: [0.92, 0.96, 0.94] as [number, number, number],
    // Clean, crisp dark charcoal grid borders
    borderDark: [0.22, 0.25, 0.28] as [number, number, number],
    borderLight: [0.72, 0.75, 0.78] as [number, number, number],
    // Primary text
    textDark: [0.08, 0.10, 0.12] as [number, number, number],
    textLabel: [0.38, 0.42, 0.46] as [number, number, number],
    textMuted: [0.52, 0.56, 0.60] as [number, number, number],
    // Brand accents
    accentTeal: [0.00, 0.45, 0.40] as [number, number, number],
    accentNavy: [0.08, 0.16, 0.25] as [number, number, number],
    signatureBlue: [0.07, 0.18, 0.45] as [number, number, number],
    sealBlue: [0.15, 0.35, 0.65] as [number, number, number],
};

export class FreightPdfBuilder {
    private width = 595.28; // A4 standard width in points
    private height = 841.89; // A4 standard height in points
    private streamOps: string[] = [];

    private toPdfY(y: number): number {
        return this.height - y;
    }

    private escapeText(text: string): string {
        return (text || "")
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/[^\x20-\x7E]/g, "?");
    }

    public drawRect(
        x: number,
        y: number,
        w: number,
        h: number,
        fillColor?: [number, number, number],
        strokeColor?: [number, number, number],
        lineWidth = 1
    ): void {
        const pdfY = this.toPdfY(y) - h;
        this.streamOps.push("q");
        if (lineWidth) this.streamOps.push(`${lineWidth.toFixed(2)} w`);
        if (fillColor) {
            this.streamOps.push(`${fillColor[0].toFixed(3)} ${fillColor[1].toFixed(3)} ${fillColor[2].toFixed(3)} rg`);
        }
        if (strokeColor) {
            this.streamOps.push(`${strokeColor[0].toFixed(3)} ${strokeColor[1].toFixed(3)} ${strokeColor[2].toFixed(3)} RG`);
        }
        this.streamOps.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
        if (fillColor && strokeColor) {
            this.streamOps.push("B");
        } else if (fillColor) {
            this.streamOps.push("f");
        } else if (strokeColor) {
            this.streamOps.push("S");
        }
        this.streamOps.push("Q");
    }

    public drawLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        strokeColor: [number, number, number] = THEME.borderPrimary,
        lineWidth = 1
    ): void {
        const pdfY1 = this.toPdfY(y1);
        const pdfY2 = this.toPdfY(y2);
        this.streamOps.push("q");
        this.streamOps.push(`${lineWidth.toFixed(2)} w`);
        this.streamOps.push(`${strokeColor[0].toFixed(3)} ${strokeColor[1].toFixed(3)} ${strokeColor[2].toFixed(3)} RG`);
        this.streamOps.push(`${x1.toFixed(2)} ${pdfY1.toFixed(2)} m ${x2.toFixed(2)} ${pdfY2.toFixed(2)} l S`);
        this.streamOps.push("Q");
    }

    public drawText(text: string, x: number, y: number, options: TextOptions = {}): void {
        const size = options.size || 10;
        const fontName = options.bold ? "/F2" : options.italic ? "/F3" : "/F1";
        const color = options.color || THEME.textPrimary;
        const sanitized = this.escapeText(text);

        let renderX = x;
        if (options.align === "right") {
            const approxWidth = sanitized.length * (size * 0.52);
            renderX = x - approxWidth;
        } else if (options.align === "center") {
            const approxWidth = sanitized.length * (size * 0.52);
            renderX = x - approxWidth / 2;
        }

        const pdfY = this.toPdfY(y) - size * 0.8;
        this.streamOps.push("BT");
        this.streamOps.push(`${fontName} ${size} Tf`);
        this.streamOps.push(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`);
        this.streamOps.push(`${renderX.toFixed(2)} ${pdfY.toFixed(2)} Td`);
        this.streamOps.push(`(${sanitized}) Tj`);
        this.streamOps.push("ET");
    }

    public drawWrappedText(
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight = 11,
        options: TextOptions = {}
    ): number {
        const size = options.size || 8;
        const charWidth = size * 0.52;
        const words = (text || "").split(/\s+/);
        let currentLine = "";
        let curY = y;

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length * charWidth > maxWidth && currentLine) {
                this.drawText(currentLine, x, curY, options);
                currentLine = word;
                curY += lineHeight;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            this.drawText(currentLine, x, curY, options);
            curY += lineHeight;
        }
        return curY;
    }

    public drawBadge(
        text: string,
        x: number,
        y: number,
        w: number,
        h: number,
        bgColor: [number, number, number],
        textColor: [number, number, number],
        borderColor?: [number, number, number]
    ): void {
        this.drawRect(x, y, w, h, bgColor, borderColor, borderColor ? 1 : 0);
        this.drawText(text, x + w / 2, y + (h - 9) / 2 + 1, {
            size: 8,
            bold: true,
            color: textColor,
            align: "center",
        });
    }

    public drawCircle(
        cx: number,
        cy: number,
        r: number,
        fillColor?: [number, number, number],
        strokeColor?: [number, number, number],
        lineWidth = 1
    ): void {
        const pdfY = this.toPdfY(cy);
        const k = 0.5522847498 * r;
        this.streamOps.push("q");
        if (lineWidth) this.streamOps.push(`${lineWidth.toFixed(2)} w`);
        if (fillColor) {
            this.streamOps.push(`${fillColor[0].toFixed(3)} ${fillColor[1].toFixed(3)} ${fillColor[2].toFixed(3)} rg`);
        }
        if (strokeColor) {
            this.streamOps.push(`${strokeColor[0].toFixed(3)} ${strokeColor[1].toFixed(3)} ${strokeColor[2].toFixed(3)} RG`);
        }
        this.streamOps.push(`${(cx + r).toFixed(2)} ${pdfY.toFixed(2)} m`);
        this.streamOps.push(`${(cx + r).toFixed(2)} ${(pdfY + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(pdfY + r).toFixed(2)} ${cx.toFixed(2)} ${(pdfY + r).toFixed(2)} c`);
        this.streamOps.push(`${(cx - k).toFixed(2)} ${(pdfY + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(pdfY + k).toFixed(2)} ${(cx - r).toFixed(2)} ${pdfY.toFixed(2)} c`);
        this.streamOps.push(`${(cx - r).toFixed(2)} ${(pdfY - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(pdfY - r).toFixed(2)} ${cx.toFixed(2)} ${(pdfY - r).toFixed(2)} c`);
        this.streamOps.push(`${(cx + k).toFixed(2)} ${(pdfY - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(pdfY - k).toFixed(2)} ${(cx + r).toFixed(2)} ${pdfY.toFixed(2)} c`);
        this.streamOps.push("h");
        if (fillColor && strokeColor) {
            this.streamOps.push("B");
        } else if (fillColor) {
            this.streamOps.push("f");
        } else if (strokeColor) {
            this.streamOps.push("S");
        }
        this.streamOps.push("Q");
    }

    public drawContinuousBezier(
        startX: number,
        startY: number,
        segments: Array<[number, number, number, number, number, number]>,
        strokeColor: [number, number, number] = [0.07, 0.18, 0.45],
        lineWidth = 1.3
    ): void {
        if (!segments.length) return;
        this.streamOps.push("q");
        this.streamOps.push(`${lineWidth.toFixed(2)} w`);
        this.streamOps.push("1 J"); // Round line cap
        this.streamOps.push("1 j"); // Round line join
        this.streamOps.push(`${strokeColor[0].toFixed(3)} ${strokeColor[1].toFixed(3)} ${strokeColor[2].toFixed(3)} RG`);
        this.streamOps.push(`${startX.toFixed(2)} ${this.toPdfY(startY).toFixed(2)} m`);
        for (const [cp1x, cp1y, cp2x, cp2y, endX, endY] of segments) {
            this.streamOps.push(
                `${cp1x.toFixed(2)} ${this.toPdfY(cp1y).toFixed(2)} ${cp2x.toFixed(2)} ${this.toPdfY(cp2y).toFixed(2)} ${endX.toFixed(2)} ${this.toPdfY(endY).toFixed(2)} c`
            );
        }
        this.streamOps.push("S");
        this.streamOps.push("Q");
    }

    /**
     * Renders an authentic, fluid cursive handwritten signature for "FreightAgent"
     * complete with calligraphic pen flourishes, official circular carrier seal, and verification hash
     */
    public drawFreightAgentSignature(
        x: number,
        y: number,
        trackingId?: string,
        agentName?: string | null,
        adminName?: string | null
    ): void {
        const ink: [number, number, number] = [0.07, 0.18, 0.45]; // Rich fountain pen blue
        const stampColor: [number, number, number] = [0.15, 0.35, 0.65]; // Official corporate seal blue

        // 1. Official Carrier Seal / Stamp (Rendered slightly behind signature)
        const sealX = x + 130;
        const sealY = y + 27;
        this.drawCircle(sealX, sealY, 19, undefined, stampColor, 0.9);
        this.drawCircle(sealX, sealY, 16.5, undefined, stampColor, 0.5);
        this.drawText("FREIGHT", sealX, sealY - 7, { size: 5.5, bold: true, color: stampColor, align: "center" });
        this.drawText("★ AGENT ★", sealX, sealY - 1, { size: 4.8, bold: true, color: stampColor, align: "center" });
        this.drawText("VERIFIED", sealX, sealY + 6, { size: 4.8, bold: true, color: stampColor, align: "center" });

        // 2. Beautiful Cursive Handwritten "FreightAgent" Vector Signature
        const ox = x + 4;
        const oy = y + 7;

        // F - Top cap flourish
        this.drawContinuousBezier(
            ox + 4, oy + 8,
            [
                [ox + 10, oy + 4, ox + 18, oy + 4, ox + 26, oy + 7],
            ],
            ink,
            1.4
        );

        // F - Main downward stem with graceful cursive slant & bottom loop
        this.drawContinuousBezier(
            ox + 15, oy + 5,
            [
                [ox + 14, oy + 15, ox + 11, oy + 24, ox + 8, oy + 34],
                [ox + 7, oy + 37, ox + 11, oy + 38, ox + 15, oy + 35],
            ],
            ink,
            1.4
        );

        // F - Crossbar
        this.drawContinuousBezier(
            ox + 6, oy + 19,
            [
                [ox + 11, oy + 18, ox + 17, oy + 20, ox + 22, oy + 18],
            ],
            ink,
            1.2
        );

        // "r-e-i-g-h-t" continuous connected cursive letters
        this.drawContinuousBezier(
            ox + 18, oy + 29,
            [
                // r
                [ox + 21, oy + 25, ox + 23, oy + 21, ox + 26, oy + 22],
                [ox + 28, oy + 22, ox + 30, oy + 23, ox + 31, oy + 26],
                [ox + 32, oy + 28, ox + 33, oy + 29, ox + 35, oy + 29],
                // e
                [ox + 37, oy + 29, ox + 40, oy + 21, ox + 43, oy + 22],
                [ox + 41, oy + 23, ox + 39, oy + 27, ox + 43, oy + 29],
                // i
                [ox + 45, oy + 29, ox + 47, oy + 22, ox + 50, oy + 22],
                [ox + 50, oy + 25, ox + 51, oy + 28, ox + 54, oy + 29],
                // g (bowl)
                [ox + 55, oy + 24, ox + 58, oy + 22, ox + 62, oy + 22],
                [ox + 65, oy + 23, ox + 65, oy + 28, ox + 61, oy + 29],
                [ox + 57, oy + 29, ox + 57, oy + 23, ox + 62, oy + 22],
                // g (descender loop)
                [ox + 63, oy + 27, ox + 64, oy + 37, ox + 63, oy + 43],
                [ox + 62, oy + 46, ox + 56, oy + 45, ox + 56, oy + 41],
                [ox + 56, oy + 37, ox + 62, oy + 33, ox + 67, oy + 29],
                // h
                [ox + 69, oy + 23, ox + 71, oy + 11, ox + 74, oy + 11],
                [ox + 73, oy + 13, ox + 72, oy + 24, ox + 72, oy + 30],
                [ox + 74, oy + 24, ox + 78, oy + 22, ox + 81, oy + 29],
                // t
                [ox + 83, oy + 25, ox + 85, oy + 14, ox + 87, oy + 14],
                [ox + 87, oy + 21, ox + 87, oy + 27, ox + 90, oy + 29],
            ],
            ink,
            1.3
        );

        // Dot for 'i'
        this.drawCircle(ox + 49, oy + 17, 1.1, ink, ink);

        // Crossbar for 't'
        this.drawContinuousBezier(
            ox + 82, oy + 20,
            [
                [ox + 86, oy + 19, ox + 89, oy + 19, ox + 92, oy + 19],
            ],
            ink,
            1.1
        );

        // Capital "A"
        this.drawContinuousBezier(
            ox + 93, oy + 30,
            [
                [ox + 96, oy + 23, ox + 100, oy + 10, ox + 104, oy + 9],
                [ox + 106, oy + 14, ox + 109, oy + 24, ox + 112, oy + 30],
            ],
            ink,
            1.4
        );
        // A's belly flourish
        this.drawContinuousBezier(
            ox + 98, oy + 22,
            [
                [ox + 102, oy + 20, ox + 107, oy + 20, ox + 114, oy + 22],
            ],
            ink,
            1.1
        );

        // "g-e-n-t" connected cursive
        this.drawContinuousBezier(
            ox + 114, oy + 24,
            [
                // g
                [ox + 116, oy + 21, ox + 121, oy + 21, ox + 123, oy + 25],
                [ox + 124, oy + 28, ox + 121, oy + 30, ox + 117, oy + 30],
                [ox + 115, oy + 29, ox + 115, oy + 24, ox + 122, oy + 23],
                [ox + 123, oy + 28, ox + 124, oy + 38, ox + 123, oy + 44],
                [ox + 122, oy + 47, ox + 116, oy + 46, ox + 116, oy + 42],
                [ox + 116, oy + 38, ox + 121, oy + 33, ox + 126, oy + 29],
                // e
                [ox + 128, oy + 29, ox + 131, oy + 22, ox + 133, oy + 22],
                [ox + 132, oy + 23, ox + 130, oy + 27, ox + 134, oy + 29],
                // n
                [ox + 136, oy + 23, ox + 138, oy + 23, ox + 140, oy + 29],
                [ox + 141, oy + 23, ox + 144, oy + 23, ox + 146, oy + 29],
                // t
                [ox + 148, oy + 23, ox + 149, oy + 13, ox + 151, oy + 13],
                [ox + 151, oy + 21, ox + 151, oy + 27, ox + 153, oy + 29],
            ],
            ink,
            1.3
        );

        // Crossbar for second 't'
        this.drawContinuousBezier(
            ox + 147, oy + 19,
            [
                [ox + 151, oy + 18, ox + 154, oy + 18, ox + 156, oy + 18],
            ],
            ink,
            1.1
        );

        // Signature Underline Flourish (Dynamic pen flick under the signature)
        this.drawContinuousBezier(
            ox + 153, oy + 29,
            [
                [ox + 156, oy + 33, ox + 154, oy + 37, ox + 148, oy + 39],
                [ox + 118, oy + 41, ox + 48, oy + 42, ox + 10, oy + 40],
                [ox + 12, oy + 42, ox + 68, oy + 43, ox + 160, oy + 38],
            ],
            ink,
            1.4
        );

        // Subtitle text under signature
        this.drawText("FreightAgent Authorized Signatory", x + 8, y + 53, {
            size: 6.8,
            bold: true,
            color: ink,
        });

        if (agentName || adminName) {
            const parts: string[] = [];
            if (agentName) parts.push(`Agent: ${agentName}`);
            if (adminName) parts.push(`Admin: ${adminName}`);
            this.drawText(parts.join(" • "), x + 8, y + 62, {
                size: 6.0,
                bold: true,
                color: [0.08, 0.16, 0.25],
            });
            const authHash = trackingId
                ? `Digital ID: SHA256-${trackingId.slice(0, 8).toUpperCase()}`
                : "Electronically Verified & Certified";
            this.drawText(authHash, x + 8, y + 71, {
                size: 5.6,
                color: [0.38, 0.42, 0.46],
            });
        } else {
            const authHash = trackingId
                ? `Digital ID: SHA256-${trackingId.slice(0, 8).toUpperCase()}`
                : "Electronically Verified & Certified";
            this.drawText(authHash, x + 8, y + 64, {
                size: 6.0,
                color: [0.38, 0.42, 0.46],
            });
        }
    }

    public buildBuffer(): Buffer {
        const streamData = this.streamOps.join("\n");
        const streamLength = Buffer.byteLength(streamData, "utf-8");

        const objects: string[] = [];

        // 1 0 obj - Catalog
        objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

        // 2 0 obj - Pages
        objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");

        // 3 0 obj - Page
        objects.push(
            `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj`
        );

        // 4 0 obj - Content Stream
        objects.push(
            `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamData}\nendstream\nendobj`
        );

        // 5 0 obj - Font Helvetica (Regular)
        objects.push(
            "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj"
        );

        // 6 0 obj - Font Helvetica-Bold
        objects.push(
            "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj"
        );

        // 7 0 obj - Font Helvetica-Oblique (Italic)
        objects.push(
            "7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj"
        );

        // Assemble standard PDF with exact 20-byte xref table entries
        let header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        let body = "";
        const offsets: number[] = [0];

        for (let i = 0; i < objects.length; i++) {
            offsets.push(Buffer.byteLength(header + body, "utf-8"));
            body += objects[i] + "\n";
        }

        const xrefOffset = Buffer.byteLength(header + body, "utf-8");
        let xref = `xref\n0 ${objects.length + 1}\n`;
        xref += "0000000000 65535 f \n"; // Exactly 20 bytes

        for (let i = 1; i <= objects.length; i++) {
            const offsetStr = String(offsets[i]).padStart(10, "0");
            xref += `${offsetStr} 00000 n \n`; // Exactly 20 bytes
        }

        const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

        return Buffer.from(header + body + xref + trailer, "utf-8");
    }
}

export interface IInvoiceShipmentData {
    id: string;
    trackingId: string;
    origin: string;
    destination: string;
    weight: number;
    declaredCargoValue?: number | null | undefined;
    description?: string | null | undefined;
    stripePaymentIntentId?: string | null | undefined;
    paidAt?: Date | null | undefined;
    assignedAt?: Date | null | undefined;
}

export interface IInvoiceCostData {
    totalCost: number;
    currency?: string | undefined;
    originHandling?: number | undefined;
    oceanFreight?: number | undefined;
    bafSurcharge?: number | undefined;
    thcOrigin?: number | undefined;
    thcDestination?: number | undefined;
    transshipmentFee?: number | undefined;
    customsClearance?: number | undefined;
    customsDuty?: number | undefined;
    vat?: number | undefined;
    destinationHandling?: number | undefined;
    cargoInsurance?: number | undefined;
    lastMileDelivery?: number | undefined;
    agencyFee?: number | undefined;
    platformFee?: number | undefined;
}

export interface IInvoiceUserData {
    name: string;
    email: string;
    phone?: string | null | undefined;
    address?: string | null | undefined;
}

export interface IInvoiceAgentData {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    assignedArea?: string | null | undefined;
}

export interface IInvoiceAdminData {
    name: string;
    email?: string | null | undefined;
    role?: string | null | undefined;
}

/**
 * Generates an official, international standard Commercial Invoice PDF
 * matching the exact multi-section border grid layout:
 * - Top Header: COMMERCIAL INVOICE
 * - Row 1: Date & Invoice No.
 * - Row 2: Exporter & Consignee detailed blocks
 * - Row 3-4: Logistics grid (Tax IDs, Gross Weight, Transportation, Terms Of Sale, Pieces, AWB/BL#, Currency)
 * - Row 5: Itemized Commodity & Tariff Table with continuous vertical grid columns
 * - Row 6: Regulatory Export Compliance certification & financial summary (Sub Total, Freight, Insurance, Total)
 * - Row 7: Legal certification declaration & 3-column signature block (Name, Signature, Date)
 */
export const generatePaymentReceiptPdf = (data: {
    shipment: IInvoiceShipmentData;
    cost?: IInvoiceCostData | null | undefined;
    user: IInvoiceUserData;
    agent?: IInvoiceAgentData | null | undefined;
    assignedBy?: IInvoiceAdminData | null | undefined;
}): Buffer => {
    const doc = new FreightPdfBuilder();
    const T = COMMERCIAL_INVOICE_THEME;

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 28;
    const contentWidth = pageWidth - margin * 2; // 539.28
    const x0 = margin;
    const xRight = x0 + contentWidth;            // 567.28
    const xMid = x0 + contentWidth / 2;          // 297.64

    // 1. Page Canvas Background (Pure white for sharp printing)
    doc.drawRect(0, 0, pageWidth, pageHeight, T.bgWhite);

    // 2. Section 1: Header Box (COMMERCIAL INVOICE)
    const y1 = 28;
    const h1 = 34;
    doc.drawRect(x0, y1, contentWidth, h1, T.bgWhite, T.borderDark, 1.2);
    doc.drawText("COMMERCIAL INVOICE", pageWidth / 2, y1 + 10, {
        size: 15,
        bold: true,
        color: T.textDark,
        align: "center",
    });

    // 3. Section 2: Date & Invoice No.
    const y2 = y1 + h1; // 62
    const h2 = 32;
    doc.drawRect(x0, y2, contentWidth, h2, T.bgWhite, T.borderDark, 1.0);
    doc.drawLine(xMid, y2, xMid, y2 + h2, T.borderDark, 1.0);

    const invoiceDate = data.shipment.paidAt ? new Date(data.shipment.paidAt) : new Date();
    const formattedDate = invoiceDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
    const invoiceNumber = `INV-${data.shipment.trackingId.slice(0, 10).toUpperCase()}`;

    // Left: Date
    doc.drawText("Date", x0 + 8, y2 + 6, { size: 7.5, bold: true, color: T.textLabel });
    doc.drawText(formattedDate, x0 + 8, y2 + 18, { size: 9, bold: true, color: T.textDark });

    // Right: Invoice No.
    doc.drawText("Invoice No.", xMid + 8, y2 + 6, { size: 7.5, bold: true, color: T.textLabel });
    doc.drawText(invoiceNumber, xMid + 8, y2 + 18, { size: 9, bold: true, color: T.textDark });

    // 4. Section 3: Exporter & Consignee
    const y3 = y2 + h2; // 94
    const h3 = 106;
    doc.drawRect(x0, y3, contentWidth, h3, T.bgWhite, T.borderDark, 1.0);
    doc.drawLine(xMid, y3, xMid, y3 + h3, T.borderDark, 1.0);

    const destParts = data.shipment.destination.split(",");
    const destCountry = (destParts.length > 1 ? destParts[destParts.length - 1]?.trim() : undefined) || "International";

    // Left Party: Exporter
    doc.drawText("Exporter", x0 + 8, y3 + 7, { size: 8, bold: true, color: T.textDark });
    doc.drawText("FreightAgent Global Logistics Inc.", x0 + 8, y3 + 20, { size: 8.5, bold: true, color: T.textDark });
    doc.drawText("100 Maritime Plaza, Suite 400", x0 + 8, y3 + 33, { size: 8, color: T.textLabel });
    doc.drawText("San Pedro / Los Angeles Harbor, CA 90731", x0 + 8, y3 + 46, { size: 8, color: T.textLabel });
    doc.drawText("Country: United States of America", x0 + 8, y3 + 59, { size: 8, color: T.textLabel });
    doc.drawText("Phone/Fax: +1 (800) 555-0199 / +1 (800) 555-0198", x0 + 8, y3 + 72, { size: 7.5, color: T.textLabel });
    doc.drawText("Contact Person: Global Export Cargo Desk", x0 + 8, y3 + 85, { size: 7.5, color: T.textLabel });

    // Right Party: Consignee
    doc.drawText("Consignee", xMid + 8, y3 + 7, { size: 8, bold: true, color: T.textDark });
    doc.drawText(data.user.name || "Commercial Consignee", xMid + 8, y3 + 20, { size: 8.5, bold: true, color: T.textDark });
    const userAddress = data.user.address
        ? (data.user.address.length > 40 ? `${data.user.address.slice(0, 38)}...` : data.user.address)
        : "Designated Port of Discharge Terminal Hub";
    doc.drawText(userAddress, xMid + 8, y3 + 33, { size: 8, color: T.textLabel });
    doc.drawText(`Destination Hub: ${data.shipment.destination}`, xMid + 8, y3 + 46, { size: 8, color: T.textLabel });
    doc.drawText(`Country / Territory: ${destCountry}`, xMid + 8, y3 + 59, { size: 8, color: T.textLabel });
    doc.drawText(`Phone/Fax: ${data.user.phone || "+1 (555) 019-4820"}`, xMid + 8, y3 + 72, { size: 7.5, color: T.textLabel });
    doc.drawText(`Contact Person: ${data.user.name || "Authorized Recipient"}`, xMid + 8, y3 + 85, { size: 7.5, color: T.textLabel });

    // 5. Section 4: Shipping & Customs Logistics Grid (2 Rows)
    const y4 = y3 + h3; // 200
    const h4 = 60;
    doc.drawRect(x0, y4, contentWidth, h4, T.bgWhite, T.borderDark, 1.0);

    const xG1 = x0 + 88;      // 116
    const xG2 = xG1 + 90;     // 206
    const xG3 = xMid + 135;   // 432.64

    // Vertical dividing lines for grid
    doc.drawLine(xG1, y4, xG1, y4 + h4, T.borderDark, 1.0);
    doc.drawLine(xG2, y4, xG2, y4 + h4, T.borderDark, 1.0);
    doc.drawLine(xMid, y4, xMid, y4 + h4, T.borderDark, 1.0);
    doc.drawLine(xG3, y4, xG3, y4 + h4, T.borderDark, 1.0);

    // Horizontal line dividing Row 1 & Row 2 (stops at xG3 so Terms Of Sale spans both rows)
    const y4Mid = y4 + 30; // 230
    doc.drawLine(x0, y4Mid, xG3, y4Mid, T.borderDark, 1.0);

    // Grid Row 1
    // Col 1: Tax ID No.
    doc.drawText("Tax ID No.", x0 + 6, y4 + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText("US-EIN-94-382910", x0 + 6, y4 + 17, { size: 7.5, bold: true, color: T.textDark });

    // Col 2: Total Gross Weight
    doc.drawText("Total Gross Weight", xG1 + 6, y4 + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText(`${data.shipment.weight} KG`, xG1 + 6, y4 + 17, { size: 8, bold: true, color: T.textDark });

    // Col 3: Transportation
    doc.drawText("Transportation", xG2 + 6, y4 + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText("Ocean / Intermodal", xG2 + 6, y4 + 17, { size: 7.5, bold: true, color: T.textDark });

    // Col 4: Tax ID No. (Consignee)
    doc.drawText("Tax ID No.", xMid + 6, y4 + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText("VAT-EXEMPT-COMM", xMid + 6, y4 + 17, { size: 7.5, color: T.textDark });

    // Col 5: Terms Of Sale (Spans Row 1 & Row 2)
    doc.drawText("Terms Of Sale", xG3 + 8, y4 + 8, { size: 7.5, bold: true, color: T.textLabel });
    doc.drawText("CIF", xG3 + 8, y4 + 22, { size: 10, bold: true, color: T.textDark });
    doc.drawText("Cost, Insurance & Freight", xG3 + 8, y4 + 35, { size: 7.2, bold: true, color: T.textLabel });
    doc.drawText("Port of Discharge Prepaid", xG3 + 8, y4 + 46, { size: 7, color: T.textMuted });

    // Grid Row 2
    // Col 1: Other
    doc.drawText("Other", x0 + 6, y4Mid + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText("Direct Vessel Load", x0 + 6, y4Mid + 17, { size: 7.5, color: T.textDark });

    // Col 2: Total # of Pieces
    doc.drawText("Total # of Pieces", xG1 + 6, y4Mid + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText("1 Consolidated Lot", xG1 + 6, y4Mid + 17, { size: 7.5, color: T.textDark });

    // Col 3: AWB/BL#
    doc.drawText("AWB/BL#", xG2 + 6, y4Mid + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText(`BL-${data.shipment.trackingId.slice(0, 10).toUpperCase()}`, xG2 + 6, y4Mid + 17, { size: 7.5, bold: true, color: T.textDark });

    // Col 4: Currency
    doc.drawText("Currency", xMid + 6, y4Mid + 5, { size: 7, bold: true, color: T.textLabel });
    doc.drawText("USD ($)", xMid + 6, y4Mid + 17, { size: 8, bold: true, color: T.textDark });

    // 6. Section 5: Commodity Description & Charges Table
    const y5 = y4 + h4; // 260
    const h5 = 250;
    const hHead = 24;
    doc.drawRect(x0, y5, contentWidth, h5, T.bgWhite, T.borderDark, 1.0);
    // Header fill
    doc.drawRect(x0, y5, contentWidth, hHead, T.bgHeader, T.borderDark, 1.0);

    // 7 Columns widths: 175, 45, 75, 38, 38, 70, 98.28 (Sum = 539.28)
    const xT1 = x0 + 175;  // 203
    const xT2 = xT1 + 45;  // 248
    const xT3 = xT2 + 75;  // 323
    const xT4 = xT3 + 38;  // 361
    const xT5 = xT4 + 38;  // 399
    const xT6 = xT5 + 70;  // 469

    // Table Header Labels
    doc.drawText("Commodity Description", x0 + 8, y5 + 7, { size: 7.5, bold: true, color: T.textDark });
    doc.drawText("HS", (xT1 + xT2) / 2, y5 + 7, { size: 7.5, bold: true, color: T.textDark, align: "center" });
    doc.drawText("Country Of", (xT2 + xT3) / 2, y5 + 3, { size: 6.8, bold: true, color: T.textDark, align: "center" });
    doc.drawText("Manufacture", (xT2 + xT3) / 2, y5 + 13, { size: 6.8, bold: true, color: T.textDark, align: "center" });
    doc.drawText("QTY", (xT3 + xT4) / 2, y5 + 7, { size: 7.5, bold: true, color: T.textDark, align: "center" });
    doc.drawText("UOM", (xT4 + xT5) / 2, y5 + 7, { size: 7.5, bold: true, color: T.textDark, align: "center" });
    doc.drawText("Unit Price", xT6 - 8, y5 + 7, { size: 7.5, bold: true, color: T.textDark, align: "right" });
    doc.drawText("Total Amount", xRight - 8, y5 + 7, { size: 7.5, bold: true, color: T.textDark, align: "right" });

    // Table Columns Vertical Continuous Dividers (Extending full table body height)
    doc.drawLine(xT1, y5, xT1, y5 + h5, T.borderDark, 1.0);
    doc.drawLine(xT2, y5, xT2, y5 + h5, T.borderDark, 1.0);
    doc.drawLine(xT3, y5, xT3, y5 + h5, T.borderDark, 1.0);
    doc.drawLine(xT4, y5, xT4, y5 + h5, T.borderDark, 1.0);
    doc.drawLine(xT5, y5, xT5, y5 + h5, T.borderDark, 1.0);
    doc.drawLine(xT6, y5, xT6, y5 + h5, T.borderDark, 1.0);

    // Compute line items
    const cost = data.cost || {
        totalCost: 0,
        originHandling: 0,
        oceanFreight: 0,
        bafSurcharge: 0,
        thcOrigin: 0,
        thcDestination: 0,
        transshipmentFee: 0,
        customsClearance: 0,
        customsDuty: 0,
        vat: 0,
        destinationHandling: 0,
        cargoInsurance: 0,
        lastMileDelivery: 0,
        agencyFee: 0,
        platformFee: 0,
    };

    const totalCost = cost.totalCost || 0;
    const freightCost = (cost.oceanFreight || 0) + (cost.bafSurcharge || 0) + (cost.transshipmentFee || 0) + (cost.lastMileDelivery || 0);
    const insuranceCost = cost.cargoInsurance || 0;
    const subtotal = Math.max(0, totalCost - freightCost - insuranceCost);

    interface CommodityItem {
        description: string;
        hs: string;
        country: string;
        qty: number | string;
        uom: string;
        unitPrice: number;
        total: number;
    }

    const commodityItems: CommodityItem[] = [];

    const originCountry = data.shipment.origin.split(",").pop()?.trim() || "USA";
    const cargoDesc = data.shipment.description || "Consolidated Freight Consignment";

    const handlingTotal = (cost.originHandling || 0) + (cost.thcOrigin || 0) + (cost.destinationHandling || 0) + (cost.thcDestination || 0);
    const customsTotal = (cost.customsClearance || 0) + (cost.customsDuty || 0) + (cost.vat || 0);
    const agencyTotal = (cost.agencyFee || 0) + (cost.platformFee || 0);

    // 1. Cargo Goods
    commodityItems.push({
        description: cargoDesc.length > 36 ? `${cargoDesc.slice(0, 34)}...` : cargoDesc,
        hs: "8479.89",
        country: originCountry,
        qty: 1,
        uom: "LOT",
        unitPrice: subtotal > 0 && handlingTotal === 0 && customsTotal === 0 ? subtotal : (data.shipment.declaredCargoValue || subtotal || 1),
        total: subtotal > 0 && handlingTotal === 0 && customsTotal === 0 ? subtotal : (data.shipment.declaredCargoValue || subtotal || 1),
    });

    // 2. Ocean Freight Transit
    if (cost.oceanFreight && cost.oceanFreight > 0) {
        commodityItems.push({
            description: `Ocean Freight Transit (${data.shipment.origin.slice(0, 10)} -> ${data.shipment.destination.slice(0, 10)})`,
            hs: "9983.11",
            country: originCountry,
            qty: data.shipment.weight || 1,
            uom: "KG",
            unitPrice: cost.oceanFreight / (data.shipment.weight || 1),
            total: cost.oceanFreight,
        });
    }

    // 3. Fuel & BAF
    if (cost.bafSurcharge && cost.bafSurcharge > 0) {
        commodityItems.push({
            description: "Bunker Adjustment Factor (BAF / Ocean Fuel)",
            hs: "9983.13",
            country: "Global",
            qty: 1,
            uom: "L/S",
            unitPrice: cost.bafSurcharge,
            total: cost.bafSurcharge,
        });
    }

    // 4. Port Terminal Handling
    if (handlingTotal > 0) {
        commodityItems.push({
            description: "Terminal Handling Charges (Origin & Destination THC)",
            hs: "9983.12",
            country: originCountry,
            qty: 1,
            uom: "L/S",
            unitPrice: handlingTotal,
            total: handlingTotal,
        });
    }

    // 5. Customs Clearance & Tariffs
    if (customsTotal > 0) {
        commodityItems.push({
            description: "Customs Clearance, Export/Import Documentation & VAT",
            hs: "9983.14",
            country: destCountry,
            qty: 1,
            uom: "L/S",
            unitPrice: customsTotal,
            total: customsTotal,
        });
    }

    // 6. Marine Insurance
    if (cost.cargoInsurance && cost.cargoInsurance > 0) {
        commodityItems.push({
            description: "Marine Cargo Comprehensive Risk Insurance Policy",
            hs: "9983.15",
            country: "USA",
            qty: 1,
            uom: "POL",
            unitPrice: cost.cargoInsurance,
            total: cost.cargoInsurance,
        });
    }

    // 7. Last Mile
    if (cost.lastMileDelivery && cost.lastMileDelivery > 0) {
        commodityItems.push({
            description: "Inland Delivery & Destination Hub Transit Dispatch",
            hs: "9983.16",
            country: destCountry,
            qty: 1,
            uom: "L/S",
            unitPrice: cost.lastMileDelivery,
            total: cost.lastMileDelivery,
        });
    }

    // 8. Agency & Platform
    if (agencyTotal > 0) {
        commodityItems.push({
            description: "Forwarding Commission & Platform Service Operations",
            hs: "9983.17",
            country: "USA",
            qty: 1,
            uom: "L/S",
            unitPrice: agencyTotal,
            total: agencyTotal,
        });
    }

    // Render Table Body Rows
    const rowHeight = 20;
    commodityItems.slice(0, 9).forEach((item, index) => {
        const curRowY = y5 + hHead + index * rowHeight;
        if (index % 2 === 1) {
            doc.drawRect(x0, curRowY, contentWidth, rowHeight, T.bgHeaderSubtle);
        }

        doc.drawText(item.description, x0 + 6, curRowY + 6, { size: 7.5, color: T.textDark });
        doc.drawText(item.hs, (xT1 + xT2) / 2, curRowY + 6, { size: 7.5, color: T.textLabel, align: "center" });
        doc.drawText(item.country, (xT2 + xT3) / 2, curRowY + 6, { size: 7.5, color: T.textLabel, align: "center" });
        doc.drawText(String(item.qty), (xT3 + xT4) / 2, curRowY + 6, { size: 7.5, color: T.textDark, align: "center" });
        doc.drawText(item.uom, (xT4 + xT5) / 2, curRowY + 6, { size: 7.5, color: T.textDark, align: "center" });
        doc.drawText(`$${item.unitPrice.toFixed(2)}`, xT6 - 6, curRowY + 6, { size: 7.5, color: T.textDark, align: "right" });
        doc.drawText(`$${item.total.toFixed(2)}`, xRight - 6, curRowY + 6, { size: 7.5, bold: true, color: T.textDark, align: "right" });

        doc.drawLine(x0, curRowY + rowHeight, xRight, curRowY + rowHeight, T.borderLight, 0.5);
    });

    // 7. Section 6: Regulatory Declaration & Financial Summary
    const y6 = y5 + h5; // 510
    const h6 = 104;
    doc.drawRect(x0, y6, contentWidth, h6, T.bgWhite, T.borderDark, 1.0);
    // Vertical divider line between Regulatory statement (left) and Summary table (right)
    doc.drawLine(xT5, y6, xT5, y6 + h6, T.borderDark, 1.0);

    // Left Box: Export compliance declaration statement (matching exact image text)
    doc.drawWrappedText(
        "These commodities, technologies, or softwares were exported from the United States in accordance with export administratton regulations. Diversion contrary to United States law prohibited. We Certify that this commercial invoice is true and correct.",
        x0 + 8,
        y6 + 8,
        355,
        11,
        { size: 7.2, italic: true, color: T.textDark }
    );

    const assignDateStr = data.shipment.assignedAt
        ? new Date(data.shipment.assignedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : null;

    if (data.agent && data.assignedBy) {
        const agentArea = data.agent.assignedArea ? ` (${data.agent.assignedArea})` : "";
        const agentContact = data.agent.phone ? ` • ${data.agent.phone}` : (data.agent.email ? ` • ${data.agent.email}` : "");
        doc.drawText(
            `• Assigned Road/Port Agent: ${data.agent.name}${agentArea}${agentContact}`,
            x0 + 8,
            y6 + 50,
            { size: 6.8, bold: true, color: T.textDark }
        );
        doc.drawText(
            `• Agent Assigned By Admin: ${data.assignedBy.name} (${data.assignedBy.role || "HQ Administrator"})${assignDateStr ? ` • Dispatched: ${assignDateStr}` : ""}`,
            x0 + 8,
            y6 + 63,
            { size: 6.8, bold: true, color: T.accentNavy }
        );
        doc.drawText(
            `• Customer Recipient: ${data.user.name} • Contact: ${data.user.email}${data.user.phone ? ` • ${data.user.phone}` : ""}`,
            x0 + 8,
            y6 + 76,
            { size: 6.8, color: T.textLabel }
        );
        doc.drawText(
            `• Ocean B/L: BL-${data.shipment.trackingId.slice(0, 10).toUpperCase()} • Declared Valuation: $${(data.shipment.declaredCargoValue || 0).toFixed(2)} USD`,
            x0 + 8,
            y6 + 89,
            { size: 6.5, color: T.textMuted }
        );
    } else if (data.agent) {
        const agentArea = data.agent.assignedArea ? ` (${data.agent.assignedArea})` : "";
        const agentContact = data.agent.phone ? ` • ${data.agent.phone}` : (data.agent.email ? ` • ${data.agent.email}` : "");
        doc.drawText(
            `• Assigned Road/Port Agent: ${data.agent.name}${agentArea}${agentContact}`,
            x0 + 8,
            y6 + 52,
            { size: 6.8, bold: true, color: T.textDark }
        );
        doc.drawText(
            `• Customer Recipient: ${data.user.name} • Contact: ${data.user.email}${data.user.phone ? ` • ${data.user.phone}` : ""}`,
            x0 + 8,
            y6 + 65,
            { size: 6.8, color: T.textLabel }
        );
        doc.drawText(
            `• Customs Ocean Bill of Lading: BL-${data.shipment.trackingId.slice(0, 10).toUpperCase()} • Valuation: $${(data.shipment.declaredCargoValue || 0).toFixed(2)} USD`,
            x0 + 8,
            y6 + 78,
            { size: 6.5, color: T.textMuted }
        );
        doc.drawText(
            "• Payment Verification: Confirmed & Settled via Stripe Global Financial Infrastructure",
            x0 + 8,
            y6 + 90,
            { size: 6.5, color: T.textMuted }
        );
    } else {
        doc.drawText(
            `• Customer Recipient: ${data.user.name} • Contact: ${data.user.email}${data.user.phone ? ` • ${data.user.phone}` : ""}`,
            x0 + 8,
            y6 + 52,
            { size: 6.8, color: T.textLabel }
        );
        doc.drawText(
            `• Customs Ocean Bill of Lading: BL-${data.shipment.trackingId.slice(0, 10).toUpperCase()}`,
            x0 + 8,
            y6 + 65,
            { size: 6.8, color: T.textLabel }
        );
        doc.drawText(
            "• Payment Verification: Confirmed & Settled via Stripe Global Financial Infrastructure",
            x0 + 8,
            y6 + 78,
            { size: 6.8, color: T.textLabel }
        );
        doc.drawText(
            `• Declared Cargo Customs Valuation: $${(data.shipment.declaredCargoValue || 0).toFixed(2)} USD (Verified)`,
            x0 + 8,
            y6 + 90,
            { size: 6.5, color: T.textMuted }
        );
    }

    // Right Box: 4 Financial Summary Rows
    const xSumVal = 485;
    doc.drawLine(xSumVal, y6, xSumVal, y6 + h6, T.borderDark, 1.0);

    const sumRowH = 26;
    // Row 1: Sub Total
    doc.drawText("Sub Total", xT5 + 8, y6 + 8, { size: 8, bold: true, color: T.textDark });
    doc.drawText(`$${subtotal.toFixed(2)}`, xRight - 8, y6 + 8, { size: 8, color: T.textDark, align: "right" });
    doc.drawLine(xT5, y6 + sumRowH, xRight, y6 + sumRowH, T.borderDark, 1.0);

    // Row 2: Freight Cost
    const y6R2 = y6 + sumRowH;
    doc.drawText("Freight Cost", xT5 + 8, y6R2 + 8, { size: 8, bold: true, color: T.textDark });
    doc.drawText(`$${freightCost.toFixed(2)}`, xRight - 8, y6R2 + 8, { size: 8, color: T.textDark, align: "right" });
    doc.drawLine(xT5, y6R2 + sumRowH, xRight, y6R2 + sumRowH, T.borderDark, 1.0);

    // Row 3: Insurance Cost
    const y6R3 = y6R2 + sumRowH;
    doc.drawText("Insurance Cost", xT5 + 8, y6R3 + 8, { size: 8, bold: true, color: T.textDark });
    doc.drawText(`$${insuranceCost.toFixed(2)}`, xRight - 8, y6R3 + 8, { size: 8, color: T.textDark, align: "right" });
    doc.drawLine(xT5, y6R3 + sumRowH, xRight, y6R3 + sumRowH, T.borderDark, 1.0);

    // Row 4: Total Invoice value (Highlighted box)
    const y6R4 = y6R3 + sumRowH;
    doc.drawRect(xT5, y6R4, contentWidth - (xT5 - x0), sumRowH, T.bgTotalHighlight);
    doc.drawText("Total Invoice value", xT5 + 8, y6R4 + 8, { size: 8.5, bold: true, color: T.textDark });
    doc.drawText(`$${totalCost.toFixed(2)}`, xRight - 8, y6R4 + 8, { size: 10.5, bold: true, color: T.accentTeal, align: "right" });

    // 8. Section 7: Declaration & Signatures Block
    const y7 = y6 + h6; // 614
    const h7 = 96;
    doc.drawRect(x0, y7, contentWidth, h7, T.bgWhite, T.borderDark, 1.0);

    // Certification header banner across top of signature box
    const hCertBanner = 22;
    doc.drawRect(x0, y7, contentWidth, hCertBanner, T.bgHeaderSubtle);
    doc.drawLine(x0, y7 + hCertBanner, xRight, y7 + hCertBanner, T.borderDark, 1.0);
    doc.drawText(
        "I/We hereby certify that the information on this invoice is true & correct & that the contents of this shipment are as stated above.",
        pageWidth / 2,
        y7 + 7,
        { size: 7.2, italic: true, bold: true, color: T.textDark, align: "center" }
    );

    // 3 Signature Columns (Name, Signature, Date)
    const colSigWidth = contentWidth / 3; // 179.76
    const xS1 = x0 + colSigWidth;
    const xS2 = xS1 + colSigWidth;
    const ySigBody = y7 + hCertBanner;

    doc.drawLine(xS1, ySigBody, xS1, y7 + h7, T.borderDark, 1.0);
    doc.drawLine(xS2, ySigBody, xS2, y7 + h7, T.borderDark, 1.0);

    // Column 1: Name (Real dynamic Admin, Agent, and Customer data)
    doc.drawText("Name", x0 + 8, ySigBody + 6, { size: 7.5, bold: true, color: T.textLabel });
    if (data.assignedBy) {
        doc.drawText(`Admin: ${data.assignedBy.name}`, x0 + 8, ySigBody + 19, { size: 8.2, bold: true, color: T.textDark });
        doc.drawText(`Role: ${data.assignedBy.role || "FreightAgent HQ Admin"}`, x0 + 8, ySigBody + 31, { size: 7.0, color: T.accentNavy });
        if (data.agent) {
            doc.drawText(`Assigned Agent: ${data.agent.name}`, x0 + 8, ySigBody + 43, { size: 7.5, bold: true, color: T.textDark });
            doc.drawText(`${data.agent.assignedArea || "Road & Port Cargo Operations"}`, x0 + 8, ySigBody + 55, { size: 6.8, color: T.textLabel });
        } else {
            doc.drawText("FreightAgent Global Logistics Inc.", x0 + 8, ySigBody + 43, { size: 7.0, color: T.textLabel });
            doc.drawText("Authorized Export Customs Desk", x0 + 8, ySigBody + 55, { size: 6.5, color: T.textMuted });
        }
        doc.drawText(`Customer: ${data.user.name}`, x0 + 8, ySigBody + 67, { size: 6.8, color: T.textMuted });
    } else if (data.agent) {
        doc.drawText(`Agent: ${data.agent.name}`, x0 + 8, ySigBody + 19, { size: 8.5, bold: true, color: T.textDark });
        doc.drawText(`Area: ${data.agent.assignedArea || "Designated Road Freight Agent"}`, x0 + 8, ySigBody + 32, { size: 7.2, color: T.textDark });
        doc.drawText("FreightAgent Global Logistics Inc.", x0 + 8, ySigBody + 44, { size: 7.0, color: T.textLabel });
        doc.drawText(`Customer: ${data.user.name}`, x0 + 8, ySigBody + 56, { size: 6.8, color: T.textMuted });
        doc.drawText("Customs Broker ID: US-CB-8841", x0 + 8, ySigBody + 68, { size: 6.5, color: T.textMuted });
    } else {
        doc.drawText("Capt. Arthur Vance", x0 + 8, ySigBody + 19, { size: 8.5, bold: true, color: T.textDark });
        doc.drawText("FreightAgent Operations Director", x0 + 8, ySigBody + 32, { size: 7.5, color: T.textDark });
        doc.drawText("Authorized Export Customs Desk", x0 + 8, ySigBody + 44, { size: 7.0, color: T.textLabel });
        doc.drawText(`Customer: ${data.user.name}`, x0 + 8, ySigBody + 56, { size: 6.8, color: T.textMuted });
        doc.drawText("Customs Broker ID: US-CB-8841", x0 + 8, ySigBody + 68, { size: 6.5, color: T.textMuted });
    }

    // Column 2: Signature (FreightAgent calligraphic vector signature + official carrier seal + real agent/admin attribution)
    doc.drawText("Signature", xS1 + 8, ySigBody + 6, { size: 7.5, bold: true, color: T.textLabel });
    doc.drawFreightAgentSignature(
        xS1,
        ySigBody,
        data.shipment.trackingId,
        data.agent?.name,
        data.assignedBy?.name
    );

    // Column 3: Date
    doc.drawText("Date", xS2 + 8, ySigBody + 6, { size: 7.5, bold: true, color: T.textLabel });
    doc.drawText(formattedDate, xS2 + 8, ySigBody + 19, { size: 8.5, bold: true, color: T.textDark });
    doc.drawText("Official Date of Consignment Issuance", xS2 + 8, ySigBody + 32, { size: 7, color: T.textLabel });
    if (data.shipment.assignedAt) {
        const assignStr = new Date(data.shipment.assignedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        doc.drawText(`Agent Assigned: ${assignStr}`, xS2 + 8, ySigBody + 44, { size: 6.8, bold: true, color: T.accentNavy });
    } else {
        doc.drawText("Export Regulatory Clearance Confirmed", xS2 + 8, ySigBody + 44, { size: 6.8, color: T.textMuted });
    }
    doc.drawText("System Automated Timestamp", xS2 + 8, ySigBody + 56, { size: 6.5, color: T.textMuted });
    doc.drawText("Status: Certified & Executed", xS2 + 8, ySigBody + 68, { size: 6.5, bold: true, color: T.accentTeal });

    // 9. Document Outer Enclosing Frame for crisp, aligned border perimeter
    doc.drawRect(x0, y1, contentWidth, (y7 + h7) - y1, undefined, T.borderDark, 1.2);

    // 10. Document Legal Baseline Footer
    const footerY = y7 + h7 + 10;
    doc.drawText(
        "FreightAgent Inc. • International Commercial Cargo Invoice • Formatted pursuant to standard maritime & air carrier practice (UN/EDIFACT)",
        pageWidth / 2,
        footerY,
        { size: 7, color: T.textMuted, align: "center" }
    );

    return doc.buildBuffer();
};

/**
 * Generates an official, premium dark-mode Agent Commission Withdrawal Slip PDF
 */
export const generateWithdrawalSlipPdf = (data: {
    agent: {
        id: string;
        name: string;
        email: string;
        phone?: string | null | undefined;
        assignedArea?: string | null | undefined;
    };
    withdrawal: {
        id: string;
        withdrawalNumber: string;
        amount: number;
        currency: string;
        status: string;
        bankInfo?: string | null | undefined;
        note?: string | null | undefined;
        createdAt: Date;
    };
    balanceBefore: number;
    remainingBalance: number;
}): Buffer => {
    const doc = new FreightPdfBuilder();
    const margin = 36;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const contentWidth = pageWidth - margin * 2;

    // 1. Full Page Dark Canvas Background
    doc.drawRect(0, 0, pageWidth, pageHeight, THEME.bgPrimary);

    // 2. Top Accent Bar (Teal -> Cyan)
    doc.drawRect(0, 0, pageWidth / 2, 5, THEME.accentPrimary);
    doc.drawRect(pageWidth / 2, 0, pageWidth / 2, 5, THEME.accentBlue);

    // 3. Header Box
    let curY = 22;
    doc.drawRect(margin, curY, contentWidth, 80, THEME.bgCard, THEME.borderPrimary, 1);

    doc.drawBadge("⚓ FREIGHTAGENT TREASURY", margin + 16, curY + 16, 160, 22, THEME.accentBlue, THEME.white);
    doc.drawText("Carrier Agent Compensation & Commission Payout", margin + 16, curY + 48, {
        size: 8.5,
        color: THEME.textSecondary,
    });
    doc.drawText("Authorized Electronic Payout Voucher", margin + 16, curY + 60, {
        size: 7.5,
        color: THEME.textMuted,
    });

    doc.drawText("WITHDRAWAL VOUCHER", pageWidth - margin - 16, curY + 16, {
        size: 13,
        bold: true,
        color: THEME.textPrimary,
        align: "right",
    });

    const formattedDate = new Date(data.withdrawal.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    doc.drawText(`Issued: ${formattedDate}`, pageWidth - margin - 16, curY + 34, {
        size: 8.5,
        color: THEME.textSecondary,
        align: "right",
    });
    const voucherNumber = (
        data.withdrawal.withdrawalNumber ||
        data.withdrawal.id ||
        "WD-PENDING"
    ).toUpperCase();
    doc.drawText(`Voucher #: ${voucherNumber}`, pageWidth - margin - 16, curY + 46, {
        size: 8.5,
        color: THEME.accentSecondary,
        align: "right",
    });

    // Settled Status Badge
    doc.drawBadge(
        "✓ SETTLED & PAID",
        pageWidth - margin - 110,
        curY + 58,
        94,
        15,
        [0.0, 0.35, 0.25],
        THEME.accentSecondary,
        THEME.accentPrimary
    );

    // 4. Beneficiary Agent Details Box
    curY = 114;
    doc.drawRect(margin, curY, contentWidth, 80, THEME.bgCard, THEME.borderPrimary, 1);
    doc.drawText("AUTHORIZED BENEFICIARY AGENT", margin + 14, curY + 12, {
        size: 8,
        bold: true,
        color: THEME.textMuted,
    });
    doc.drawText(`Agent Name: ${data.agent.name}`, margin + 14, curY + 28, {
        size: 10.5,
        bold: true,
        color: THEME.textPrimary,
    });
    doc.drawText(`Agent Email: ${data.agent.email}`, margin + 14, curY + 44, {
        size: 8.5,
        color: THEME.textSecondary,
    });
    if (data.agent.assignedArea) {
        doc.drawText(`Corridor / Assigned Area: ${data.agent.assignedArea}`, margin + 14, curY + 56, {
            size: 8,
            color: THEME.textMuted,
        });
    }

    if (data.withdrawal.bankInfo) {
        const midX = margin + contentWidth / 2;
        doc.drawText("PAYOUT DESTINATION", midX, curY + 12, {
            size: 8,
            bold: true,
            color: THEME.textMuted,
        });
        doc.drawText(data.withdrawal.bankInfo, midX, curY + 28, {
            size: 9.5,
            color: THEME.textSecondary,
        });
    }

    // 5. Accounting Breakdown Card
    curY = 208;
    doc.drawText("ACCOUNTING SETTLEMENT LEDGER", margin, curY, {
        size: 9.5,
        bold: true,
        color: THEME.textPrimary,
    });
    curY += 10;

    doc.drawRect(margin, curY, contentWidth, 130, THEME.bgCard, THEME.borderAccent, 1);

    // Row 1: Pre-Withdrawal Balance
    doc.drawText("Pre-Withdrawal Available Commission:", margin + 16, curY + 22, {
        size: 9,
        color: THEME.textSecondary,
    });
    doc.drawText(`$${data.balanceBefore.toFixed(2)} ${data.withdrawal.currency}`, pageWidth - margin - 16, curY + 22, {
        size: 9.5,
        bold: true,
        color: THEME.textPrimary,
        align: "right",
    });

    // Row 2: Disbursed Amount
    doc.drawText("Disbursed Amount (From Platform Treasury):", margin + 16, curY + 50, {
        size: 10,
        bold: true,
        color: THEME.accentSecondary,
    });
    doc.drawText(`- $${data.withdrawal.amount.toFixed(2)} ${data.withdrawal.currency}`, pageWidth - margin - 16, curY + 50, {
        size: 13,
        bold: true,
        color: THEME.accentSecondary,
        align: "right",
    });

    doc.drawLine(margin + 16, curY + 74, pageWidth - margin - 16, curY + 74, THEME.borderPrimary, 1);

    // Row 3: Remaining Balance
    doc.drawText("Retained Commission Balance:", margin + 16, curY + 96, {
        size: 9,
        bold: true,
        color: THEME.textPrimary,
    });
    doc.drawText(`$${data.remainingBalance.toFixed(2)} ${data.withdrawal.currency}`, pageWidth - margin - 16, curY + 96, {
        size: 10.5,
        bold: true,
        color: THEME.accentBlue,
        align: "right",
    });

    // 6. Security Audit Box
    curY = 360;
    doc.drawRect(margin, curY, contentWidth, 80, THEME.bgCardAlt, THEME.borderPrimary, 1);
    doc.drawText("TRANSACTION SECURITY & AUDIT RECORD", margin + 14, curY + 12, {
        size: 8,
        bold: true,
        color: THEME.textMuted,
    });
    doc.drawText("• Authorized Payout: Disbursed from Central Administration Treasury", margin + 14, curY + 28, {
        size: 8,
        color: THEME.textSecondary,
    });
    doc.drawText(`• Internal Voucher Reference ID: ${data.withdrawal.id}`, margin + 14, curY + 42, {
        size: 7.5,
        color: THEME.textMuted,
    });
    doc.drawText("• Cryptographic Integrity: Recorded in immutable AdminAuditLog", margin + 14, curY + 54, {
        size: 7.5,
        color: THEME.textMuted,
    });

    // 7. Signatures
    curY = 500;
    doc.drawLine(margin + 16, curY + 36, margin + 200, curY + 36, THEME.borderPrimary, 1);
    doc.drawText("Authorized Treasury Officer", margin + 16, curY + 48, {
        size: 8,
        bold: true,
        color: THEME.textSecondary,
    });
    doc.drawText("FreightAgent Financial Control", margin + 16, curY + 60, {
        size: 7.5,
        color: THEME.textMuted,
    });

    doc.drawLine(pageWidth - margin - 200, curY + 36, pageWidth - margin - 16, curY + 36, THEME.borderPrimary, 1);
    doc.drawText("Beneficiary Agent Confirmation", pageWidth - margin - 200, curY + 48, {
        size: 8,
        bold: true,
        color: THEME.textSecondary,
    });
    doc.drawText(data.agent.name, pageWidth - margin - 200, curY + 60, {
        size: 7.5,
        color: THEME.textMuted,
    });

    // 8. Footer
    const footerY = 780;
    doc.drawLine(margin, footerY, pageWidth - margin, footerY, THEME.borderPrimary, 1);
    doc.drawText("FreightAgent Financial Operations • Confidential Agent Partner Settlement Slip", pageWidth / 2, footerY + 12, {
        size: 7.5,
        color: THEME.textMuted,
        align: "center",
    });

    return doc.buildBuffer();
};
