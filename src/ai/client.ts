import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config';

/** Single shared OpenAI client for the whole application. */
export const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});
