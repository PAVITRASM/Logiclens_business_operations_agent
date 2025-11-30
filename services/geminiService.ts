import { GoogleGenAI, Chat, LiveServerMessage, Modality } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize client
// Note: In a real production app, you might lazily init this or handle missing keys more gracefully
let ai: GoogleGenAI;

try {
  ai = new GoogleGenAI({ apiKey });
} catch (error) {
  console.error("Failed to initialize GoogleGenAI. Is the API Key set?", error);
}

export const createChatSession = async (systemInstruction: string): Promise<Chat | null> => {
  if (!ai) return null;

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });
    return chat;
  } catch (error) {
    console.error("Error creating chat session:", error);
    return null;
  }
};

export const sendMessageToAgent = async (chat: Chat | null, message: string): Promise<string> => {
  if (!chat) {
    return "Error: AI client not initialized. Please check your API configuration.";
  }

  try {
    const response = await chat.sendMessage({ message });
    return response.text || "I didn't receive a text response.";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Sorry, I'm having trouble connecting to the network right now.";
  }
};

export const connectLiveSession = async (
  callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onclose: (e: CloseEvent) => void;
    onerror: (e: ErrorEvent) => void;
  },
  systemInstruction: string
) => {
  if (!ai) return null;

  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: systemInstruction,
    },
  });
};
