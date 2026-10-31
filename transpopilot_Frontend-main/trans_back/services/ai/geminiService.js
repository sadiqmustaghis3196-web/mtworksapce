import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";
import sharp from "sharp";
import crypto from "crypto";

dotenv.config();

const cache = new Map();

async function _extractReceiptDataBase(imageBuffer, mimeType, orgId, prompt, responseSchema, receiptPrefix) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing. Skipping AI extraction.");
      return null;
    }

    const hash = crypto.createHash("sha256").update(receiptPrefix).update(imageBuffer).update(orgId || "").digest("hex");
    if (cache.has(hash)) {
      console.log(`[Cache Hit] Returning cached ${receiptPrefix} OCR result`);
      return cache.get(hash);
    }

    let processedBuffer = imageBuffer;
    let processedMime = mimeType;
    if (mimeType.startsWith("image/")) {
      processedBuffer = await sharp(imageBuffer)
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      processedMime = "image/jpeg";
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const fallbackModel = "gemini-3.1-flash-lite";

    const generationConfig = {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 256,
      responseSchema: responseSchema
    };

    const imagePart = {
      inlineData: {
        data: processedBuffer.toString("base64"),
        mimeType: processedMime
      }
    };

    let result;
    try {
      const model = genAI.getGenerativeModel({ model: primaryModel, generationConfig });
      result = await model.generateContent([prompt, imagePart]);
    } catch (primaryError) {
      if (primaryError.status === 503) {
        console.warn(`[Gemini] Primary model ${primaryModel} 503 error. Retrying in 500ms...`);
        await new Promise(res => setTimeout(res, 500));
        try {
          const model = genAI.getGenerativeModel({ model: primaryModel, generationConfig });
          result = await model.generateContent([prompt, imagePart]);
        } catch (retryError) {
          console.warn(`[Gemini] Primary model ${primaryModel} failed again. Falling back to ${fallbackModel}...`);
          try {
            const fallback = genAI.getGenerativeModel({ model: fallbackModel, generationConfig });
            result = await fallback.generateContent([prompt, imagePart]);
          } catch (fallbackError) {
            console.error(`[Gemini] Fallback model ${fallbackModel} also failed.`);
            return null;
          }
        }
      } else {
        throw primaryError;
      }
    }

    const usage = result.response.usageMetadata;
    console.log(`[Gemini Usage] Model: ${result.response.modelVersion || primaryModel} | Tokens: Prompt ${usage?.promptTokenCount} + Output ${usage?.candidatesTokenCount} = ${usage?.totalTokenCount}`);

    const responseText = result.response.text();
    let parsedData = null;
    try {
      parsedData = JSON.parse(responseText);
      cache.set(hash, parsedData);
      return parsedData;
    } catch (e) {
      console.error("Failed to parse Gemini response as JSON", responseText);
      return null;
    }
  } catch (error) {
    console.error(`Error in _extractReceiptDataBase (${receiptPrefix}):`, error);
    return null;
  }
}

export async function extractFuelReceiptData(imageBuffer, mimeType, orgId) {
  const responseSchema = {
    type: SchemaType.OBJECT,
    properties: {
      transaction_date: { type: SchemaType.STRING, description: "YYYY-MM-DD", nullable: true },
      gallons: { type: SchemaType.NUMBER, nullable: true },
      cost_per_gallon: { type: SchemaType.NUMBER, nullable: true },
      total_cost: { type: SchemaType.NUMBER, nullable: true },
      station_name: { type: SchemaType.STRING, nullable: true },
      confidence_score: { type: SchemaType.NUMBER, nullable: true }
    },
    // We only require total_cost and confidence_score. If others are illegible, the model may omit the key.
    required: ["total_cost", "confidence_score"]
  };

  const prompt = `You are an expert OCR AI extracting structured data from fuel receipts.
Analyze the image and extract:
- Transaction date
- Gallons (or liters)
- Price per gallon (or liter)
- Total cost/amount
- Fuel station or merchant name

If a value is illegible or not present, omit its key entirely. Do not guess.
Provide confidence_score 0.0-1.0.`;

  return _extractReceiptDataBase(imageBuffer, mimeType, orgId, prompt, responseSchema, "fuel");
}

export async function extractMaintenanceReceiptData(imageBuffer, mimeType, orgId) {
  const responseSchema = {
    type: SchemaType.OBJECT,
    properties: {
      service_date: { type: SchemaType.STRING, description: "YYYY-MM-DD", nullable: true },
      vendor: { type: SchemaType.STRING, nullable: true },
      service_type: { type: SchemaType.STRING, nullable: true },
      labor_cost: { type: SchemaType.NUMBER, nullable: true },
      parts_cost: { type: SchemaType.NUMBER, nullable: true },
      total_cost: { type: SchemaType.NUMBER, nullable: true },
      confidence_score: { type: SchemaType.NUMBER, nullable: true }
    },
    // We only require total_cost and confidence_score. Other fields are optional and may be omitted if illegible.
    required: ["total_cost", "confidence_score"]
  };

  const prompt = `You are an expert OCR AI extracting structured data from vehicle maintenance/repair receipts.
Analyze the image and extract:
- Service date (YYYY-MM-DD)
- Vendor or repair shop name
- Description or service type (e.g. 'Oil Change', 'Brake Pad Replacement')
- Labor cost
- Parts cost
- Total cost

If a value is illegible or not present, omit its key entirely. Do not guess.
Provide confidence_score 0.0-1.0.`;

  return _extractReceiptDataBase(imageBuffer, mimeType, orgId, prompt, responseSchema, "maintenance");
}

export async function getVehicleHealthRecommendation(diagnosticString, orgId) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing. Skipping AI recommendation.");
      return null;
    }

    const hash = crypto.createHash("sha256").update(diagnosticString).update(orgId || "").digest("hex");
    if (cache.has(hash)) {
      console.log(`[Cache Hit] Returning cached recommendation`);
      return cache.get(hash);
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const fallbackModel = "gemini-3.1-flash-lite";

    const generationConfig = {
      temperature: 0,
      maxOutputTokens: 256,
    };

    const prompt = `You are an expert diesel mechanic. 
Based on these vehicle diagnostics, provide a plain-English, actionable recommendation (1-2 sentences). 
Focus on what needs attention, what happens if ignored, and severity. Do not invent metrics.
Diagnostics: ${diagnosticString}`;

    let result;
    try {
      const model = genAI.getGenerativeModel({ model: primaryModel, generationConfig });
      result = await model.generateContent(prompt);
    } catch (primaryError) {
      if (primaryError.status === 503) {
        await new Promise(res => setTimeout(res, 500));
        try {
          const model = genAI.getGenerativeModel({ model: primaryModel, generationConfig });
          result = await model.generateContent(prompt);
        } catch (retryError) {
          try {
            const fallback = genAI.getGenerativeModel({ model: fallbackModel, generationConfig });
            result = await fallback.generateContent(prompt);
          } catch (fallbackError) {
            return null;
          }
        }
      } else {
        throw primaryError;
      }
    }

    const usage = result.response.usageMetadata;
    console.log(`[Gemini Usage] Health Rec | Tokens: Prompt ${usage?.promptTokenCount} + Output ${usage?.candidatesTokenCount} = ${usage?.totalTokenCount}`);

    const responseText = result.response.text();
    cache.set(hash, responseText);
    return responseText;
  } catch (error) {
    console.error("Error in getVehicleHealthRecommendation:", error);
    return null;
  }
}
