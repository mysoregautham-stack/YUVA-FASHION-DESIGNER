
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ImageFile } from "../types";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000;

async function callWithRetry(fn: () => Promise<GenerateContentResponse>): Promise<GenerateContentResponse> {
  let lastError: any;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && i < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const performVirtualTryOn = async (
  personImage: ImageFile,
  garmentImages: ImageFile[],
  backgroundImage?: ImageFile,
  selectedColor?: string
): Promise<{ imageUrl: string; advice: string }> => {
  // Fix: Create new instance with named parameter apiKey as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    TASK: High-Fidelity Editorial Fashion Try-On.
    1. ANATOMY MAPPING: Accurately fit all garments onto the subject, respecting body contours and perspective.
    2. TRADITIONAL CRAFT: For sarees, lehengas, or sherwanis, render realistic silk luster, zari embroidery, and traditional draping folds (pleats, falls, dupatta).
    3. PHYSICS: Simulate realistic fabric weight and texture interactions between layers.
    4. IDENTITY: Retain 100% subject identity, face, and skin tone.
    ${selectedColor ? `5. PALETTE: Integrate "${selectedColor}" as the dominant lighting/accent theme.` : ''}
    ${backgroundImage ? `6. ENVIRONMENT: Seamlessly integrate the subject into the provided background.` : `6. ENVIRONMENT: Clean professional studio.`}
    7. STYLE ADVICE: Provide 2 sentences of professional editorial feedback.
    OUTPUT: base64 image + advice text.
  `;
  const contents: any[] = [{ inlineData: { data: personImage.data, mimeType: personImage.mimeType } }];
  garmentImages.forEach(img => contents.push({ inlineData: { data: img.data, mimeType: img.mimeType } }));
  if (backgroundImage) contents.push({ inlineData: { data: backgroundImage.data, mimeType: backgroundImage.mimeType } });
  contents.push({ text: prompt });

  const response = await callWithRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: contents },
    config: { imageConfig: { aspectRatio: "3:4" } }
  }));
  return extractResult(response);
};

export const performCustomTryOn = async (
  personImage: ImageFile,
  customDescription: string,
  referenceGarments: ImageFile[] = [],
  backgroundImage?: ImageFile,
  selectedColor?: string
): Promise<{ imageUrl: string; advice: string }> => {
  // Fix: Create new instance with named parameter apiKey as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    TASK: AI Couture Synthesis & Fitting.
    1. SYNTHESIS: Generate a high-fashion piece based on: "${customDescription}".
    2. INTEGRATION: Combine synthesized piece with any reference garments provided.
    3. DRAPING: Follow high-end tailoring standards for the fit.
    ${selectedColor ? `4. PALETTE: Integrate "${selectedColor}".` : ''}
    5. STYLE ADVICE: Provide 2 sentences of professional feedback on the design.
  `;
  const contents: any[] = [{ inlineData: { data: personImage.data, mimeType: personImage.mimeType } }];
  referenceGarments.forEach(img => contents.push({ inlineData: { data: img.data, mimeType: img.mimeType } }));
  if (backgroundImage) contents.push({ inlineData: { data: backgroundImage.data, mimeType: backgroundImage.mimeType } });
  contents.push({ text: prompt });

  const response = await callWithRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: contents },
    config: { imageConfig: { aspectRatio: "3:4" } }
  }));
  return extractResult(response);
};

export const generate360Video = async (baseImageBase64: string): Promise<string> => {
  // Fix: Create new instance with named parameter apiKey as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = baseImageBase64.replace(/^data:image\/\w+;base64,/, "");

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: 'A cinematic 360-degree slow-motion orbit around a high-fashion model wearing this outfit. Detailed fabric textures, studio lighting, professional 4k camera movement.',
    image: {
      imageBytes: cleanBase64,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '9:16'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed.");
  
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};

const extractResult = (response: GenerateContentResponse) => {
  let imageUrl = '';
  // Fix: Directly use the .text property to get extracted text content as per guidelines
  let advice = response.text || '';
  
  if (!response.candidates?.[0]?.content?.parts) throw new Error("No response from AI.");
  
  // Fix:Adhere to iterate through all parts to find the image part
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  if (!imageUrl) throw new Error("Failed to generate image.");
  return { imageUrl, advice };
};

export const fetchImageAsImageFile = async (url: string): Promise<ImageFile> => {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return {
    data: dataUrl.split(',')[1],
    mimeType: blob.type,
    preview: dataUrl
  };
};
