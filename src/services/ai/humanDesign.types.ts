/**
 * Types for Human Design API interactions.
 */

// Response type for /locations endpoint
export interface ILocationTimezone {
  country: string;
  timezone: string; // e.g., "America/New_York"
  asciiname: string; // City/Region name
  admin1: string; // State/Province
  tokens: string[];
  value: string; // Combined display value
}

// Response type for /hd-data endpoint (simplified for brevity)
// Based on the example structure in humandesign_api.md
interface IPropertyItem {
  Name: string;
  Id: string;
  Option: string;
  Description: string;
  Link: string;
}

interface IGateListItem {
  Option: number;
  Description: string;
  Link: string;
}

interface IChannelListItem {
  Option: string; // e.g., "2 - 14"
  Description: string;
  Link: string;
}

interface IPlanetDetail {
  Gate: number;
  Line: number;
  Color: number;
  Tone: number;
  Base: number;
  FixingState: string;
}

interface IPlanetData {
  Sun: IPlanetDetail;
  Earth: IPlanetDetail;
  "North Node": IPlanetDetail;
  "South Node": IPlanetDetail;
  Moon: IPlanetDetail;
  Mercury: IPlanetDetail;
  Venus: IPlanetDetail;
  Mars: IPlanetDetail;
  Jupiter: IPlanetDetail;
  Saturn: IPlanetDetail;
  Uranus: IPlanetDetail;
  Neptune: IPlanetDetail;
  Pluto: IPlanetDetail;
}

export interface IHumanDesignChartResponse {
  Properties: {
    BirthDateLocal: string;
    BirthDateLocal12: string;
    BirthDateUtc: string;
    BirthDateUtc12: string;
    Age: number;
    DesignDateUtc: string;
    DesignDateUtc12: string;
    Type: IPropertyItem;
    Strategy: IPropertyItem;
    InnerAuthority: IPropertyItem;
    Definition: IPropertyItem;
    Profile: IPropertyItem;
    IncarnationCross: IPropertyItem;
    Signature: IPropertyItem;
    NotSelfTheme: IPropertyItem;
    Digestion: IPropertyItem;
    Sense: IPropertyItem;
    DesignSense: IPropertyItem;
    Motivation: IPropertyItem;
    Perspective: IPropertyItem;
    Environment: IPropertyItem;
    Miljø?: IPropertyItem; // Optional based on example
    Gates: {
      Name: string;
      Id: string;
      List: IGateListItem[];
    };
    Channels: {
      Name: string;
      Id: string;
      List: IChannelListItem[];
    };
  };
  ChartUrl: string;
  Personality: IPlanetData;
  Design: IPlanetData;
  DefinedCenters: string[];
  OpenCenters: string[];
  Channels: string[]; // Top-level list of channel strings
  Gates: number[]; // Top-level list of gate numbers
  Variables: {
    Digestion: string;
    Environment: string;
    Awareness: string;
    Perspective: string;
  };
  // Tooltips seem less critical for core functionality, omitted for brevity
}

// Interface for the request payload to /hd-data (inferred)
export interface IGetChartRequest {
  date: string; // ISO 8601 format: YYYY-MM-DD HH:MM
  timezone: string; // e.g., "Europe/London"
}

export interface IHumanDesignTimezoneResponse {
  // Placeholder for timezone data
  timezone: string;
}

// Add other response interfaces as needed... 