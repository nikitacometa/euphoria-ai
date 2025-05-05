import inquirer from 'inquirer';
// Dynamic import for chalk
// import chalk from 'chalk'; 
import { HumanDesignService, IHumanDesignServiceConfig } from '../src/services/ai/HumanDesignService';
import { createLogger, LogLevel } from '../src/utils/logger'; // Import LogLevel
import { connectToDatabase, disconnectFromDatabase } from '../src/database';
import { IHumanDesignChartResponse } from '../src/services/ai/humanDesign.types';

// Load dotenv directly in the script to ensure env vars are available
import * as dotenv from 'dotenv';
import path from 'path';
// Determine the environment and load the appropriate .env file
const envPath = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envPath) });

const scriptLogger = createLogger('GetHdChartScript');

// --- Service Setup ---
const hdServiceConfig: IHumanDesignServiceConfig = {
  apiKey: process.env.HUMAN_DESIGN_API_KEY || '',
  baseUrl: process.env.HUMAN_DESIGN_API_BASE_URL || '',
  logger: createLogger('HumanDesignService', LogLevel.DEBUG)
};

// --- Main CLI Logic ---
async function runCli(): Promise<void> {
  // Dynamically import chalk
  const chalk = (await import('chalk')).default;

  if (!hdServiceConfig.apiKey || !hdServiceConfig.baseUrl) {
    scriptLogger.error(chalk.red('Error: Missing Human Design API Key or Base URL in config/env.'));
    // Use chalk after it's imported
    console.error(chalk.red('Error: Missing Human Design API Key or Base URL in config/env. Please check your .env file and config setup.'));
    process.exit(1);
  }
  const hdService = new HumanDesignService(hdServiceConfig);

  scriptLogger.info('Starting Human Design Chart CLI...');
  
  try {
      await connectToDatabase(); 
      scriptLogger.info('Connected to database.');
      console.log(chalk.gray('API requests and responses will be fully logged for debugging purposes.'));

      const answers = await inquirer.prompt([
         // ... inquirer prompts ...
         {
            type: 'input',
            name: 'birthDate',
            message: 'Enter your birth date (YYYY-MM-DD):',
            validate: (input: string) => 
                /^\d{4}-\d{2}-\d{2}$/.test(input) || 'Please enter a valid date in YYYY-MM-DD format.',
        },
        {
            type: 'input',
            name: 'birthTime',
            message: 'Enter your birth time (HH:MM, 24-hour format):',
            validate: (input: string) =>
                /^([01]?\d|2[0-3]):([0-5]\d)$/.test(input) || 'Please enter a valid time in HH:MM (24h) format.',
        },
        {
            type: 'input',
            name: 'birthLocation',
            message: 'Enter your birth location (e.g., London, UK):',
            validate: (input: string) => 
                input.trim().length > 2 || 'Please enter a valid location.',
        },
      ]);

      const { birthDate, birthTime, birthLocation } = answers;
      
      console.log(chalk.blue('\nFetching timezone...'));
      console.log(chalk.gray('Sending API request to location endpoint...'));
      const locationResults = await hdService.findLocationTimezone(birthLocation);

      if (!locationResults || locationResults.length === 0 || !locationResults[0].timezone) {
          console.log(chalk.red(`Could not determine timezone for "${birthLocation}". Please be more specific.`));
          return; 
      }
      const timezone = locationResults[0].timezone;
      console.log(chalk.green(`✓ Successfully determined timezone: ${timezone}`));

      console.log(chalk.blue('\nGenerating chart...'));
      console.log(chalk.gray('Sending API request to hd-data endpoint...'));
      const chart = await hdService.getChart(birthDate, birthTime, birthLocation, timezone);
      console.log(chalk.green('✓ Chart data successfully retrieved'));

      // Use chalk for display
      displayChart(chalk, chart);

  } catch (error) {
      // Use chalk for error display
      const chalk = (await import('chalk')).default; // Import chalk again for catch block
      scriptLogger.error('Script failed:', error);
      
      // Enhanced error display
      if (error instanceof Error) {
        console.error(chalk.red(`\nAn error occurred: ${error.message}`));
        
        // Handle API errors which might have additional data
        if ((error as any).status || (error as any).responseData) {
          console.error(chalk.red.bold('\nAPI Error Details:'));
          if ((error as any).status) {
            console.error(chalk.red(`Status: ${(error as any).status}`));
          }
          if ((error as any).responseData) {
            console.error(chalk.red(`Response: ${JSON.stringify((error as any).responseData, null, 2)}`));
          }
        }
        // Show general error details if available
        else if ((error as any).details) {
          console.error(chalk.red(`Details: ${JSON.stringify((error as any).details, null, 2)}`));
        }
      } else {
          console.error(chalk.red('\nAn unknown error occurred.'));
      }
  } finally {
      await disconnectFromDatabase();
      scriptLogger.info('Disconnected from database.');
  }
}

// Update displayChart to accept chalk instance
function displayChart(chalk: any, chart: IHumanDesignChartResponse): void {
  const props = chart.Properties;
  if (!props) {
    console.log(chalk.yellow('Chart data seems incomplete.'));
    return;
  }

  console.log(chalk.cyan.bold('\n--- Your Human Design Chart ---'));
  console.log(`${chalk.bold('Type:')} ${chalk.green(props.Type?.Id ?? 'N/A')}`);
  console.log(`${chalk.bold('Profile:')} ${chalk.green(props.Profile?.Id ?? 'N/A')}`);
  console.log(`${chalk.bold('Authority:')} ${chalk.green(props.InnerAuthority?.Id ?? 'N/A')}`);
  console.log(`${chalk.bold('Definition:')} ${chalk.green(props.Definition?.Id ?? 'N/A')}`);
  console.log(`${chalk.bold('Strategy:')} ${chalk.green(props.Strategy?.Id ?? 'N/A')}`);
  console.log(`${chalk.bold('Signature:')} ${chalk.green(props.Signature?.Id ?? 'N/A')}`);
  console.log(`${chalk.bold('Not-Self Theme:')} ${chalk.yellow(props.NotSelfTheme?.Id ?? 'N/A')}`);
  
  if (chart.DefinedCenters && chart.DefinedCenters.length > 0) {
      console.log(`${chalk.bold('Defined Centers:')} ${chart.DefinedCenters.join(', ')}`);
  }
  if (chart.OpenCenters && chart.OpenCenters.length > 0) {
      console.log(`${chalk.bold('Open Centers:')} ${chart.OpenCenters.join(', ')}`);
  }
  if (chart.Channels && chart.Channels.length > 0) {
      console.log(`${chalk.bold('Channels:')} ${chart.Channels.join(', ')}`);
  }
  console.log(chalk.cyan.bold('-----------------------------\n'));
}

// Run the CLI
runCli(); 