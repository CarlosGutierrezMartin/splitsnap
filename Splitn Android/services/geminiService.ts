import { functions, auth } from "../firebase/config";
import { httpsCallable } from "firebase/functions";
import { ParsedItem } from "../types";

export const parseReceiptImage = async (file: File): Promise<ParsedItem[]> => {
  try {
    // Debug: Check auth state
    console.log("Current auth user:", auth.currentUser);
    console.log("User UID:", auth.currentUser?.uid);

    if (!auth.currentUser) {
      throw new Error("User not authenticated. Please wait for sign-in to complete.");
    }

    // Convert to Base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove "data:*/*;base64," prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const imageBase64 = await base64Promise;
    const mimeType = file.type || 'image/jpeg'; // Fallback if type is missing

    console.log("Preparing payload:", {
      imageBase64Length: imageBase64.length,
      mimeType: mimeType
    });

    if (!imageBase64) {
      throw new Error("Failed to process image: Base64 is empty");
    }

    console.log("Calling parseReceipt Cloud Function...");
    const parseReceipt = httpsCallable(functions, 'parseReceipt');
    const result = await parseReceipt({
      imageBase64,
      mimeType
    });

    const data = result.data as { items: any[] };

    // Transform to internal type with IDs and calculated totals
    return data.items.map((item: any, index: number) => ({
      id: `item-${Date.now()}-${index}`,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice
    }));

  } catch (error) {
    console.error("Error parsing receipt:", error);
    throw error;
  }
};
