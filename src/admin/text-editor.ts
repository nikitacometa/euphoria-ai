import express, { Request, Response } from 'express';
import * as path from 'path';
import { Language, reloadTexts, updateText, exportTextsToFiles } from '../utils/localization';
import { getAllLocalizationTexts } from '../database';
import { connectToDatabase } from '../database/connection';

// Create Express app
const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Routes
app.get('/', async (req: Request, res: Response) => {
  try {
    // Reload texts to ensure we have the latest version
    await reloadTexts();
    
    // Get all localization texts from database
    const dbTexts = await getAllLocalizationTexts();
    
    // Group by category
    const categories: Record<string, Array<{ key: string; translations: Record<Language, string> }>> = {};
    
    for (const dbText of dbTexts) {
      if (!categories[dbText.category]) {
        categories[dbText.category] = [];
      }
      
      categories[dbText.category].push({
        key: dbText.key,
        translations: dbText.translations
      });
    }
    
    res.render('index', {
      categories,
      Language
    });
  } catch (error) {
    console.error('Error loading admin interface:', error);
    res.status(500).send('Error loading admin interface');
  }
});

// API endpoint to update text
app.post('/api/update-text', async (req: Request, res: Response) => {
  const { key, language, text } = req.body;
  
  if (!key || !language || text === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }
  
  const langCode = language === 'en' ? Language.ENGLISH : Language.RUSSIAN;
  
  try {
    const success = await updateText(key, langCode, text);
    
    if (success) {
      return res.json({ success: true });
    } else {
      return res.status(404).json({
        success: false,
        error: `Text key "${key}" not found`
      });
    }
  } catch (error) {
    console.error('Error updating text:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to export texts to JSON files
app.post('/api/export-texts', async (req: Request, res: Response) => {
  try {
    const success = await exportTextsToFiles();
    
    if (success) {
      return res.json({ success: true });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to export texts'
      });
    }
  } catch (error) {
    console.error('Error exporting texts:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Start the server
export async function startAdminServer() {
  // Connect to database
  await connectToDatabase();
  
  app.listen(PORT, () => {
    console.log(`Admin interface running at http://localhost:${PORT}`);
  });
}

// If this file is run directly, start the server
if (require.main === module) {
  startAdminServer().catch(error => {
    console.error('Failed to start admin server:', error);
  });
} 