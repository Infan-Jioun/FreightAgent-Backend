import { generatePaymentReceiptPdf } from "./utils/pdfGenerator.js";
import fs from "fs";
import path from "path";

try {
    const buffer = generatePaymentReceiptPdf({
        shipment: {
            id: "ship_12345",
            trackingId: "FA-88934521",
            origin: "Los Angeles Port, CA, United States",
            destination: "Chittagong Port, Bangladesh",
            weight: 250,
            declaredCargoValue: 12500,
            description: "Industrial Precision Hydraulic Valves and Fittings",
            paidAt: new Date(),
        },
        cost: {
            totalCost: 4420,
            currency: "USD",
            originHandling: 350,
            oceanFreight: 2450,
            bafSurcharge: 180,
            thcOrigin: 220,
            thcDestination: 240,
            transshipmentFee: 150,
            customsClearance: 320,
            customsDuty: 180,
            vat: 80,
            destinationHandling: 150,
            cargoInsurance: 100,
            lastMileDelivery: 0,
            agencyFee: 0,
            platformFee: 0,
        },
        user: {
            name: "John Doe & Associates",
            email: "john.doe@example.com",
            phone: "+1 (555) 012-3456",
            address: "742 Evergreen Terrace, Springfield, OR 97477",
        },
    });

    const outDir = path.resolve(process.cwd(), "uploads", "invoices");
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const outPath = path.join(outDir, "Test_Commercial_Invoice.pdf");
    fs.writeFileSync(outPath, buffer);
    console.log("Success! PDF written to:", outPath, "Size:", buffer.length);
} catch (err) {
    console.error("Error generating PDF:", err);
}
