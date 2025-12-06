export interface RawRowData {
  [key: string]: string | number;
}

export interface TreeMapNode {
  id: string;
  value: number;
  label: string;
  parent?: string;
  children?: TreeMapNode[];
  colorValue?: number;
  region?: string;
  // Dodatkowe dane z Excela - wszystkie kolumny mogą być tutaj przechowywane
  extraData?: {
    [key: string]: string | number | undefined;
  };
}

export interface ParsedData {
  headers: string[];
  rows: RawRowData[];
}

export interface ProcessedRow {
  country: string;
  market: string;
  park: string;
  buildingArea: number;
  occupancy?: number;
  [key: string]: string | number | undefined;
}

