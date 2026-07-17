import express, { NextFunction, Request, Response } from 'express';
import * as path from 'path';
import { timingSafeEqual } from 'crypto';
import { Language, reloadTexts, updateText, exportTextsToFiles } from '../utils/localization';
import { getAllLocalizationTexts } from '../database';
import { connectToDatabase } from '../database/connection';
import { ADMIN_HOST, ADMIN_PASSWORD, ADMIN_PORT } from '../config';

// Create Express app
const app = express();
// Bound to loopback by default: this is an operator tool, not a public page.

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(basicAuth);

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/** HTTP Basic auth against ADMIN_PASSWORD; every route requires it. */
function basicAuth(req: Request, res: Response, next: NextFunction): void {
    const expected = ADMIN_PASSWORD || '';
    const header = req.headers.authorization || '';
    const encoded = header.startsWith('Basic ') ? header.slice(6) : '';
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const password = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : '';

    if (expected && safeEquals(password, expected)) {
        next();
        return;
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Journal Bot Admin"');
    res.status(401).send('Authentication required');
}

function safeEquals(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) {
        return false;
    }
    return timingSafeEqual(bufferA, bufferB);
}


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

// Start the server (assumes the database connection is already established)
export async function startAdminServer(): Promise<void> {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD must be set to run the admin interface');
  }

  app.listen(ADMIN_PORT, ADMIN_HOST, () => {
    console.log(`Admin interface running at http://${ADMIN_HOST}:${ADMIN_PORT}`);
  });
}

// If this file is run directly, connect to the database and start the server
if (require.main === module) {
  connectToDatabase()
    .then(() => startAdminServer())
    .catch(error => {
      console.error('Failed to start admin server:', error);
      process.exit(1);
    });
}
