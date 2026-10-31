import Tesseract from 'tesseract.js';

/**
 * Service to handle OCR processing.
 * Designed to be swappable for Google Cloud Vision or AWS Textract in the future.
 */
export async function extractCdlData(imageBuffer) {
  try {
    // Run Tesseract OCR on the provided image buffer
    const { data: { text } } = await Tesseract.recognize(
      imageBuffer,
      'eng'
    );

    console.log("[OCR Raw Text]:\n", text);

    // Basic heuristic extraction for demo purposes
    // Note: Tesseract.js is less accurate than Cloud Vision on complex IDs.
    // These regex patterns are naive and expect typical formats.
    const extracted = {
      first_name: '',
      last_name: '',
      license_number: '',
      state: '',
      expiration_date: '',
      endorsements: ''
    };

    // 1. Find License Number (common formats: 7-9 digits/letters)
    const dlMatch = text.match(/(?:DL|DL NO|LICENSE NO|DL#|ID)[\s:]*([A-Z0-9]{7,12})/i);
    if (dlMatch) extracted.license_number = dlMatch[1];

    // 2. Find State (usually 2 letters near the top, or explicitly written)
    const stateMatch = text.match(/\b(TX|CA|NY|FL|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|ID|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|DC|VT|WY)\b/);
    if (stateMatch) extracted.state = stateMatch[1];

    // 3. Find Expiration Date (EXP, Expires, etc.)
    const expMatch = text.match(/(?:EXP|EXPIRES)[\s:]*(\d{2}[-/]\d{2}[-/]\d{4}|\d{2}[-/]\d{2}[-/]\d{2})/i);
    if (expMatch) extracted.expiration_date = expMatch[1];

    // 4. Name extraction is notoriously hard with raw OCR without layout analysis.
    // We will attempt to find names after "LN", "FN", "LAST", "FIRST".
    const lnMatch = text.match(/(?:LN|LAST NAME|LAST)[\s:]*([A-Z]+)/i);
    if (lnMatch) extracted.last_name = lnMatch[1];

    const fnMatch = text.match(/(?:FN|FIRST NAME|FIRST)[\s:]*([A-Z]+)/i);
    if (fnMatch) extracted.first_name = fnMatch[1];

    // 5. Endorsements (usually a single letter like N, T, X)
    const endMatch = text.match(/(?:ENDORSEMENTS|END)[\s:]*([A-Z\s]+)/i);
    if (endMatch) extracted.endorsements = endMatch[1].trim();

    return extracted;
  } catch (error) {
    console.error("OCR Extraction Error:", error);
    throw new Error("Failed to extract data from image");
  }
}
