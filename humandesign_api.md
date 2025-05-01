# Human Design API Documentation

## Overview
This document outlines the Human Design API endpoints and usage within the application. The API provides functionality for retrieving timezone information and generating Human Design charts based on birth information.

## Service Endpoints

### 1. Get Timezone by Location

Retrieves the timezone information for a given city or location.

**Endpoint:** `getTimezoneByLocation(location: string)`

**Parameters:**
- `location`: String containing city name and/or country (e.g., "New York, USA")

**Returns:**
```typescript
{
  timezone: string;  // e.g., "America/New_York"
  utcOffset: string; // e.g., "-05:00"
  location: {
    latitude: number;  // e.g., 40.7128
    longitude: number; // e.g., -74.0060
  }
}
```

**Example:**
```typescript
const timezoneInfo = await humanDesignService.getTimezoneByLocation("Paris, France");
// Returns:
// {
//   timezone: "Europe/Paris",
//   utcOffset: "+01:00",
//   location: {
//     latitude: 48.8566,
//     longitude: 2.3522
//   }
// }
```

### 2. Get Human Design Chart

Generates a Human Design chart based on birth date, time, and location.

**Endpoint:** `getHumanDesignChart(birthDate: string, birthTime: string, birthLocation: string)`

**Parameters:**
- `birthDate`: Date of birth in "YYYY-MM-DD" format
- `birthTime`: Time of birth in "HH:MM" 24-hour format
- `birthLocation`: Birth location (city and/or country)

**Returns:**
```typescript
{
  id: string;          // Unique identifier for the chart
  profile: string;     // e.g., "1/3", "4/6", etc.
  type: string;        // e.g., "Generator", "Projector", etc.
  authority: string;   // e.g., "Emotional", "Sacral", etc.
  centers: {
    head: boolean;
    ajna: boolean;
    throat: boolean;
    g: boolean;
    heart: boolean;
    solar: boolean;
    sacral: boolean;
    spleen: boolean;
    root: boolean;
  };
  channels: string[];  // Array of defined channels, e.g., ["20-57", "10-20"]
  gates: number[];     // Array of defined gates, e.g., [10, 20, 57]
  definition: string;  // e.g., "Single Definition", "Split Definition"
  variables: {
    personality: {
      color: string;
      tone: string;
      base: string;
    };
    design: {
      color: string;
      tone: string;
      base: string;
    };
  }
}
```

**Example:**
```typescript
const chart = await humanDesignService.getHumanDesignChart(
  "1990-05-15", 
  "07:30", 
  "London, UK"
);
// Returns detailed Human Design chart data
```

## Database Caching
The service implements caching to avoid redundant API calls. Charts are stored in the `humanDesignCharts` collection with the following schema:

```typescript
{
  _id: ObjectId,
  birthDate: string,
  birthTime: string,
  birthLocation: string,
  chartData: Object, // Full chart data as returned by the API
  createdAt: Date
}
```

When requesting a chart, the service first checks the database for an existing entry with matching birth information. If found, it returns the cached data; otherwise, it fetches new data from the API and caches it.

## Usage in Bot Commands

The API service is utilized by two main bot commands:

1. **Generate Human Design** - Collects user birth information and generates their chart
2. **Human Design Chat** - Provides consultation based on the user's stored chart

See the command documentation for detailed implementation.

Timezone API
Endpoint: GET https://api.humandesign.ai/locations
Returns a filtered list of matching city + timezone data based on partial query input. Supports autocomplete functionality for timezone lookups.

Parameter	Type	Required	Description
query	string	Yes	City or region input (e.g., "London")
api_key	string	Yes	Your secure API key

Example JSON Response

[
  {
    "country": " Canada",
    "timezone": "America/Toronto",
    "asciiname": "London",
    "admin1": " Ontario",
    "tokens": [
      "London",
      " Ontario",
      " Canada"
    ],
    "value": "London, Ontario, Canada"
  },
  {
    "country": " United Kingdom",
    "timezone": "Europe/London",
    "asciiname": "Londonderry County Borough",
    "admin1": " Northern Ireland",
    "tokens": [
      "Londonderry County Borough",
      " Northern Ireland",
      " United Kingdom"
    ],
    "value": "Londonderry County Borough, Northern Ireland, United Kingdom"
  },
  {
    "country": " United Kingdom",
    "timezone": "Europe/London",
    "asciiname": "London Colney",
    "admin1": " England",
    "tokens": [
      "London Colney",
      " England",
      " United Kingdom"
    ],
    "value": "London Colney, England, United Kingdom"
  },
  {
    "country": " United Kingdom",
    "timezone": "Europe/London",
    "asciiname": "City of London",
    "admin1": " England",
    "tokens": [
      "City of London",
      " England",
      " United Kingdom"
    ],
    "value": "City of London, England, United Kingdom"
  },
  {
    "country": " United Kingdom",
    "timezone": "Europe/London",
    "asciiname": "London",
    "admin1": " England",
    "tokens": [
      "London",
      " England",
      " United Kingdom"
    ],
    "value": "London, England, United Kingdom"
  },
  {
    "country": " United Kingdom",
    "timezone": "Europe/London",
    "asciiname": "West End of London",
    "admin1": " England",
    "tokens": [
      "West End of London",
      " England",
      " United Kingdom"
    ],
    "value": "West End of London, England, United Kingdom"
  },
  {
    "country": " United States",
    "timezone": "America/New_York",
    "asciiname": "London",
    "admin1": " Kentucky",
    "tokens": [
      "London",
      " Kentucky",
      " United States"
    ],
    "value": "London, Kentucky, United States"
  },
  {
    "country": " United States",
    "timezone": "America/New_York",
    "asciiname": "Londontowne",
    "admin1": " Maryland",
    "tokens": [
      "Londontowne",
      " Maryland",
      " United States"
    ],
    "value": "Londontowne, Maryland, United States"
  },
  {
    "country": " United States",
    "timezone": "America/New_York",
    "asciiname": "London",
    "admin1": " Ohio",
    "tokens": [
      "London",
      " Ohio",
      " United States"
    ],
    "value": "London, Ohio, United States"
  },
  {
    "country": " United States",
    "timezone": "America/New_York",
    "asciiname": "New London",
    "admin1": " Connecticut",
    "tokens": [
      "New London",
      " Connecticut",
      " United States"
    ],
    "value": "New London, Connecticut, United States"
  },
  {
    "country": " United States",
    "timezone": "America/New_York",
    "asciiname": "Londonderry",
    "admin1": " New Hampshire",
    "tokens": [
      "Londonderry",
      " New Hampshire",
      " United States"
    ],
    "value": "Londonderry, New Hampshire, United States"
  },
  {
    "country": " United States",
    "timezone": "America/Chicago",
    "asciiname": "New London",
    "admin1": " Wisconsin",
    "tokens": [
      "New London",
      " Wisconsin",
      " United States"
    ],
    "value": "New London, Wisconsin, United States"
  },
  {
    "country": " South Africa",
    "timezone": "Africa/Johannesburg",
    "asciiname": "East London",
    "admin1": " Eastern Cape",
    "tokens": [
      "East London",
      " Eastern Cape",
      " South Africa"
    ],
    "value": "East London, Eastern Cape, South Africa"
  }
]

Human Design Chart API
Endpoint: GET https://api.humandesign.ai/hd-data
Returns a full Human Design chart including energy types, authorities, gates, channels, and profiles based on birth date and location.

Parameter	Type	Required	Description
date	ISO 8601	Yes	Birth date and time (eg 1988-07-22 17:06)
timezone	string	Yes	Timezone (e.g. "Europe/London")
api_key	string	Yes	Your secure API key

Exanple Json Resp

{
  "Properties": {
    "BirthDateLocal": "22nd July 1999 @ 17:00",
    "BirthDateLocal12": "22nd July 1999 @ 05:00 PM",
    "BirthDateUtc": "22nd July 1999 @ 16:00",
    "BirthDateUtc12": "22nd July 1999 @ 04:00 PM",
    "Age": 25,
    "DesignDateUtc": "21st April 1999 @ 23:31",
    "DesignDateUtc12": "21st April 1999 @ 11:31 PM",
    "Type": {
      "Name": "Type",
      "Id": "Manifesting Generator",
      "Option": "Manifesting Generator",
      "Description": "",
      "Link": ""
    },
    "Strategy": {
      "Name": "Strategy",
      "Id": "To Respond & Inform",
      "Option": "To Respond & Inform",
      "Description": "",
      "Link": ""
    },
    "InnerAuthority": {
      "Name": "Inner Authority",
      "Id": "Emotional - Solar Plexus",
      "Option": "Emotional - Solar Plexus",
      "Description": "",
      "Link": ""
    },
    "Definition": {
      "Name": "Definition",
      "Id": "Single Definition",
      "Option": "Single Definition",
      "Description": "",
      "Link": ""
    },
    "Profile": {
      "Name": "Profile",
      "Id": "4/6",
      "Option": "4/6",
      "Description": "",
      "Link": ""
    },
    "IncarnationCross": {
      "Name": "Incarnation Cross",
      "Id": "Right Angle Cross of Laws (56/60 | 3/50)",
      "Option": "Right Angle Cross of Laws (56/60 | 3/50)",
      "Description": "",
      "Link": ""
    },
    "Signature": {
      "Name": "Signature",
      "Id": "Satisfaction",
      "Option": "Satisfaction",
      "Description": "",
      "Link": ""
    },
    "NotSelfTheme": {
      "Name": "Not Self Theme",
      "Id": "Frustration & Anger",
      "Option": "Frustration & Anger",
      "Description": "",
      "Link": ""
    },
    "Digestion": {
      "Name": "Digestion",
      "Id": "Hot",
      "Option": "Hot",
      "Description": "",
      "Link": ""
    },
    "Sense": {
      "Name": "Sense",
      "Id": "Action",
      "Option": "Action",
      "Description": "",
      "Link": ""
    },
    "DesignSense": {
      "Name": "Design Sense",
      "Id": "Taste",
      "Option": "Taste",
      "Description": "",
      "Link": ""
    },
    "Motivation": {
      "Name": "Motivation",
      "Id": "Hope",
      "Option": "Hope",
      "Description": "",
      "Link": ""
    },
    "Perspective": {
      "Name": "Perspective",
      "Id": "Probability",
      "Option": "Probability",
      "Description": "",
      "Link": ""
    },
    "Environment": {
      "Name": "Environment",
      "Id": "Kitchens",
      "Option": "Kitchens",
      "Description": "",
      "Link": ""
    },
    "Miljø": {
      "Name": "Miljø",
      "Id": "Kitchen Humid",
      "Option": "Kitchen Humid",
      "Description": "",
      "Link": ""
    },
    "Gates": {
      "Name": "Gates",
      "Id": "Gates",
      "List": [
        {
          "Option": 56,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 60,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 33,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 19,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 14,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 31,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 13,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 59,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 28,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 41,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 2,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 27,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 9,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 3,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 50,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 4,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 49,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 62,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 17,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 16,
          "Description": "",
          "Link": ""
        },
        {
          "Option": 51,
          "Description": "",
          "Link": ""
        }
      ]
    },
    "Channels": {
      "Name": "Channels",
      "Id": "Channels",
      "List": [
        {
          "Option": "2 - 14",
          "Description": "",
          "Link": ""
        },
        {
          "Option": "3 - 60",
          "Description": "",
          "Link": ""
        },
        {
          "Option": "13 - 33",
          "Description": "",
          "Link": ""
        },
        {
          "Option": "17 - 62",
          "Description": "",
          "Link": ""
        },
        {
          "Option": "19 - 49",
          "Description": "",
          "Link": ""
        },
        {
          "Option": "27 - 50",
          "Description": "",
          "Link": ""
        }
      ]
    }
  },
  "ChartUrl": "humandesign.ai",
  "Personality": {
    "Sun": {
      "Gate": 56,
      "Line": 4,
      "Color": 2,
      "Tone": 3,
      "Base": 4,
      "FixingState": "None"
    },
    "Earth": {
      "Gate": 60,
      "Line": 4,
      "Color": 2,
      "Tone": 3,
      "Base": 4,
      "FixingState": "None"
    },
    "North Node": {
      "Gate": 33,
      "Line": 6,
      "Color": 5,
      "Tone": 5,
      "Base": 1,
      "FixingState": "None"
    },
    "South Node": {
      "Gate": 19,
      "Line": 6,
      "Color": 5,
      "Tone": 5,
      "Base": 1,
      "FixingState": "None"
    },
    "Moon": {
      "Gate": 14,
      "Line": 1,
      "Color": 2,
      "Tone": 1,
      "Base": 1,
      "FixingState": "None"
    },
    "Mercury": {
      "Gate": 31,
      "Line": 5,
      "Color": 2,
      "Tone": 4,
      "Base": 5,
      "FixingState": "None"
    },
    "Uranus": {
      "Gate": 13,
      "Line": 3,
      "Color": 3,
      "Tone": 1,
      "Base": 2,
      "FixingState": "None"
    },
    "Venus": {
      "Gate": 59,
      "Line": 5,
      "Color": 2,
      "Tone": 4,
      "Base": 2,
      "FixingState": "None"
    },
    "Mars": {
      "Gate": 28,
      "Line": 6,
      "Color": 2,
      "Tone": 3,
      "Base": 3,
      "FixingState": "None"
    },
    "Neptune": {
      "Gate": 41,
      "Line": 2,
      "Color": 1,
      "Tone": 6,
      "Base": 2,
      "FixingState": "None"
    },
    "Saturn": {
      "Gate": 2,
      "Line": 3,
      "Color": 6,
      "Tone": 1,
      "Base": 2,
      "FixingState": "None"
    },
    "Jupiter": {
      "Gate": 27,
      "Line": 2,
      "Color": 2,
      "Tone": 5,
      "Base": 3,
      "FixingState": "None"
    },
    "Pluto": {
      "Gate": 9,
      "Line": 3,
      "Color": 2,
      "Tone": 6,
      "Base": 5,
      "FixingState": "None"
    }
  },
  "Design": {
    "Sun": {
      "Gate": 3,
      "Line": 6,
      "Color": 3,
      "Tone": 2,
      "Base": 3,
      "FixingState": "None"
    },
    "Earth": {
      "Gate": 50,
      "Line": 6,
      "Color": 3,
      "Tone": 2,
      "Base": 3,
      "FixingState": "None"
    },
    "North Node": {
      "Gate": 4,
      "Line": 1,
      "Color": 3,
      "Tone": 1,
      "Base": 3,
      "FixingState": "None"
    },
    "South Node": {
      "Gate": 49,
      "Line": 1,
      "Color": 3,
      "Tone": 1,
      "Base": 3,
      "FixingState": "None"
    },
    "Moon": {
      "Gate": 62,
      "Line": 1,
      "Color": 3,
      "Tone": 4,
      "Base": 4,
      "FixingState": "None"
    },
    "Mercury": {
      "Gate": 17,
      "Line": 1,
      "Color": 5,
      "Tone": 4,
      "Base": 3,
      "FixingState": "None"
    },
    "Uranus": {
      "Gate": 13,
      "Line": 4,
      "Color": 3,
      "Tone": 2,
      "Base": 5,
      "FixingState": "None"
    },
    "Venus": {
      "Gate": 16,
      "Line": 6,
      "Color": 4,
      "Tone": 4,
      "Base": 2,
      "FixingState": "None"
    },
    "Mars": {
      "Gate": 28,
      "Line": 4,
      "Color": 2,
      "Tone": 6,
      "Base": 4,
      "FixingState": "None"
    },
    "Neptune": {
      "Gate": 41,
      "Line": 3,
      "Color": 3,
      "Tone": 5,
      "Base": 3,
      "FixingState": "None"
    },
    "Saturn": {
      "Gate": 27,
      "Line": 5,
      "Color": 2,
      "Tone": 6,
      "Base": 4,
      "FixingState": "None"
    },
    "Jupiter": {
      "Gate": 51,
      "Line": 1,
      "Color": 6,
      "Tone": 6,
      "Base": 5,
      "FixingState": "None"
    },
    "Pluto": {
      "Gate": 9,
      "Line": 5,
      "Color": 4,
      "Tone": 5,
      "Base": 4,
      "FixingState": "None"
    }
  },
  "UnconsciousCenters": [],
  "ConsciousCenters": [],
  "DefinedCenters": [
    "Root center",
    "Sacral center",
    "Solar Plexus center",
    "Splenic center",
    "G center",
    "Throat center",
    "Ajna center"
  ],
  "OpenCenters": [
    "Heart center",
    "Head center"
  ],
  "Channels": [
    "2-14",
    "3-60",
    "13-33",
    "17-62",
    "19-49",
    "27-50"
  ],
  "Gates": [
    2,
    3,
    4,
    9,
    13,
    14,
    16,
    17,
    19,
    27,
    28,
    31,
    33,
    41,
    49,
    50,
    51,
    56,
    59,
    60,
    62
  ],
  "Planets": [
    {
      "Id": "Sun",
      "Option": "Sun",
      "Description": ""
    },
    {
      "Id": "Moon",
      "Option": "Moon",
      "Description": ""
    },
    {
      "Id": "Mercury",
      "Option": "Mercury",
      "Description": ""
    },
    {
      "Id": "Venus",
      "Option": "Venus",
      "Description": ""
    },
    {
      "Id": "Mars",
      "Option": "Mars",
      "Description": ""
    },
    {
      "Id": "Jupiter",
      "Option": "Jupiter",
      "Description": ""
    },
    {
      "Id": "Saturn",
      "Option": "Saturn",
      "Description": ""
    },
    {
      "Id": "Uranus",
      "Option": "Uranus",
      "Description": ""
    },
    {
      "Id": "Neptune",
      "Option": "Neptune",
      "Description": ""
    },
    {
      "Id": "Pluto",
      "Option": "Pluto",
      "Description": ""
    },
    {
      "Id": "North Node",
      "Option": "North Node",
      "Description": ""
    },
    {
      "Id": "South Node",
      "Option": "South Node",
      "Description": ""
    },
    {
      "Id": "Chiron",
      "Option": "Chiron",
      "Description": ""
    },
    {
      "Id": "Earth",
      "Option": "Earth",
      "Description": ""
    }
  ],
  "Variables": {
    "Digestion": "left",
    "Environment": "left",
    "Awareness": "left",
    "Perspective": "right"
  },
  "Tooltips": {
    "Centers": [
      {
        "Id": "Root",
        "Option": "Root",
        "Description": ""
      },
      {
        "Id": "Sacral",
        "Option": "Sacral",
        "Description": ""
      },
      {
        "Id": "Solar Plexus",
        "Option": "Solar Plexus",
        "Description": ""
      },
      {
        "Id": "Splenic",
        "Option": "Splenic",
        "Description": ""
      },
      {
        "Id": "Heart",
        "Option": "Heart",
        "Description": ""
      },
      {
        "Id": "G",
        "Option": "G",
        "Description": ""
      },
      {
        "Id": "Throat",
        "Option": "Throat",
        "Description": ""
      },
      {
        "Id": "Ajna",
        "Option": "Ajna",
        "Description": ""
      },
      {
        "Id": "Head",
        "Option": "Head",
        "Description": ""
      }
    ],
    "Channels": [
      {
        "Id": "1 - 8",
        "Option": "1 - 8",
        "Description": ""
      },
      {
        "Id": "2 - 14",
        "Option": "2 - 14",
        "Description": ""
      },
      {
        "Id": "3 - 60",
        "Option": "3 - 60",
        "Description": ""
      },
      {
        "Id": "4 - 63",
        "Option": "4 - 63",
        "Description": ""
      },
      {
        "Id": "5 - 15",
        "Option": "5 - 15",
        "Description": ""
      },
      {
        "Id": "6 - 59",
        "Option": "6 - 59",
        "Description": ""
      },
      {
        "Id": "7 - 31",
        "Option": "7 - 31",
        "Description": ""
      },
      {
        "Id": "9 - 52",
        "Option": "9 - 52",
        "Description": ""
      },
      {
        "Id": "10 - 20",
        "Option": "10 - 20",
        "Description": ""
      },
      {
        "Id": "10 - 34",
        "Option": "10 - 34",
        "Description": ""
      },
      {
        "Id": "10 - 57",
        "Option": "10 - 57",
        "Description": ""
      },
      {
        "Id": "11 - 56",
        "Option": "11 - 56",
        "Description": ""
      },
      {
        "Id": "12 - 22",
        "Option": "12 - 22",
        "Description": ""
      },
      {
        "Id": "13 - 33",
        "Option": "13 - 33",
        "Description": ""
      },
      {
        "Id": "16 - 48",
        "Option": "16 - 48",
        "Description": ""
      },
      {
        "Id": "17 - 62",
        "Option": "17 - 62",
        "Description": ""
      },
      {
        "Id": "18 - 58",
        "Option": "18 - 58",
        "Description": ""
      },
      {
        "Id": "19 - 49",
        "Option": "19 - 49",
        "Description": ""
      },
      {
        "Id": "20 - 34",
        "Option": "20 - 34",
        "Description": ""
      },
      {
        "Id": "20 - 57",
        "Option": "20 - 57",
        "Description": ""
      },
      {
        "Id": "21 - 45",
        "Option": "21 - 45",
        "Description": ""
      },
      {
        "Id": "23 - 43",
        "Option": "23 - 43",
        "Description": ""
      },
      {
        "Id": "24 - 61",
        "Option": "24 - 61",
        "Description": ""
      },
      {
        "Id": "25 - 51",
        "Option": "25 - 51",
        "Description": ""
      },
      {
        "Id": "26 - 44",
        "Option": "26 - 44",
        "Description": ""
      },
      {
        "Id": "27 - 50",
        "Option": "27 - 50",
        "Description": ""
      },
      {
        "Id": "28 - 38",
        "Option": "28 - 38",
        "Description": ""
      },
      {
        "Id": "29 - 46",
        "Option": "29 - 46",
        "Description": ""
      },
      {
        "Id": "30 - 41",
        "Option": "30 - 41",
        "Description": ""
      },
      {
        "Id": "32 - 54",
        "Option": "32 - 54",
        "Description": ""
      },
      {
        "Id": "34 - 57",
        "Option": "34 - 57",
        "Description": ""
      },
      {
        "Id": "35 - 36",
        "Option": "35 - 36",
        "Description": ""
      },
      {
        "Id": "37 - 40",
        "Option": "37 - 40",
        "Description": ""
      },
      {
        "Id": "39 - 55",
        "Option": "39 - 55",
        "Description": ""
      },
      {
        "Id": "42 - 53",
        "Option": "42 - 53",
        "Description": ""
      },
      {
        "Id": "47 - 64",
        "Option": "47 - 64",
        "Description": ""
      }
    ]
  }
}
  