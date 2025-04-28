import { Context, SessionFlavor } from "grammy";

interface SessionData {
    journalChatMode: boolean;
    waitingForJournalQuestion: boolean;
}

export type MyContext = Context & SessionFlavor<SessionData>; 