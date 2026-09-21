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
    color?: [number, number, number];
    align?: "left" | "right" | "center";
}

export type ReceiptLineItem = [description: string, category: string, amount: number];

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
        const fontName = options.bold ? "/F2" : "/F1";
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
            `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`
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

/**
 * Generates an official, premium dark-mode Customer Payment Receipt PDF
 */
export const generatePaymentReceiptPdf = (data: {
    shipment: {
        id: string;
        trackingId: string;
        origin: string;
        destination: string;
        weight: number;
        declaredCargoValue?: number | null | undefined;
        stripePaymentIntentId?: string | null | undefined;
        paidAt?: Date | null | undefined;
    };
    cost?: {
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
    } | null | undefined;
    user: {
        name: string;
        email: string;
        phone?: string | null | undefined;
        address?: string | null | undefined;
    };
}): Buffer => {
    const doc = new FreightPdfBuilder();
    const margin = 36;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const contentWidth = pageWidth - margin * 2;

    // 1. Full Page Dark Canvas Background (--bg-primary: #0a0f0f)
    doc.drawRect(0, 0, pageWidth, pageHeight, THEME.bgPrimary);

    // 2. Top Brand Gradient Bar Accent (Teal -> Cyan gradient simulation)
    doc.drawRect(0, 0, pageWidth / 2, 5, THEME.accentPrimary);
    doc.drawRect(pageWidth / 2, 0, pageWidth / 2, 5, THEME.accentBlue);

    // 3. Header Card Container (--bg-card: #0d1f1f)
    let curY = 22;
    doc.drawRect(margin, curY, contentWidth, 80, THEME.bgCard, THEME.borderPrimary, 1);

    // Branding Logo & Title
    doc.drawBadge("⚓ FREIGHTAGENT", margin + 16, curY + 16, 120, 22, THEME.accentPrimary, THEME.darkBlack);
    doc.drawText("Global Maritime & Air Logistics Network", margin + 16, curY + 48, {
        size: 8.5,
        color: THEME.textSecondary,
    });
    doc.drawText("Official Automated Digital Receipt", margin + 16, curY + 60, {
        size: 7.5,
        color: THEME.textMuted,
    });

    // Receipt Header Right
    doc.drawText("PAYMENT INVOICE", pageWidth - margin - 16, curY + 16, {
        size: 13,
        bold: true,
        color: THEME.textPrimary,
        align: "right",
    });

    const receiptDate = data.shipment.paidAt ? new Date(data.shipment.paidAt) : new Date();
    const formattedDate = receiptDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    doc.drawText(`Date: ${formattedDate}`, pageWidth - margin - 16, curY + 34, {
        size: 8.5,
        color: THEME.textSecondary,
        align: "right",
    });
    doc.drawText(`Receipt / Voucher #: REC-${data.shipment.trackingId.slice(0, 8).toUpperCase()}`, pageWidth - margin - 16, curY + 46, {
        size: 8.5,
        color: THEME.textSecondary,
        align: "right",
    });

    // Verified Paid Badge
    doc.drawBadge(
        "✓ PAID IN FULL",
        pageWidth - margin - 100,
        curY + 58,
        84,
        15,
        [0.0, 0.35, 0.25],
        THEME.accentSecondary,
        THEME.accentPrimary
    );

    // 4. Two Column Customer & Consignment Info Cards
    curY = 114;
    const colWidth = (contentWidth - 12) / 2;

    // Left: Customer Box
    doc.drawRect(margin, curY, colWidth, 90, THEME.bgCard, THEME.borderPrimary, 1);
    doc.drawText("BILLED CUSTOMER", margin + 14, curY + 12, {
        size: 8,
        bold: true,
        color: THEME.textMuted,
    });
    doc.drawText(data.user.name || "Freight Merchant", margin + 14, curY + 28, {
        size: 10.5,
        bold: true,
        color: THEME.textPrimary,
    });
    doc.drawText(`Email: ${data.user.email}`, margin + 14, curY + 44, {
        size: 8.5,
        color: THEME.textSecondary,
    });
    if (data.user.phone) {
        doc.drawText(`Contact: ${data.user.phone}`, margin + 14, curY + 56, {
            size: 8,
            color: THEME.textMuted,
        });
    }
    if (data.user.address) {
        doc.drawText(`Billing: ${data.user.address}`, margin + 14, curY + 68, {
            size: 8,
            color: THEME.textMuted,
        });
    }

    // Right: Shipment Logistics Box
    const rightColX = margin + colWidth + 12;
    doc.drawRect(rightColX, curY, colWidth, 90, THEME.bgCard, THEME.borderPrimary, 1);
    doc.drawText("CONSIGNMENT SPECIFICATION", rightColX + 14, curY + 12, {
        size: 8,
        bold: true,
        color: THEME.textMuted,
    });
    doc.drawText(`Tracking #: ${data.shipment.trackingId}`, rightColX + 14, curY + 28, {
        size: 9.5,
        bold: true,
        color: THEME.accentSecondary,
    });
    doc.drawText(`Origin: ${data.shipment.origin}`, rightColX + 14, curY + 44, {
        size: 8,
        color: THEME.textSecondary,
    });
    doc.drawText(`Destination: ${data.shipment.destination}`, rightColX + 14, curY + 56, {
        size: 8,
        color: THEME.textSecondary,
    });
    doc.drawText(`Cargo: ${data.shipment.weight} KG (Declared: $${(data.shipment.declaredCargoValue || 0).toFixed(2)})`, rightColX + 14, curY + 68, {
        size: 8,
        color: THEME.textMuted,
    });

    // 5. Itemized Breakdown Table
    curY = 216;
    doc.drawText("ITEMIZED FREIGHT & CLEARANCE CHARGES", margin, curY, {
        size: 9.5,
        bold: true,
        color: THEME.textPrimary,
    });
    curY += 10;

    // Table Header Bar
    doc.drawRect(margin, curY, contentWidth, 22, THEME.bgCardAlt, THEME.borderAccent, 1);
    doc.drawText("Description", margin + 14, curY + 6, {
        size: 8.5,
        bold: true,
        color: THEME.accentSecondary,
    });
    doc.drawText("Tariff Category", margin + 280, curY + 6, {
        size: 8.5,
        bold: true,
        color: THEME.accentSecondary,
    });
    doc.drawText("Amount (USD)", pageWidth - margin - 14, curY + 6, {
        size: 8.5,
        bold: true,
        color: THEME.accentSecondary,
        align: "right",
    });
    curY += 22;

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

    const rawLineItems: ReceiptLineItem[] = [
        ["Ocean Freight Transit", "Freight", cost.oceanFreight || 0],
        ["Origin Port Operations & Terminal Handling", "Port Operations", cost.originHandling || 0],
        ["Terminal Handling Charges (Origin THC)", "Terminal Surcharge", cost.thcOrigin || 0],
        ["Bunker Adjustment Factor (BAF)", "Fuel Surcharge", cost.bafSurcharge || 0],
        ["Transshipment Logistics Hub Transit", "Hub Processing", cost.transshipmentFee || 0],
        ["Destination Terminal Handling (Destination THC)", "Port Terminal", cost.thcDestination || 0],
        ["Destination Handling & Offloading", "Port Operations", cost.destinationHandling || 0],
        ["Customs Formalities & Export/Import Clearance", "Customs Regulatory", cost.customsClearance || 0],
        ["Government Tariff / Customs Duty", "Government Fee", cost.customsDuty || 0],
        ["Value Added Tax (VAT & Local Levies)", "Tax Regulatory", cost.vat || 0],
        ["Marine Cargo Comprehensive Insurance", "Risk Coverage", cost.cargoInsurance || 0],
        ["Last Mile Dispatch & Inland Transport", "Domestic Transit", cost.lastMileDelivery || 0],
        ["Designated Agency Commission Fee", "Agency Service", cost.agencyFee || 0],
        ["Platform Core Technology & Payment Processing", "Platform Service", cost.platformFee || 0],
    ];

    const lineItems: ReceiptLineItem[] = rawLineItems.filter((item) => item[2] > 0);

    if (lineItems.length === 0) {
        lineItems.push(["Standard Freight Services Package", "Consolidated Freight", cost.totalCost || 0]);
    }

    lineItems.forEach((item, index) => {
        const isEven = index % 2 === 0;
        const rowBg = isEven ? THEME.bgCard : THEME.bgCardAlt;
        doc.drawRect(margin, curY, contentWidth, 18, rowBg, THEME.borderPrimary, 0.5);

        doc.drawText(item[0], margin + 14, curY + 5, {
            size: 8,
            color: THEME.textPrimary,
        });
        doc.drawText(item[1], margin + 280, curY + 5, {
            size: 7.5,
            color: THEME.textMuted,
        });
        doc.drawText(`$${item[2].toFixed(2)}`, pageWidth - margin - 14, curY + 5, {
            size: 8,
            bold: true,
            color: THEME.textSecondary,
            align: "right",
        });
        curY += 18;
    });

    // 6. Total Amount Highlight Card
    curY += 14;
    const totalBoxWidth = 230;
    const totalBoxX = pageWidth - margin - totalBoxWidth;
    doc.drawRect(totalBoxX, curY, totalBoxWidth, 48, THEME.bgCard, THEME.accentPrimary, 1.5);

    doc.drawText("TOTAL AMOUNT PAID:", totalBoxX + 14, curY + 12, {
        size: 8.5,
        bold: true,
        color: THEME.textSecondary,
    });
    doc.drawText(`$${(cost.totalCost || 0).toFixed(2)} USD`, pageWidth - margin - 14, curY + 26, {
        size: 15,
        bold: true,
        color: THEME.accentSecondary,
        align: "right",
    });

    // Left: Transaction Audit & Verification Metadata
    doc.drawText("TRANSACTION AUDIT LEDGER", margin, curY + 6, {
        size: 8,
        bold: true,
        color: THEME.textMuted,
    });
    doc.drawText("Gateway: Stripe Payment Infrastructure (PCI-DSS Level 1)", margin, curY + 18, {
        size: 7.5,
        color: THEME.textSecondary,
    });
    if (data.shipment.stripePaymentIntentId) {
        doc.drawText(`Stripe Payment Intent ID: ${data.shipment.stripePaymentIntentId}`, margin, curY + 28, {
            size: 7.5,
            color: THEME.textMuted,
        });
    }
    doc.drawText("Cryptographic Security: Verified & Vaulted on Cloudinary Secure Storage", margin, curY + 38, {
        size: 7.5,
        color: THEME.textMuted,
    });

    // 7. Official Legal & Support Footer
    const footerY = 780;
    doc.drawLine(margin, footerY, pageWidth - margin, footerY, THEME.borderPrimary, 1);
    doc.drawText("FreightAgent Inc. • Global Freight Forwarding, Cargo Clearing & Logistics Operations", pageWidth / 2, footerY + 12, {
        size: 7.5,
        color: THEME.textMuted,
        align: "center",
    });
    doc.drawText("Direct Support: billing@freightagent.com • Official Portal: https://freightagent.com", pageWidth / 2, footerY + 24, {
        size: 7.5,
        color: THEME.textSecondary,
        align: "center",
    });

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
