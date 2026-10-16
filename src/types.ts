export type KPICategory =
  | "save_lives"
  | "ecosystem"
  | "architecture"
  | "big_push"
  | "unity"
  | "secretariat"
  | "partnership"
  | "broader_goals";

export type UnitySubcategory = "engage" | "align" | "enable" | "act" | "impact";

export type RAGStatus = "green" | "amber" | "red" | "pending";

export type KPIOwner = "secretariat" | "partnership" | "joint" | string;

export type TrendDirection = "up" | "down" | "stable" | "pending";

export type DataQualityRating = "high" | "moderate" | "low" | "unrated";
export type DataAccessLevel = "accessible" | "manual" | "restricted" | "unrated";
export type StrategicHierarchyView = "unity_blocks" | "big_push_pillars";

export interface KPI {
  id: string;
  name: string;
  category: KPICategory;
  subcategory?: UnitySubcategory;
  pillar?: string;
  pillarActions?: string;
  bcgMaps?: string;
  bcgMissing?: string;
  wgComments?: string;
  unit: string;
  value: number | null;
  target: number | null;
  baseline: number | null;
  baselineYear?: number;
  latestReportedYear?: number;
  status: RAGStatus;
  owner: KPIOwner;
  description: string;
  trend: TrendDirection;
  supports: string[];
  yearValues?: { [year: number]: number };

  // RBM Unity 30 Extended Properties (from Google Sheet Columns A–W)
  kpiCode?: string;
  definition?: string;
  unityStep?: string;
  strategicGoal?: string;
  subKpiRef?: string;
  archetypeOwner?: string;
  source?: string;
  cadence?: string;
  reporter?: string;
  group?: string;

  // Data Quality & Accessibility (from Google Sheet Columns U, V & W)
  dataQuality?: DataQualityRating;
  dataAccess?: DataAccessLevel;
  qualityColor?: string;
  accessColor?: string;
  qualityTrafficLight?: "green" | "yellow" | "red" | "unrated";
  accessTrafficLight?: "green" | "yellow" | "red" | "unrated";
  dataQualityNotes?: string;
  calculationFormula?: string;
  dataNuances?: string;
  comments?: string;
  isUnity30?: boolean;
  bigPushPillarId?: 1 | 2 | 3 | 4 | 5 | 6;
  bigPushPillarName?: string;
}

export interface BigPushProposedKPI {
  rbmCategory: string;
  statedMetric: string;
  proposedKpi: string;
  bcgMapped: string;
  bcgMissing: string;
  rationale: string;
  wgComments: string;
}

export interface BigPushPillarSpec {
  id: string;
  pillarNum: number;
  title: string;
  actions: string;
  proposedKPIs: BigPushProposedKPI[];
}

export type SheetTermsMap = Record<string, string>;

export type TimeHorizon = "2026_workplan" | "unity_30" | "long_term_2030";

export interface SheetSyncLog {
  timestamp: string;
  spreadsheetId: string;
  sheetsChecked: string[];
  totalUpdated: number;
  flaggedLowQuality: string[];
  flaggedRestricted: string[];
  missingEntries: string[];
  status: "success" | "error" | "pending";
  message?: string;
}
