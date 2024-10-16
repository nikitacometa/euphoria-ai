import OpenAI from "openai";
import { GPT_VERSION, OPENAI_API_KEY } from "./config";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

export async function promptText(text: string): Promise<string> {
    const chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: text }],
        model: GPT_VERSION,
    });
    const message = chatCompletion.choices[0].message;
    if (message.content == null) {
        throw new Error('No message content');
    }
    return message.content;
}
