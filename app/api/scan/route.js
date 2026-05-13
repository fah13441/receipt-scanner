import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { image, mimeType } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction:
        'You are a receipt data extraction engine. Extract the merchant name, date, total amount, currency, infer a category (e.g. Groceries, Restaurant, Travel, Electronics, Healthcare, Utilities, Entertainment, Other), and extract all line items (name, price). Return ONLY a valid JSON object matching this exact structure: {"merchantName": "...", "date": "YYYY-MM-DD", "totalAmount": 0.00, "currency": "USD", "category": "...", "lineItems": [{"name": "...", "price": 0.00}]}. Strip all markdown formatting, do not wrap in ```json. Do not include any explanation or text outside the JSON object.',
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      },
      "Extract all receipt data and return only the JSON object as instructed.",
    ]);

    const responseText = result.response.text().trim();

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse JSON from model response");
      }
    }

    const normalized = {
      merchantName: parsed.merchantName || "",
      date: parsed.date || "",
      totalAmount:
        typeof parsed.totalAmount === "number" ? parsed.totalAmount : 0,
      currency: parsed.currency || "USD",
      category: parsed.category || "Other",
      lineItems: Array.isArray(parsed.lineItems)
        ? parsed.lineItems.map((item) => ({
            name: item.name || "",
            price: typeof item.price === "number" ? item.price : 0,
          }))
        : [],
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Receipt scan error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process receipt" },
      { status: 500 }
    );
  }
}