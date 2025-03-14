import express, { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { Language, texts, reloadTexts, updateText, exportTextsToFiles } from '../utils/localization';
import { getAllLocalizationTexts, getLocalizationTextsByCategory } from '../database';
import { connectToDatabase } from '../database/connection';

// Create Express app
const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Create views directory if it doesn't exist
const viewsDir = path.join(__dirname, 'views');
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create EJS template for the admin interface
const indexTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Journal Bot Text Editor</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .category {
      margin-bottom: 30px;
      background: #f9f9f9;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .category h2 {
      margin-top: 0;
      color: #3498db;
    }
    .text-item {
      margin-bottom: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 15px;
    }
    .text-key {
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 5px;
    }
    textarea {
      width: 100%;
      min-height: 80px;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: inherit;
      margin-bottom: 10px;
    }
    button {
      background: #3498db;
      color: white;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: #2980b9;
    }
    .success {
      color: #27ae60;
      font-weight: bold;
    }
    .error {
      color: #e74c3c;
      font-weight: bold;
    }
    .language-label {
      display: inline-block;
      width: 80px;
      font-weight: bold;
    }
    .search-box {
      margin-bottom: 20px;
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }
    .actions {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
    }
  </style>
</head>
<body>
  <h1>Journal Bot Text Editor</h1>
  
  <div class="actions">
    <button onclick="exportTexts()">Export to JSON Files</button>
    <button onclick="location.reload()">Refresh</button>
  </div>
  
  <input type="text" id="searchBox" class="search-box" placeholder="Search for text keys...">
  
  <% Object.entries(categories).forEach(([category, items]) => { %>
    <div class="category" id="category-<%= category %>">
      <h2><%= category.charAt(0).toUpperCase() + category.slice(1) %></h2>
      
      <% items.forEach(item => { %>
        <div class="text-item" data-key="<%= item.key %>">
          <div class="text-key"><%= item.key %></div>
          
          <div>
            <span class="language-label">English:</span>
            <textarea id="<%= item.key %>-en"><%= item.translations[Language.ENGLISH] %></textarea>
            <button onclick="saveText('<%= item.key %>', 'en')">Save English</button>
            <span id="<%= item.key %>-en-status"></span>
          </div>
          
          <div>
            <span class="language-label">Russian:</span>
            <textarea id="<%= item.key %>-ru"><%= item.translations[Language.RUSSIAN] %></textarea>
            <button onclick="saveText('<%= item.key %>', 'ru')">Save Russian</button>
            <span id="<%= item.key %>-ru-status"></span>
          </div>
        </div>
      <% }) %>
    </div>
  <% }) %>

  <script>
    function saveText(key, language) {
      const textarea = document.getElementById(\`\${key}-\${language}\`);
      const statusElement = document.getElementById(\`\${key}-\${language}-status\`);
      
      fetch('/api/update-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          language,
          text: textarea.value
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          statusElement.textContent = '✅ Saved!';
          statusElement.className = 'success';
          
          // Clear the status after 3 seconds
          setTimeout(() => {
            statusElement.textContent = '';
          }, 3000);
        } else {
          statusElement.textContent = \`❌ Error: \${data.error}\`;
          statusElement.className = 'error';
        }
      })
      .catch(error => {
        statusElement.textContent = \`❌ Error: \${error.message}\`;
        statusElement.className = 'error';
      });
    }
    
    function exportTexts() {
      fetch('/api/export-texts', {
        method: 'POST'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert('Texts exported to JSON files successfully!');
        } else {
          alert(\`Error exporting texts: \${data.error}\`);
        }
      })
      .catch(error => {
        alert(\`Error: \${error.message}\`);
      });
    }
    
    // Search functionality
    const searchBox = document.getElementById('searchBox');
    searchBox.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const textItems = document.querySelectorAll('.text-item');
      
      textItems.forEach(item => {
        const key = item.getAttribute('data-key').toLowerCase();
        const englishText = document.getElementById(\`\${item.getAttribute('data-key')}-en\`).value.toLowerCase();
        const russianText = document.getElementById(\`\${item.getAttribute('data-key')}-ru\`).value.toLowerCase();
        
        if (key.includes(searchTerm) || englishText.includes(searchTerm) || russianText.includes(searchTerm)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
      
      // Show/hide categories based on visible items
      document.querySelectorAll('.category').forEach(category => {
        const visibleItems = category.querySelectorAll('.text-item[style="display: block"]').length;
        const hiddenItems = category.querySelectorAll('.text-item[style="display: none"]').length;
        const totalItems = visibleItems + hiddenItems;
        
        if (visibleItems === 0) {
          category.style.display = 'none';
        } else {
          category.style.display = 'block';
        }
      });
    });
  </script>
</body>
</html>
`;

// Write the template to the views directory
fs.writeFileSync(path.join(viewsDir, 'index.ejs'), indexTemplate);

// Routes
app.get('/', async (req: Request, res: Response) => {
  try {
    // Reload texts to ensure we have the latest version
    await reloadTexts();
    
    // Get all localization texts from database
    const dbTexts = await getAllLocalizationTexts();
    
    // Group by category
    const categories: Record<string, any[]> = {};
    
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