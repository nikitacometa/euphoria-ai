# Human Design Integration API Documentation

## Overview

This document describes the internal `HumanDesignService` created for interacting with the external Human Design API and managing data caching within the Euphoria bot application.

For details on the *external* Human Design API endpoints, parameters, and response formats that this service consumes, please refer to [humandesign_api.md](mdc:humandesign_api.md).

## Service: `HumanDesignService`

Located at `src/services/ai/HumanDesignService.ts`.

**Purpose:** Provides methods to fetch Human Design data (locations, timezones, charts) while handling API communication, retries, errors, and caching.

### Configuration (`IHumanDesignServiceConfig`)

- `apiKey`: (Required) API key for the external Human Design API.
- `baseUrl`: (Required) Base URL for the external Human Design API.
- `timeout`: Optional request timeout in milliseconds (default: 10000).
- `logger`: Optional logger instance.
- `retryAttempts`: Optional number of retry attempts for failed requests (default: 3).
- `retryDelay`: Optional function to calculate retry delay.
- `cacheTTL`: Optional time-to-live for the in-memory location cache in milliseconds (default: 1 hour).

### Methods

#### `findLocationTimezone(query: string): Promise<ILocationTimezone[]>`

- **Description:** Finds potential locations and corresponding timezones based on a user query string (e.g., "London", "New York, USA"). Uses the external `/locations` endpoint.
- **Caching:** Implements an in-memory cache (`locationCache`) with a configurable TTL (`cacheTTL`) to store results for identical queries.
- **Parameters:**
    - `query`: `string` - The location search query.
- **Returns:** `Promise<ILocationTimezone[]>` - An array of location/timezone objects matching the query (structure defined in `humanDesign.types.ts`).
- **Throws:** `Error` on invalid input, `ApiHttpError` or `ApiNetworkError` on API/network issues.
- **Example:**
  ```typescript
  const locations = await hdService.findLocationTimezone('Paris, France');
  if (locations.length > 0) {
      const timezone = locations[0].timezone; // e.g., "Europe/Paris"
  }
  ```

#### `getChart(date: string, time: string, location: string, timezone: string): Promise<IHumanDesignChartResponse>`

- **Description:** Retrieves a full Human Design chart. First checks the MongoDB `humanDesignCharts` collection for a cached chart matching the exact birth date, time, and location string. If not found, it calls the external `/hd-data` endpoint, then saves the result asynchronously to the database cache.
- **Caching:** Uses the `humanDesignCharts` MongoDB collection. A compound unique index on `{ birthDate: 1, birthTime: 1, birthLocation: 1 }` ensures only one chart is stored per unique birth input.
- **Parameters:**
    - `date`: `string` - Birth date in "YYYY-MM-DD" format.
    - `time`: `string` - Birth time in "HH:MM" (24-hour) format.
    - `location`: `string` - The birth location string provided by the user (used for caching key).
    - `timezone`: `string` - The IANA timezone identifier (e.g., "Europe/London").
- **Returns:** `Promise<IHumanDesignChartResponse>` - The full chart data object matching the API response structure (defined in `humanDesign.types.ts`).
- **Throws:** `Error` on invalid input, `ApiHttpError` or `ApiNetworkError` on API/network issues. Database errors during cache check are logged but generally do not prevent an API call attempt.
- **Example:**
  ```typescript
  const chart = await hdService.getChart('1990-05-15', '07:30', 'London, UK', 'Europe/London');
  console.log(chart.Properties.Type.Id); // e.g., "Generator"
  ```

#### `checkApiHealth(): Promise<{ status: 'ok' | 'error'; message?: string }>`

- **Description:** Performs a basic health check by attempting a simple API call (currently `findLocationTimezone('London')`).
- **Returns:** `Promise<{ status: 'ok' | 'error'; message?: string }>` indicating the outcome.

#### `clearLocationCache(): void`

- **Description:** Manually clears the in-memory cache used by `findLocationTimezone`.

## Database Caching (`humanDesignCharts` Collection)

- **Model:** `src/database/models/human-design-chart.model.ts`
- **Purpose:** Stores generated Human Design charts to minimize external API calls.
- **Key Fields for Caching:**
    - `birthDate` (String, YYYY-MM-DD)
    - `birthTime` (String, HH:MM)
    - `birthLocation` (String) - *Note: Case-sensitive exact match used for lookup.*
- **Cached Data:** The full API response is stored in the `chartData` field (Type: `Schema.Types.Mixed`). Key chart properties (type, profile, authority, etc.) are also stored as top-level fields for potential direct querying.
- **Lookup:** The `getChart` service method uses `findExistingChart(date, time, location)` to check the cache before calling the API.
- **Storage:** New charts fetched from the API are saved asynchronously using `createChart(data)`.

## Error Handling

The service uses custom error classes defined in `src/errors/classes/api-errors.ts`:
- `ApiHttpError`: For non-2xx API responses (includes status code).
- `ApiNetworkError`: For network issues or timeouts.

These errors bubble up from the service methods and should be caught by the calling handlers (e.g., command handlers). 