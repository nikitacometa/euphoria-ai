# Configuration System

The configuration system provides a centralized, type-safe way to manage application settings across different environments.

## Features

- **Environment-specific configuration**: Supports different settings for development, test, and production environments.
- **Type safety**: All configuration is strongly typed with TypeScript.
- **Validation**: Required environment variables are validated at startup.
- **Documentation**: All configuration options are documented with JSDoc.
- **Backward compatibility**: Legacy direct variable exports are maintained for backwards compatibility.

## Usage

### Importing Configuration

Import the config object to access all settings:

```typescript
import { config } from '../config';

// Access settings
const apiKey = config.openai.apiKey;
const logLevel = config.logging.level;
```

### Environment Variables

The following environment variables are supported:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Application environment (`development`, `test`, or `production`) |
| `TELEGRAM_API_TOKEN` | Yes | - | Telegram Bot API token |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key |
| `GPT_VERSION` | No | `gpt-4-turbo` | GPT model version to use |
| `MONGODB_HOST` | No | `localhost` | MongoDB host |
| `MONGODB_PORT` | No | `27017` | MongoDB port |
| `MONGODB_USER` | No | `` | MongoDB username |
| `MONGODB_PASSWORD` | No | `` | MongoDB password |
| `MONGODB_DATABASE` | No | `journal_bot` | MongoDB database name |
| `MONGO_EXPRESS_PORT` | No | `8081` | Mongo Express port for development |
| `LOG_LEVEL` | No | `info` | Logging level (`none`, `error`, `warn`, `info`, `debug`, `trace`) |

### Environment-Specific Configuration

To use environment-specific configuration, create `.env` files for each environment:

- `.env`: Default environment variables
- `.env.test`: Test environment variables
- `.env.production`: Production environment variables

The appropriate file will be loaded based on the `NODE_ENV` value.

## Extending Configuration

To add new configuration options:

1. Update the `AppConfig` interface in `src/config/index.ts`
2. Add the new options to the `config` object
3. Update this documentation

## Migrating from Legacy Configuration

The legacy direct exports (`TELEGRAM_API_TOKEN`, etc.) are still available for backward compatibility, but new code should use the `config` object instead:

```typescript
// Legacy approach (deprecated)
import { TELEGRAM_API_TOKEN } from '../config';

// New approach (recommended)
import { config } from '../config';
const token = config.telegram.apiToken;
``` 