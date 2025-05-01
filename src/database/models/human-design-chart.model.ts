import mongoose, { Document, Schema } from 'mongoose';
import { IHumanDesignChart } from '../../types/models';

// Human Design Chart schema
const humanDesignChartSchema = new Schema<IHumanDesignChart>(
  {
    birthDate: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: function(v: string) {
          return /^\d{4}-\d{2}-\d{2}$/.test(v); // YYYY-MM-DD format
        },
        message: (props: { value: string }) => `${props.value} is not a valid date format! Use YYYY-MM-DD`
      }
    },
    birthTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v: string) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v); // HH:MM format (24-hour)
        },
        message: (props: { value: string }) => `${props.value} is not a valid time format! Use HH:MM (24-hour)`
      }
    },
    birthLocation: {
      type: String,
      required: true,
      index: true
    },
    timezone: {
      type: String,
      required: true
    },
    locationData: {
      type: {
        latitude: Number,
        longitude: Number,
        timezone: String,
        utcOffset: String
      },
      required: false
    },
    chartData: {
      type: Schema.Types.Mixed,
      required: true
    },
    // Quick access to common chart properties
    profile: {
      type: String,
      required: false,
      index: true
    },
    type: {
      type: String,
      required: false,
      index: true
    },
    authority: {
      type: String,
      required: false
    },
    definition: {
      type: String,
      required: false
    },
    centers: {
      type: {
        head: Boolean,
        ajna: Boolean,
        throat: Boolean,
        g: Boolean,
        heart: Boolean,
        solar: Boolean,
        sacral: Boolean,
        spleen: Boolean,
        root: Boolean
      },
      required: false
    },
    channels: {
      type: [String],
      required: false
    },
    gates: {
      type: [Number],
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Create compound index for efficient cache lookups
humanDesignChartSchema.index(
  { birthDate: 1, birthTime: 1, birthLocation: 1 }, 
  { unique: true }
);

// Human Design Chart model
export const HumanDesignChart = mongoose.model<IHumanDesignChart>('HumanDesignChart', humanDesignChartSchema);

// Service functions
export async function findExistingChart(
  birthDate: string,
  birthTime: string,
  birthLocation: string
): Promise<IHumanDesignChart | null> {
  return HumanDesignChart.findOne({
    birthDate,
    birthTime,
    birthLocation
  });
}

export async function createChart(
  chartData: Partial<IHumanDesignChart>
): Promise<IHumanDesignChart> {
  return HumanDesignChart.create(chartData);
}

export async function getChartById(
  chartId: string
): Promise<IHumanDesignChart | null> {
  return HumanDesignChart.findById(chartId);
} 