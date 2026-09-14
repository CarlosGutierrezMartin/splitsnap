import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

admin.initializeApp();

export const parseReceipt = functions.runWith({ secrets: ["API_KEY"] }).https.onCall(async (data, context) => {
    console.log("=== FUNCTION START ===");
    console.log("Timestamp:", new Date().toISOString());

    const { imageBase64, mimeType } = data || {};
    console.log("MimeType:", mimeType);
    console.log("ImageBase64 length:", imageBase64 ? imageBase64.length : "undefined");

    if (!imageBase64 || !mimeType) {
        throw new functions.https.HttpsError("invalid-argument", "Missing imageBase64 or mimeType");
    }

    const apiKey = process.env.API_KEY;
    console.log("API_KEY exists:", !!apiKey);

    if (!apiKey) {
        throw new functions.https.HttpsError("internal", "API Key missing");
    }

    try {
        console.log("=== GEMINI CLIENT INIT ===");
        const genAI = new GoogleGenerativeAI(apiKey);

        console.log("Getting model: gemini-2.5-flash");
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
        });

        const prompt = `Analyze this receipt image.
Identify all purchased items, their quantities, and the individual unit price.
Ignore subtotal, tax, and total lines.
If a quantity is not explicitly stated but implied (e.g., just listed once), assume quantity is 1.

Return ONLY a valid JSON array of objects with this structure:
[{"name": "string", "quantity": number, "unitPrice": number}]
Do not include markdown formatting like \`\`\`json.`;

        console.log("=== CALLING GEMINI API ===");
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: mimeType } }
        ]);

        console.log("generateContent() returned successfully");
        const response = await result.response;
        let text = response.text();
        console.log("Response text:", text.substring(0, 200));

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const rawData = JSON.parse(text);

        console.log("=== SUCCESS ===");
        return { items: rawData };

    } catch (error: any) {
        console.error("=== ERROR ===");
        console.error("Error type:", error.constructor?.name);
        console.error("Error message:", error.message);
        throw new functions.https.HttpsError("internal", "Failed to parse receipt: " + error.message);
    }
});

// Cleanup old sessions (30 days retention)
export const cleanupOldSessions = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const cutoff = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago

    // Query for sessions inactive for 30 days
    // Note: This requires an index on lastActivityAt ASC
    const snapshot = await db.collection('receipt_sessions')
        .where('lastActivityAt', '<', cutoff)
        .limit(500) // Batch limit safety
        .get();

    if (snapshot.empty) {
        console.log('No old sessions found.');
        return null;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${snapshot.size} old sessions.`);
    return null;
});
