import mongoose, { Document, Schema } from 'mongoose';
import { Language } from '../../utils/localization';

// Interface for localization text document
export interface ILocalizationText extends Document {
  key: string;
  category: string;
  translations: {
    [Language.ENGLISH]: string;
    [Language.RUSSIAN]: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Schema for localization text
const localizationTextSchema = new Schema<ILocalizationText>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      index: true
    },
    translations: {
      [Language.ENGLISH]: {
        type: String,
        required: true
      },
      [Language.RUSSIAN]: {
        type: String,
        required: true
      }
    }
  },
  {
    timestamps: true
  }
);

// Create model
export const LocalizationText = mongoose.model<ILocalizationText>('LocalizationText', localizationTextSchema);

// Function to get all localization texts
export async function getAllLocalizationTexts(): Promise<ILocalizationText[]> {
  return LocalizationText.find().sort({ category: 1, key: 1 }).exec();
}

// Function to get localization text by key
export async function getLocalizationTextByKey(key: string): Promise<ILocalizationText | null> {
  return LocalizationText.findOne({ key }).exec();
}

// Function to get localization texts by category
export async function getLocalizationTextsByCategory(category: string): Promise<ILocalizationText[]> {
  return LocalizationText.find({ category }).sort({ key: 1 }).exec();
}

// Function to update or create localization text
export async function upsertLocalizationText(
  key: string,
  category: string,
  translations: { [Language.ENGLISH]: string; [Language.RUSSIAN]: string }
): Promise<ILocalizationText> {
  return LocalizationText.findOneAndUpdate(
    { key },
    { key, category, translations },
    { upsert: true, new: true }
  ).exec();
}

// Function to update a specific translation
export async function updateTranslation(
  key: string,
  language: Language,
  text: string
): Promise<ILocalizationText | null> {
  const updateObj = { [`translations.${language}`]: text };
  return LocalizationText.findOneAndUpdate(
    { key },
    { $set: updateObj },
    { new: true }
  ).exec();
}

// Function to delete localization text
export async function deleteLocalizationText(key: string): Promise<boolean> {
  const result = await LocalizationText.deleteOne({ key }).exec();
  return result.deletedCount > 0;
} 