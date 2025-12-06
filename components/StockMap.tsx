"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { toPng } from "html-to-image";
import { TreeMapNode } from "@/types/data";

interface StockMapProps {
  data: TreeMapNode | null;
  availableHeaders?: string[]; // Opcjonalne nagłówki z Excela dla sortowania
}

// Stała paleta kolorów - mniej intensywne (pastelowe)
const REGION_COLORS: Record<string, string> = {
  "PL-Central Poland": "#60a5fa", // Pastelowy niebieski
  "PL-Poznan": "#a78bfa",         // Pastelowy fiolet
  "PL-Upper Silesia": "#34d399",  // Pastelowa zieleń
  "PL-Warsaw": "#fbbf24",         // Pastelowy bursztyn
  "PL-Wroclaw": "#f87171",        // Pastelowy czerwony
  "PL-Lower Silesia": "#22d3ee",  // Pastelowy cyjan
  "PL-South": "#84cc16",          // Pastelowa limonka
  "PL-North": "#f472b6",          // Pastelowy różowy
};

// Funkcja generująca kolor z tekstu (dla regionów spoza listy)
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

// Funkcja rozjaśniająca kolor (tworzy pastelowy odcień)
const lightenColor = (color: string, amount: number = 0.3): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Rozjaśniamy kolor mieszając z białym
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  
  return `rgb(${newR}, ${newG}, ${newB})`;
};

const getColorByRegion = (regionName: string) => {
  // 1. Sprawdź zdefiniowaną paletę (już pastelowe)
  if (REGION_COLORS[regionName]) return REGION_COLORS[regionName];
  // 2. Jeśli brak regionu w palecie, wygeneruj kolor dynamicznie i rozjaśnij
  if (regionName) {
    const generatedColor = stringToColor(regionName);
    return lightenColor(generatedColor, 0.4); // Rozjaśniamy wygenerowane kolory
  }
  // 3. Ostateczny fallback (szary pastelowy)
  return "#9ca3af";
};

// Funkcja tworząca różne odcienie koloru bazowego dla parków w tym samym regionie
const getTileColor = (baseColor: string, index: number, total: number) => {
  if (total === 1) return baseColor;
  
  // Konwertuj hex na RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Tworzymy gradient od ciemniejszego do jaśniejszego odcienia
  // Największy kafelek (index 0) jest najciemniejszy, najmniejsze są jaśniejsze
  const brightnessFactor = 0.7 + (index / total) * 0.3; // Od 0.7 do 1.0
  
  const newR = Math.round(Math.min(255, r * brightnessFactor));
  const newG = Math.round(Math.min(255, g * brightnessFactor));
  const newB = Math.round(Math.min(255, b * brightnessFactor));
  
  return `rgb(${newR}, ${newG}, ${newB})`;
};

// Funkcja tworząca CustomTooltip z dostępem do sortBy i availableColumns
const createCustomTooltip = (sortBy: string, availableColumns: Array<{ key: string; label: string }>) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const region = data?.region || data?.originalRegion || "Unknown";
    const name = data?.name || "Unknown";
    const value = data?.value || 0; // Oryginalna powierzchnia
    const colorValue = data?.colorValue; // occupancy
    const tileIndex = data?.tileIndex ?? 0;
    const totalTiles = data?.totalTiles ?? 1;
    const extraData = data?.extraData || {};

    // Funkcja pomocnicza do znajdowania wartości BUILDING AREA
    const getBuildingAreaFromExtraData = (): number | null => {
      const keys = Object.keys(extraData);
      const buildingAreaKey = keys.find(key => 
        key.toLowerCase().includes('building') && key.toLowerCase().includes('area')
      );
      if (!buildingAreaKey) return null;
      const buildingAreaValue = extraData[buildingAreaKey];
      if (buildingAreaValue === undefined || buildingAreaValue === null || buildingAreaValue === '') return null;
      
      // Konwersja na liczbę
      if (typeof buildingAreaValue === 'number') {
        return buildingAreaValue;
      }
      const numValue = parseFloat(String(buildingAreaValue).replace(/,/g, ''));
      return isNaN(numValue) ? null : numValue;
    };

    // Funkcja pomocnicza do znajdowania klucza BUILDING AREA
    const getBuildingAreaKeyFromExtraData = (): string | null => {
      const keys = Object.keys(extraData);
      const buildingAreaKey = keys.find(key => 
        key.toLowerCase().includes('building') && key.toLowerCase().includes('area')
      );
      return buildingAreaKey || null;
    };

    // Funkcja do pobierania wartości z aktualnego sortowania
    const getSortValue = (): { label: string; value: string | number } | null => {
      if (sortBy === 'value') {
        // Gdy sortujemy po value, nie pokazujemy tego jako osobne pole (bo już jest BUILDING AREA)
        return null;
      }
      
      if (sortBy === 'name') {
        return { label: 'Name', value: name };
      }
      
      if (sortBy === 'region') {
        return { label: 'Region', value: region };
      }
      
      // Dla kolumn z extraData
      if (sortBy.startsWith('extra_')) {
        const columnName = sortBy.replace('extra_', '');
        const extraDataValue = extraData[columnName];
        const columnLabel = availableColumns?.find(col => col.key === sortBy)?.label || columnName;
        
        if (extraDataValue !== undefined && extraDataValue !== null && extraDataValue !== '') {
          let formattedValue: string;
          if (typeof extraDataValue === 'number') {
            formattedValue = extraDataValue.toLocaleString();
          } else {
            const numValue = parseFloat(String(extraDataValue).replace(/,/g, '').replace(/%/g, ''));
            if (!isNaN(numValue)) {
              formattedValue = numValue.toLocaleString();
              if (String(extraDataValue).includes('%')) {
                formattedValue += '%';
              }
            } else {
              formattedValue = String(extraDataValue);
            }
          }
          return { label: columnLabel, value: formattedValue };
        }
      }
      
      return null;
    };

    const sortInfo = getSortValue();
    const buildingAreaKey = getBuildingAreaKeyFromExtraData();

    return (
      <div 
        className="bg-white border border-gray-300 rounded-lg shadow-xl p-4"
        style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
      >
        <div className="font-bold text-lg mb-2 text-gray-800">{name}</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Region:</span>
            <span className="font-semibold text-gray-800">{region}</span>
          </div>
          {/* Aktualnie sortowane kryterium (jeśli nie jest to value) */}
          {sortInfo && (
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
              <span className="text-gray-600">{sortInfo.label}:</span>
              <span className="font-semibold text-gray-800">{sortInfo.value}</span>
            </div>
          )}
          {/* BUILDING AREA - używamy nazwy kolumny z Excela */}
          {buildingAreaKey && (
            <div className="flex justify-between">
              <span className="text-gray-600">{buildingAreaKey}:</span>
              <span className="font-semibold text-gray-800">
                {(() => {
                  const buildingArea = getBuildingAreaFromExtraData();
                  if (buildingArea !== null) {
                    return `${buildingArea.toLocaleString()} m²`;
                  }
                  return `${value.toLocaleString()} m²`;
                })()}
              </span>
            </div>
          )}
          {colorValue !== undefined && colorValue !== null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Occupancy:</span>
              <span className="font-semibold text-gray-800">{(colorValue * 100).toFixed(1)}%</span>
            </div>
          )}
          {/* Pozostałe kolumny z extraData */}
          {Object.keys(extraData).filter(key => {
            // Pomijamy kolumnę używaną do sortowania (już wyświetlona wyżej)
            const currentColumnName = sortBy.startsWith('extra_') ? sortBy.replace('extra_', '') : '';
            // Pomijamy też BUILDING AREA (już wyświetlone wyżej)
            const isBuildingArea = key.toLowerCase().includes('building') && key.toLowerCase().includes('area');
            return key !== currentColumnName && !isBuildingArea && extraData[key] !== undefined && extraData[key] !== null && extraData[key] !== '';
          }).map(key => {
            const extraValue = extraData[key];
            let formattedExtraValue: string;
            if (typeof extraValue === 'number') {
              formattedExtraValue = extraValue.toLocaleString();
            } else {
              const numValue = parseFloat(String(extraValue).replace(/,/g, '').replace(/%/g, ''));
              if (!isNaN(numValue)) {
                formattedExtraValue = numValue.toLocaleString();
                if (String(extraValue).includes('%')) {
                  formattedExtraValue += '%';
                }
              } else {
                formattedExtraValue = String(extraValue);
              }
            }
            return (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}:</span>
                <span className="font-semibold text-gray-800">{formattedExtraValue}</span>
              </div>
            );
          })}
          <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
            <span className="text-gray-600">Position in region:</span>
            <span className="font-semibold text-gray-800">{tileIndex + 1} / {totalTiles}</span>
          </div>
        </div>
      </div>
    );
  };
  CustomTooltip.displayName = 'CustomTooltip';
  return CustomTooltip;
};

// Funkcja tworząca StockTile z dostępem do sortBy i availableColumns
const createStockTile = (sortBy: string, availableColumns: Array<{ key: string; label: string }>) => {
  const StockTile = (props: any) => {
    // 1. Destrukturyzacja props - dodajemy extraData i region bezpośrednio z props
    const { x, y, width, height, name, value, payload, extraData: propsExtraData, region: propsRegion } = props;

    // Ignorujemy parent nodes
    if (payload?.children && payload.children.length > 0) {
      return <g />;
    }

    // 2. Ustalanie regionu - priorytet dla props, potem payload
    let region = "Unknown";
    let tileIndex = 0;
    let totalTiles = 1;

    // Próba pobrania z props (najpewniejsze dla custom fields w Treemap)
    if (propsRegion) region = propsRegion;
    if (props.tileIndex !== undefined) tileIndex = props.tileIndex;
    if (props.totalTiles !== undefined) totalTiles = props.totalTiles;

    // Fallback do payload jeśli w props nie ma
    if (region === "Unknown" && payload) {
      if (payload.region) region = payload.region;
      if (payload.originalRegion) region = payload.originalRegion;
      if (payload.root && payload.root.region) region = payload.root.region;
      if (payload.tileIndex !== undefined) tileIndex = payload.tileIndex;
      if (payload.totalTiles !== undefined) totalTiles = payload.totalTiles;
    }

    // 3. KLUCZOWA POPRAWKA: Bezpieczny dostęp do extraData
    // Recharts często spłaszcza dane obiektu na props, więc szukamy ich w propsExtraData
    // a jeśli tam nie ma, to w payload.extraData
    const dataDetails = propsExtraData || payload?.extraData || {};

    // Jeśli kafelek jest mikroskopijny, nie renderuj
    if (width < 5 || height < 5) return <g />;

    const baseRegionColor = getColorByRegion(region);
    const bgColor = getTileColor(baseRegionColor, tileIndex, totalTiles);
    
    // Pokazuj tekst tylko jeśli kafelek jest wystarczająco duży
    const showDetailText = width > 60 && height > 40;

    // Funkcja pomocnicza do znajdowania klucza kolumny BUILDING AREA
    const getBuildingAreaKey = (): string | null => {
      const keys = Object.keys(dataDetails);
      const buildingAreaKey = keys.find(key => 
        key.toLowerCase().includes('building') && key.toLowerCase().includes('area')
      );
      return buildingAreaKey || null;
    };

    // Funkcja do pobierania wartości BUILDING AREA
    const getBuildingAreaValue = (): number | null => {
      const buildingAreaKey = getBuildingAreaKey();
      if (!buildingAreaKey) return null;
      
      const buildingAreaValue = dataDetails[buildingAreaKey];
      if (buildingAreaValue === undefined || buildingAreaValue === null || buildingAreaValue === '') return null;
      
      if (typeof buildingAreaValue === 'number') {
        return buildingAreaValue;
      }
      const numValue = parseFloat(String(buildingAreaValue).replace(/,/g, ''));
      return isNaN(numValue) ? null : numValue;
    };

    // Funkcja do pobierania wartości do wyświetlenia
    const getDisplayValue = (): { label: string; value: string } => {
      // Pobieramy aktualne sortowanie z argumentu funkcji lub propsów
      const currentSortBy = sortBy || props.sortBy || payload?.sortBy || 'value';
      
      if (currentSortBy === 'value') {
        const buildingArea = getBuildingAreaValue();
        if (buildingArea !== null) {
          return { label: '', value: `${buildingArea.toLocaleString()} m²` };
        }
        return { label: '', value: `${value.toLocaleString()} m²` };
      }
      
      if (currentSortBy === 'name') {
        return { label: '', value: name };
      }
      
      if (currentSortBy === 'region') {
        return { label: '', value: region };
      }
      
      // Dla kolumn z extraData (np. extra_CAP VALUE/AREA)
      if (currentSortBy.startsWith('extra_')) {
        const columnName = currentSortBy.replace('extra_', '');
        
        // POPRAWKA: Korzystamy z dataDetails zamiast payload.extraData
        const extraDataValue = dataDetails[columnName];
        
        if (extraDataValue !== undefined && extraDataValue !== null && extraDataValue !== '') {
          let formattedValue: string;
          if (typeof extraDataValue === 'number') {
            formattedValue = extraDataValue.toLocaleString();
          } else {
            const numValue = parseFloat(String(extraDataValue).replace(/,/g, '').replace(/%/g, ''));
            if (!isNaN(numValue)) {
              formattedValue = numValue.toLocaleString();
              // Zachowujemy znak %, jeśli był w oryginale lub nazwa kolumny to sugeruje
              if (String(extraDataValue).includes('%') || columnName.includes('%')) {
                formattedValue += '%';
              }
            } else {
              formattedValue = String(extraDataValue);
            }
          }
          return { label: '', value: formattedValue };
        }
        return { label: '', value: '' }; // Jeśli brak danych dla tej kolumny
      }
      
      return { label: '', value: '' };
    };

    const displayInfo = getDisplayValue();
    const borderColor = "#ffffff";
    const borderWidth = 2; // Nieco cieńsze ramki dla elegancji

    // Funkcja do dzielenia tekstu na dwie linie, jeśli nie mieści się w jednej
    const splitTextIntoLines = (text: string, maxWidth: number, fontSize: number): string[] => {
      // Padding z każdej strony (8px)
      const padding = 16;
      const availableWidth = maxWidth - padding;
      
      // Przybliżona szerokość jednego znaku (około 0.6 * fontSize)
      const charWidth = fontSize * 0.6;
      const maxChars = Math.floor(availableWidth / charWidth);
      
      // Jeśli tekst się mieści w jednej linii, zwróć go jako pojedynczy element
      if (text.length <= maxChars) {
        return [text];
      }
      
      // Próbujemy podzielić w miejscu spacji (najlepiej w połowie)
      const midPoint = Math.floor(text.length / 2);
      
      // Szukamy spacji w okolicy środka tekstu
      let splitIndex = midPoint;
      const searchRange = Math.floor(text.length * 0.3); // Szukamy w zakresie 30% długości
      
      // Szukamy spacji najbliżej środka
      for (let i = 0; i <= searchRange; i++) {
        const leftIndex = midPoint - i;
        const rightIndex = midPoint + i;
        
        if (leftIndex > 0 && text[leftIndex] === ' ') {
          splitIndex = leftIndex;
          break;
        }
        if (rightIndex < text.length && text[rightIndex] === ' ') {
          splitIndex = rightIndex;
          break;
        }
      }
      
      // Jeśli nie znaleźliśmy spacji, dzielimy na pół
      if (splitIndex === midPoint && text[splitIndex] !== ' ') {
        splitIndex = midPoint;
      }
      
      const firstLine = text.substring(0, splitIndex).trim();
      const secondLine = text.substring(splitIndex).trim();
      
      return [firstLine, secondLine];
    };

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: bgColor,
            stroke: borderColor,
            strokeWidth: borderWidth,
            rx: 0, // Bardziej "biznesowy", prostokątny wygląd (zamiast zaokrągleń)
            ry: 0,
            cursor: 'pointer'
          }}
          className="hover:opacity-90 transition-opacity"
        />

        {showDetailText && (() => {
          const nameLines = splitTextIntoLines(name, width, 14);
          const isTwoLines = nameLines.length === 2;
          
          // Obliczamy pozycję nazwy - wyżej dla lepszego odstępu
          const nameBaseY = y + height / 2 - (isTwoLines ? 12 : 14);
          
          // Obliczamy pozycję wartości - niżej, z odpowiednim odstępem od nazwy
          const valueOffset = isTwoLines ? 18 : 14; // Zmniejszony odstęp między nazwą a wartością
          const valueY = y + height / 2 + valueOffset;
          
          return (
            <g style={{ pointerEvents: "none" }}>
              {/* Nazwa - Minimalistyczna czcionka, podzielona na dwie linie jeśli potrzeba */}
              {nameLines.map((line, index) => (
                <text
                  key={index}
                  x={x + width / 2}
                  y={nameBaseY + (index * 18)} // Większy odstęp między liniami (18px)
                  textAnchor="middle"
                  fill="#ffffff"
                  style={{
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
                    fontWeight: "400", // Normalna waga
                    fontSize: "14px", // Nieco mniejsza dla minimalizmu
                    textShadow: "0px 1px 3px rgba(0,0,0,0.8)" // Cień dla czytelności
                  }}
                >
                  {line}
                </text>
              ))}

              {/* Wartość - Wyraźna, z cieniem, dobrze oddzielona od nazwy */}
              {displayInfo.value && (
                <text
                  x={x + width / 2}
                  y={valueY} // Stała pozycja z odpowiednim odstępem
                  textAnchor="middle"
                  fill="#ffffff" // Czysta biel
                  style={{
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
                    fontWeight: "400", // Normalna waga
                    fontSize: "13px", // Nieco mniejsza dla minimalizmu
                    textShadow: "0px 1px 3px rgba(0,0,0,0.8)" // Cień dla czytelności
                  }}
                >
                  {displayInfo.value}
                </text>
              )}
            </g>
          );
        })()}
      </g>
    );
  };
  StockTile.displayName = 'StockTile';
  return StockTile;
};

export function StockMap({ data, availableHeaders = [] }: StockMapProps) {
  // --- 1. Konfiguracja Referencji i Pobierania ---
  const mapRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = useCallback(async () => {
    // Sprawdzenie czy jesteśmy w środowisku przeglądarki
    if (typeof window === 'undefined' || mapRef.current === null) {
      return;
    }

    try {
      const dataUrl = await toPng(mapRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 3, // ZWIĘKSZONO JAKOŚĆ (3x rozdzielczość ekranu)
        style: {
          fontFamily: 'Arial, Helvetica, sans-serif', // Wymuszenie czytelnej czcionki na obrazku
        },
        filter: (node) => {
          const exclusionClasses = ["exclude-from-capture"];
          return !exclusionClasses.some((classname) =>
            node.classList?.contains(classname)
          );
        },
      });

      // Dodatkowe sprawdzenie przed użyciem document
      if (typeof document !== 'undefined') {
        const link = document.createElement("a");
        link.download = `poland-market-map-presentation-${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error("Error generating image:", err);
    }
  }, []);

  // Funkcja pomocnicza do znajdowania dostępnych kolumn do sortowania
  const getAvailableSortColumns = useMemo(() => {
    const columns: Array<{ key: string; label: string }> = [
      { key: 'value', label: 'By Area (m²)' },
      { key: 'name', label: 'Alphabetically (A-Z)' },
      { key: 'region', label: 'By Region' },
    ];

    // Funkcja pomocnicza do sprawdzania, czy kolumna ma niepuste dane
    const hasDataInColumn = (columnKey: string, dataToCheck: any[]): boolean => {
      if (!dataToCheck || dataToCheck.length === 0) return false;
      
      // Podstawowe kolumny zawsze mają dane
      if (columnKey === 'value' || columnKey === 'name' || columnKey === 'region') {
        return true;
      }
      
      // Sprawdzamy kolumny z extraData
      if (columnKey.startsWith('extra_')) {
        const columnName = columnKey.replace('extra_', '');
        // Sprawdzamy wszystkie parki we wszystkich regionach
        for (const region of dataToCheck) {
          if (region.children && region.children.length > 0) {
            for (const child of region.children) {
              const extraDataValue = child.extraData?.[columnName];
              // Kolumna ma dane, jeśli przynajmniej jeden park ma niepustą wartość
              if (extraDataValue !== undefined && extraDataValue !== null && extraDataValue !== '') {
                return true;
              }
            }
          }
        }
      }
      
      return false;
    };

    // Najpierw pobieramy dane, aby sprawdzić które kolumny mają wartości
    let tempData: any[] = [];
    if (data?.children) {
      const countryNode = data.children.find(c => 
        c.label === "Poland" || c.label.toLowerCase().includes("poland")
      ) || data.children[0];
      
      if (countryNode?.children) {
        tempData = countryNode.children.map(region => ({
          name: region.label || region.region || "Unknown",
          children: (region.children || []).map((child: any) => ({
            label: child.label,
            value: child.value,
            region: region.label || region.region || "Unknown",
            extraData: child.extraData,
          })),
          value: region.value
        }));
      }
    }

    // Dodajemy kolumny z Excela, jeśli są dostępne
    if (availableHeaders.length > 0) {
      // Mapowanie popularnych nazw kolumn na czytelne etykiety
      const columnLabels: Record<string, string> = {
        'BUILDING AREA': 'Building Area',
        'CAP VALUE/AREA': 'Cap Value/Area',
        'VAULT': 'Vault',
        'OCCUPANCY %': 'Occupancy %',
        '# OF VIEWINGS 2025': '# of Viewings 2025',
        '# OF OPPS IN 2025': '# of Opps in 2025',
      };

      availableHeaders.forEach(header => {
        const cleanHeader = header.trim();
        // Pomijamy podstawowe kolumny, które już są w sortowaniu
        if (!cleanHeader.toLowerCase().includes('country') &&
            !cleanHeader.toLowerCase().includes('park') &&
            !cleanHeader.toLowerCase().includes('bucket') &&
            !(cleanHeader.toLowerCase().includes('market') || cleanHeader.toLowerCase().includes('prologis'))) {
          const columnKey = `extra_${cleanHeader}`;
          // Dodajemy tylko jeśli kolumna ma dane
          if (hasDataInColumn(columnKey, tempData)) {
            const label = columnLabels[cleanHeader] || cleanHeader;
            columns.push({ key: columnKey, label });
          }
        }
      });
    } else {
      // Jeśli nie mamy nagłówków, próbujemy znaleźć je w danych
      if (data?.children) {
        const countryNode = data.children.find(c => 
          c.label === "Poland" || c.label.toLowerCase().includes("poland")
        ) || data.children[0];
        
        if (countryNode?.children) {
          const firstRegion = countryNode.children[0];
          if (firstRegion?.children && firstRegion.children.length > 0) {
            const firstPark = firstRegion.children[0];
            if (firstPark?.extraData) {
              Object.keys(firstPark.extraData).forEach(key => {
                const columnKey = `extra_${key}`;
                // Dodajemy tylko jeśli kolumna ma dane
                if (hasDataInColumn(columnKey, tempData)) {
                  columns.push({ key: columnKey, label: key });
                }
              });
            }
          }
        }
      }
    }

    return columns;
  }, [data, availableHeaders]);

  // Stan sortowania - domyślnie po powierzchni (value)
  const [sortBy, setSortBy] = useState<string>('value');
  
  // Stan widoku - domyślnie widok regionów
  const [viewMode, setViewMode] = useState<'regions' | 'country'>('regions');

  // Funkcja transformująca dane do widoku płaskiego (bez regionów)
  const transformToFlatCountry = useCallback((regionsData: any[]) => {
    if (!regionsData || regionsData.length === 0) return [];
    
    // Zbieramy wszystkie parki ze wszystkich regionów do jednej listy
    let allParks: any[] = [];
    
    regionsData.forEach(region => {
      if (region.children && region.children.length > 0) {
        // Dodajemy wszystkie parki z regionu, zachowując informację o oryginalnym regionie
        const parksWithRegion = region.children.map((park: any) => ({
          ...park,
          originalRegion: region.name, // Zachowujemy informację o regionie dla tooltipa i kolorowania
          region: region.name, // Upewniamy się, że region jest ustawiony
        }));
        allParks = [...allParks, ...parksWithRegion];
      }
    });
    
    // Funkcja pomocnicza do znajdowania wartości BUILDING AREA z extraData
    const getBuildingAreaValue = (park: any): number | null => {
      if (!park.extraData) return null;
      const keys = Object.keys(park.extraData);
      const buildingAreaKey = keys.find(key => 
        key.toLowerCase().includes('building') && key.toLowerCase().includes('area')
      );
      if (!buildingAreaKey) return null;
      const buildingAreaValue = park.extraData[buildingAreaKey];
      if (buildingAreaValue === undefined || buildingAreaValue === null || buildingAreaValue === '') return null;
      
      if (typeof buildingAreaValue === 'number') {
        return buildingAreaValue;
      }
      const numValue = parseFloat(String(buildingAreaValue).replace(/,/g, ''));
      return isNaN(numValue) ? null : numValue;
    };

    // Funkcja pomocnicza do pobierania wartości do sortowania
    const getSortValue = (park: any, sortKey: string): number | string => {
      if (sortKey === 'value') {
        const buildingArea = getBuildingAreaValue(park);
        return buildingArea !== null ? buildingArea : (park.value || 0);
      }
      if (sortKey === 'name') {
        return (park.name || '').toLowerCase();
      }
      if (sortKey === 'region') {
        return (park.originalRegion || park.region || '').toLowerCase();
      }
      if (sortKey.startsWith('extra_')) {
        const columnName = sortKey.replace('extra_', '');
        const extraDataValue = park.extraData?.[columnName];
        if (extraDataValue === undefined || extraDataValue === null || extraDataValue === '') {
          return '';
        }
        if (typeof extraDataValue === 'number') {
          return extraDataValue;
        }
        const numValue = parseFloat(String(extraDataValue).replace(/,/g, '').replace(/%/g, ''));
        if (!isNaN(numValue)) {
          return numValue;
        }
        return String(extraDataValue).toLowerCase();
      }
      return '';
    };

    // Funkcja pomocnicza do obliczania wartości sortowania jako liczba (dla rozmiaru kafelka)
    const getSortValueAsNumber = (park: any, sortKey: string): number => {
      const sortValue = getSortValue(park, sortKey);
      
      if (typeof sortValue === 'number') {
        return sortValue;
      }
      
      if (typeof sortValue === 'string') {
        const numValue = parseFloat(sortValue);
        if (!isNaN(numValue)) {
          return numValue;
        }
        return 0;
      }
      
      return 0;
    };

    // Sortujemy wszystkie parki według wybranego kryterium
    const sortedParks = [...allParks].sort((a, b) => {
      const valueA = getSortValue(a, sortBy);
      const valueB = getSortValue(b, sortBy);
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueB - valueA;
      }
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        if (sortBy === 'value') {
          const numA = parseFloat(valueA) || 0;
          const numB = parseFloat(valueB) || 0;
          return numB - numA;
        }
        return valueA.localeCompare(valueB);
      }
      if (typeof valueA === 'number') return -1;
      if (typeof valueB === 'number') return 1;
      return 0;
    });

    // Tworzymy jedną grupę "Poland" z wszystkimi parkami
    // Obliczamy wartości sortowania dla każdego parka
    const parksWithIndex = sortedParks.map((park, index) => {
      const sortValueNum = getSortValueAsNumber(park, sortBy);
      const finalSortValue = (sortBy === 'name' || sortBy === 'region') 
        ? park.value // Dla sortowania alfabetycznego, zachowujemy oryginalny rozmiar
        : (sortValueNum > 0 ? sortValueNum : park.value); // Dla numerycznego, używamy wartości sortowania
      
      return {
        ...park,
        sortValue: finalSortValue, // Wartość używana do sortowania i rozmiaru kafelka
        tileIndex: index,
        totalTiles: sortedParks.length,
      };
    });

    // Obliczamy całkowitą wartość
    const totalValue = parksWithIndex.reduce((sum, park) => sum + park.value, 0);
    const totalSortValue = parksWithIndex.reduce((sum, park) => sum + (park.sortValue || park.value), 0);

    return [{
      name: 'Poland',
      children: parksWithIndex,
      value: totalValue,
      sortValue: totalSortValue,
    }];
  }, [sortBy]);
  
  // Przetwarzanie danych
  // Struktura: Root -> Poland (Country) -> Markets (PROLOGIS MARKET) -> Parks
  // Zakładamy, że wszystkie dane są z Poland, więc możemy użyć pierwszego węzła kraju
  const processedData = useMemo(() => {
    if (!data || !data.children) return [];

    // Jeśli wszystkie dane są z Poland, używamy pierwszego (i jedynego) węzła kraju
    // Fallback do wyszukiwania "Poland" na wypadek innych nazw
    const countryNode = data.children.find(c => 
      c.label === "Poland" || c.label.toLowerCase().includes("poland")
    ) || data.children[0] || data;

    if (!countryNode || !countryNode.children) return [];

    // Spłaszczamy strukturę dla Treemap
    // Każdy region (Market z PROLOGIS MARKET) staje się grupą z parkami jako dziećmi
    // Recharts Treemap potrzebuje struktury: { name: 'Region', children: [ {name: 'Prop', value: 100} ] }
    
    // Funkcja pomocnicza do znajdowania wartości BUILDING AREA z extraData
    const getBuildingAreaValue = (child: any): number | null => {
      if (!child.extraData) return null;
      const keys = Object.keys(child.extraData);
      const buildingAreaKey = keys.find(key => 
        key.toLowerCase().includes('building') && key.toLowerCase().includes('area')
      );
      if (!buildingAreaKey) return null;
      const buildingAreaValue = child.extraData[buildingAreaKey];
      if (buildingAreaValue === undefined || buildingAreaValue === null || buildingAreaValue === '') return null;
      
      // Konwersja na liczbę
      if (typeof buildingAreaValue === 'number') {
        return buildingAreaValue;
      }
      const numValue = parseFloat(String(buildingAreaValue).replace(/,/g, ''));
      return isNaN(numValue) ? null : numValue;
    };

    // Funkcja pomocnicza do pobierania wartości do sortowania
    const getSortValue = (child: any, sortKey: string): number | string => {
      if (sortKey === 'value') {
        // Używamy BUILDING AREA zamiast value
        const buildingArea = getBuildingAreaValue(child);
        return buildingArea !== null ? buildingArea : (child.value || 0);
      }
      if (sortKey === 'name') {
        return (child.label || '').toLowerCase();
      }
      if (sortKey === 'region') {
        return (child.region || '').toLowerCase();
      }
      
      // Sortowanie po kolumnach z extraData
      if (sortKey.startsWith('extra_')) {
        const columnName = sortKey.replace('extra_', '');
        const extraDataValue = child.extraData?.[columnName];
        
        if (extraDataValue === undefined || extraDataValue === null || extraDataValue === '') {
          return '';
        }
        
        // Próba konwersji na liczbę
        if (typeof extraDataValue === 'number') {
          return extraDataValue;
        }
        
        const numValue = parseFloat(String(extraDataValue).replace(/,/g, '').replace(/%/g, ''));
        if (!isNaN(numValue)) {
          return numValue;
        }
        
        // Jeśli nie da się przekonwertować na liczbę, traktujemy jako string
        return String(extraDataValue).toLowerCase();
      }
      
      return '';
    };

    // Funkcja pomocnicza do obliczania wartości sortowania jako liczba (dla rozmiaru kafelka)
    const getSortValueAsNumber = (child: any, sortKey: string): number => {
      const sortValue = getSortValue(child, sortKey);
      
      if (typeof sortValue === 'number') {
        return sortValue;
      }
      
      if (typeof sortValue === 'string') {
        // Próba konwersji na liczbę
        const numValue = parseFloat(sortValue);
        if (!isNaN(numValue)) {
          return numValue;
        }
        // Jeśli to string (np. nazwa), używamy hash aby stworzyć wartość numeryczną
        // Ale lepiej użyć wartości alfabetycznej - wtedy kafelki będą równe
        // Użyjemy indeksu w posortowanej liście
        return 0; // Dla stringów, będziemy używać oryginalnej wartości area dla rozmiaru
      }
      
      return 0;
    };

    // Funkcja sortująca parki wewnątrz regionu
    const sortChildren = (children: any[]) => {
      const childrenCopy = [...children];
      
      return childrenCopy.sort((a, b) => {
        const valueA = getSortValue(a, sortBy);
        const valueB = getSortValue(b, sortBy);
        
        // Jeśli wartości są liczbami, sortuj malejąco (dla value i kolumn numerycznych)
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return valueB - valueA; // Malejąco dla wartości numerycznych
        }
        
        // Jeśli wartości są stringami, sortuj alfabetycznie
        if (typeof valueA === 'string' && typeof valueB === 'string') {
          // Dla sortowania po wartości, traktujemy jako numeryczne
          if (sortBy === 'value') {
            const numA = parseFloat(valueA) || 0;
            const numB = parseFloat(valueB) || 0;
            return numB - numA;
          }
          return valueA.localeCompare(valueB);
        }
        
        // Mieszane typy - liczby przed stringami
        if (typeof valueA === 'number') return -1;
        if (typeof valueB === 'number') return 1;
        
        return 0;
      });
    };

    // Funkcja sortująca regiony
    const sortRegions = (regions: any[]) => {
      const regionsCopy = [...regions];
      
      switch (sortBy) {
        case 'value':
          // Sortowanie malejące po wartości sortowania regionu
          return regionsCopy.sort((a, b) => (b.sortValue || b.value) - (a.sortValue || a.value));
        case 'name':
          // Sortowanie alfabetyczne po nazwie regionu
          return regionsCopy.sort((a, b) => {
            const nameA = (a.name || a.label || '').toLowerCase();
            const nameB = (b.name || b.label || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
        case 'region':
          // Sortowanie alfabetyczne po nazwie regionu (to samo co 'name' dla regionów)
          return regionsCopy.sort((a, b) => {
            const nameA = (a.name || a.label || '').toLowerCase();
            const nameB = (b.name || b.label || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
        default:
          // Dla kolumn z extraData, sortujemy po wartości sortowania
          return regionsCopy.sort((a, b) => (b.sortValue || b.value) - (a.sortValue || a.value));
      }
    };

    const processedRegions = countryNode.children.map(region => {
      // Sortujemy dzieci zgodnie z wybranym kryterium
      const sortedChildren = sortChildren(region.children || []);
      
      // Używamy region.label jako nazwy regionu z PROLOGIS MARKET
      const regionName = region.label || region.region || "Unknown";
      
      const childrenWithSortValue = sortedChildren.map((child, index) => {
        // Obliczamy wartość sortowania jako liczbę (dla rozmiaru kafelka)
        const sortValueNum = getSortValueAsNumber(child, sortBy);
        
        // Jeśli sortowanie jest po wartości numerycznej, używamy tej wartości jako rozmiaru
        // Jeśli sortowanie jest po stringu (np. nazwa), zachowujemy oryginalny rozmiar (area)
        // ale sortujemy według wybranego kryterium
        const finalSortValue = (sortBy === 'name' || sortBy === 'region') 
          ? child.value // Dla sortowania alfabetycznego, zachowujemy oryginalny rozmiar
          : (sortValueNum > 0 ? sortValueNum : child.value); // Dla numerycznego, używamy wartości sortowania
        
        // Tworzymy obiekt dziecka z wszystkimi potrzebnymi właściwościami
        const childData: any = {
          name: child.label,
          value: child.value, // Oryginalna powierzchnia (zachowana)
          sortValue: finalSortValue, // Wartość używana do sortowania i rozmiaru kafelka
          sortBy: sortBy, // Przekazujemy kryterium sortowania do StockTile
          region: regionName, // Nazwa regionu z PROLOGIS MARKET - KLUCZOWE!
          isLargestInRegion: index === 0, // Flagujemy największy element (w zależności od sortowania)
          tileIndex: index, // Indeks w regionie do generowania odcieni
          totalTiles: sortedChildren.length, // Całkowita liczba kafelków w regionie
          colorValue: child.colorValue, // Occupancy rate (jeśli dostępne)
          extraData: child.extraData, // Przekazujemy wszystkie dodatkowe dane z Excela
        };
        return childData;
      });
      
      // Obliczamy wartość regionu jako sumę wartości sortowania dzieci (dla sortowania numerycznego)
      // lub sumę oryginalnych wartości (dla sortowania alfabetycznego)
      const regionSortValue = childrenWithSortValue.reduce((sum, child) => {
        return sum + (child.sortValue || child.value);
      }, 0);
      
      return {
        name: regionName,
        children: childrenWithSortValue,
        value: region.value, // Oryginalna wartość regionu (zachowana)
        sortValue: regionSortValue, // Wartość używana do sortowania regionów
      };
    });

    // Sortujemy regiony zgodnie z wybranym kryterium
    const regionsData = sortRegions(processedRegions);

    // Jeśli widok to "country", spłaszczamy strukturę
    if (viewMode === 'country') {
      return transformToFlatCountry(regionsData);
    }

    return regionsData;

  }, [data, sortBy, viewMode, transformToFlatCountry]);

  // Nazwa kraju - zakładamy, że wszystkie dane są z Poland
  const rootName = useMemo(() => {
    if (!data) return "Poland";
    
    if (!data.children) return data.label || "Poland";
    
    // Pobieramy nazwę kraju (domyślnie Poland, jeśli wszystkie dane są z tego kraju)
    const countryNode = data.children.find(
      (child) => child.label === "Poland" || child.label.toLowerCase().includes("poland")
    ) || data.children[0];
    
    return countryNode?.label || data.label || "Poland";
  }, [data]);

  const totalArea = useMemo(() => {
    if (!processedData.length) return 0;
    return processedData.reduce((sum, region) => sum + region.value, 0);
  }, [processedData]);

  // Lista unikalnych regionów dla legendy
  const uniqueRegions = useMemo(() => {
    if (!processedData.length) return [];
    
    // W trybie "country" zbieramy wszystkie unikalne regiony z parków
    if (viewMode === 'country') {
      const regionSet = new Set<string>();
      processedData.forEach(country => {
        if (country.children) {
          country.children.forEach((park: any) => {
            const regionName = park.originalRegion || park.region || 'Unknown';
            if (regionName && regionName !== 'Poland') {
              regionSet.add(regionName);
            }
          });
        }
      });
      return Array.from(regionSet).map(regionName => ({
        name: regionName,
        color: getColorByRegion(regionName)
      }));
    }
    
    // W trybie "regions" pokazujemy regiony jak dotychczas
    return processedData.map(region => ({
      name: region.name,
      color: getColorByRegion(region.name)
    }));
  }, [processedData, viewMode]);

  // Etykieta aktualnego sortowania
  const currentSortLabel = useMemo(() => {
    const selectedColumn = getAvailableSortColumns.find(col => col.key === sortBy);
    return selectedColumn?.label || 'By Area (m²)';
  }, [sortBy, getAvailableSortColumns]);

  if (!processedData.length) {
    return (
      <div 
        ref={mapRef} 
        className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white"
      >
        <div className="w-full bg-black text-white px-6 py-3 flex items-center justify-between">
          <span className="font-semibold text-lg" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            {rootName}
          </span>
          <span className="text-sm" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            Total Area: {totalArea.toLocaleString()} m²
          </span>
        </div>
        <div className="p-10 text-center text-gray-500">No data to display</div>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef} 
      className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white"
    >
      {/* 1. Header (Zostanie pobrany na obrazku) */}
      <div className="w-full bg-black text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            {rootName}
          </span>
          <span className="text-sm text-gray-300" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
            • Sorting: {currentSortLabel}
          </span>
        </div>
        <span className="text-sm" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          Total Area: {totalArea.toLocaleString()} m²
        </span>
      </div>

      {/* 2. Pasek Sterowania (Zostanie POMINIĘTY na obrazku dzięki klasie exclude-from-capture) */}
      <div className="w-full px-6 py-3 bg-gray-50 border-b border-gray-200 exclude-from-capture">
        <div className="flex items-center justify-between gap-3">
          {/* Lewa strona: Sortowanie i Przełącznik Widoku */}
          <div className="flex items-center gap-3">
            <label 
              htmlFor="sort-select"
              className="text-sm font-medium text-gray-700"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Sort:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-700 cursor-pointer"
              style={{ fontFamily: "Inter, sans-serif", minWidth: "250px" }}
            >
              {getAvailableSortColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>

            {/* Przełącznik Widoku */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('regions')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'regions'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                By Regions
              </button>
              <button
                onClick={() => setViewMode('country')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'country'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Entire Country (By Size)
              </button>
            </div>
          </div>

          {/* Prawa strona: Przycisk Pobierania */}
          <button
            onClick={handleDownloadImage}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
            title="Download image for presentation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Image
          </button>
        </div>
      </div>

      {/* 3. Wykres (Zostanie pobrany) */}
      <div className="w-full" style={{ height: "600px", padding: "12px 8px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={processedData}
            dataKey="sortValue"
            aspectRatio={16 / 9}
            stroke="#fff"
            content={createStockTile(sortBy, getAvailableSortColumns) as any}
            isAnimationActive={false}
          >
            <Tooltip content={createCustomTooltip(sortBy, getAvailableSortColumns)} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* 4. Legenda (Zostanie pobrana) */}
      {uniqueRegions.length > 0 && (
        <div className="w-full px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col gap-3">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
              Regions
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              {uniqueRegions.map((region) => (
                <div
                  key={region.name}
                  className="flex items-center gap-2"
                  style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                >
                  <div
                    className="w-4 h-4 rounded-sm shadow-sm"
                    style={{ backgroundColor: region.color }}
                  />
                  <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
                    {region.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

