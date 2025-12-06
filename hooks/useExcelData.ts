import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  RawRowData,
  ParsedData,
  TreeMapNode,
} from "@/types/data";

function forwardFillSparseColumns(
  rows: RawRowData[],
  headers: string[]
): RawRowData[] {
  const countryIdx = headers.findIndex(
    (h) => h.toLowerCase().includes("country")
  );
  const marketIdx = headers.findIndex(
    (h) => h.toLowerCase().includes("market") || h.toLowerCase().includes("prologis")
  );

  if (countryIdx === -1 && marketIdx === -1) {
    return rows;
  }

  const filledRows: RawRowData[] = [];
  let lastCountry = "";
  let lastMarket = "";

  rows.forEach((row) => {
    const filledRow = { ...row };

    if (countryIdx !== -1) {
      const country = String(row[headers[countryIdx]] || "").trim();
      if (country) {
        lastCountry = country;
      }
      if (lastCountry) {
        filledRow[headers[countryIdx]] = lastCountry;
      }
    }

    if (marketIdx !== -1) {
      const market = String(row[headers[marketIdx]] || "").trim();
      if (market) {
        lastMarket = market;
      }
      if (lastMarket) {
        filledRow[headers[marketIdx]] = lastMarket;
      }
    }

    filledRows.push(filledRow);
  });

  return filledRows;
}

export function useExcelData() {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    const isCSV = file.name.endsWith(".csv");

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          setError("Failed to read file");
          return;
        }

        const workbook = XLSX.read(data, {
          type: isCSV ? "string" : "binary",
        });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData: RawRowData[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: "",
        });

        if (jsonData.length === 0) {
          setError("File is empty or contains no data");
          return;
        }

        const headers = Object.keys(jsonData[0]);

        if (headers.length === 0) {
          setError("No columns found in file");
          return;
        }

        const processedRows = forwardFillSparseColumns(jsonData, headers);

        if (process.env.NODE_ENV === 'development') {
          console.log("Parsed headers:", headers);
          console.log("Processed rows count:", processedRows.length);
          console.log("First row sample:", processedRows[0]);
        }

        setParsedData({ headers, rows: processedRows });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
      }
    };

    reader.onerror = () => {
      setError("Error reading file");
    };

    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  }, []);

  const updateCell = useCallback(
    (rowIndex: number, columnKey: string, value: string | number) => {
      if (!parsedData) return;

      const updatedRows = [...parsedData.rows];
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [columnKey]: value,
      };

      setParsedData({
        ...parsedData,
        rows: updatedRows,
      });
    },
    [parsedData]
  );

  const treemapData = useMemo((): TreeMapNode | null => {
    if (!parsedData || parsedData.rows.length === 0) return null;

    const { headers, rows } = parsedData;

    const countryIdx = headers.findIndex(
      (h) => h.toLowerCase().includes("country")
    );
    const marketIdx = headers.findIndex(
      (h) => h.toLowerCase().includes("market") || h.toLowerCase().includes("prologis")
    );
    const parkIdx = headers.findIndex(
      (h) => h.toLowerCase().includes("park") || h.toLowerCase().includes("bucket")
    );
    const areaIdx = headers.findIndex(
      (h) => h.toLowerCase().includes("building") && h.toLowerCase().includes("area")
    );
    const occupancyIdx = headers.findIndex(
      (h) => h.toLowerCase().includes("occupancy")
    );

    if (countryIdx === -1 || marketIdx === -1 || parkIdx === -1 || areaIdx === -1) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("Missing required columns:", {
          country: countryIdx !== -1,
          market: marketIdx !== -1,
          park: parkIdx !== -1,
          area: areaIdx !== -1,
          headers,
        });
      }
      return null;
    }

    const countryKey = headers[countryIdx];
    const marketKey = headers[marketIdx];
    const parkKey = headers[parkIdx];
    const areaKey = headers[areaIdx];
    const occupancyKey = occupancyIdx !== -1 ? headers[occupancyIdx] : null;

    if (process.env.NODE_ENV === 'development') {
      console.log("Using column keys:", {
        countryKey,
        marketKey,
        parkKey,
        areaKey,
        occupancyKey,
      });

      console.log("First 3 rows sample:", rows.slice(0, 3).map(row => ({
        country: row[countryKey],
        market: row[marketKey],
        park: row[parkKey],
        area: row[areaKey],
      })));
    }

    const countryMap = new Map<
      string,
      Map<string, Map<string, { area: number; occupancy?: number; rowData: RawRowData }>>
    >();

    let skippedRows = 0;
    let skippedReasons: Record<string, number> = {};

    rows.forEach((row, idx) => {
      const countryRaw = row[countryKey];
      const marketRaw = row[marketKey];
      const parkRaw = row[parkKey];
      const areaRaw = row[areaKey];

      const country = countryRaw != null && countryRaw !== "" 
        ? String(countryRaw).trim() 
        : "";
      const market = marketRaw != null && marketRaw !== ""
        ? String(marketRaw).trim()
        : "";
      const park = parkRaw != null && parkRaw !== ""
        ? String(parkRaw).trim()
        : "";

      let area: number = NaN;
      if (areaRaw != null && areaRaw !== "") {
        const areaStr = String(areaRaw).trim().replace(/,/g, "");
        area = Number(areaStr);
      }

      let occupancy: number | undefined = undefined;
      if (occupancyKey && row[occupancyKey] != null && row[occupancyKey] !== "") {
        const occupancyRaw = String(row[occupancyKey]).trim();
        if (occupancyRaw) {
          const occupancyWithoutPercent = occupancyRaw.replace(/%/g, "").replace(/,/g, "");
          const occupancyNum = Number(occupancyWithoutPercent);
          if (!isNaN(occupancyNum) && occupancyNum >= 0) {
            occupancy = occupancyNum > 1 ? occupancyNum / 100 : occupancyNum;
          }
        }
      }

      if (!country || country.toLowerCase() === "total") {
        skippedRows++;
        skippedReasons["no_country"] = (skippedReasons["no_country"] || 0) + 1;
        if (idx < 5 && process.env.NODE_ENV === 'development') {
          console.log(`Row ${idx} - no country:`, { countryRaw, country, row: Object.keys(row) });
        }
        return;
      }
      if (!market || market.toLowerCase() === "total") {
        skippedRows++;
        skippedReasons["no_market"] = (skippedReasons["no_market"] || 0) + 1;
        if (idx < 5 && process.env.NODE_ENV === 'development') {
          console.log(`Row ${idx} - no market:`, { marketRaw, market });
        }
        return;
      }
      if (!park || park.toLowerCase() === "total") {
        skippedRows++;
        skippedReasons["no_park"] = (skippedReasons["no_park"] || 0) + 1;
        return;
      }
      if (isNaN(area) || area <= 0) {
        skippedRows++;
        skippedReasons["invalid_area"] =
          (skippedReasons["invalid_area"] || 0) + 1;
        if (idx < 5 && process.env.NODE_ENV === 'development') {
          console.log(`Row ${idx} - invalid area:`, { areaRaw, area, areaKey });
        }
        return;
      }

      if (!countryMap.has(country)) {
        countryMap.set(country, new Map());
      }

      const marketMap = countryMap.get(country)!;

      if (!marketMap.has(market)) {
        marketMap.set(market, new Map());
      }

      const parkMap = marketMap.get(market)!;
      parkMap.set(park, { area, occupancy, rowData: row });
    });

    if (process.env.NODE_ENV === 'development') {
      console.log("Row filtering results:", {
        totalRows: rows.length,
        skippedRows,
        skippedReasons,
        validRows: rows.length - skippedRows,
        countriesFound: countryMap.size,
      });
    }

    if (countryMap.size === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("No valid data rows found after filtering");
      }
      return null;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("Treemap data built successfully:", {
        countries: countryMap.size,
        totalParks: Array.from(countryMap.values()).reduce(
          (sum, marketMap) =>
            sum +
            Array.from(marketMap.values()).reduce(
              (s, parkMap) => s + parkMap.size,
              0
            ),
          0
        ),
      });
    }

    const countryNodes: TreeMapNode[] = Array.from(countryMap.entries()).map(
      ([country, marketMap]) => {
        const marketNodes: TreeMapNode[] = Array.from(
          marketMap.entries()
        ).map(([market, parkMap]) => {
          const parkNodes: TreeMapNode[] = Array.from(parkMap.entries()).map(
            ([park, data]) => {
              // Kopiujemy wszystkie dane z wiersza jako extraData (oprócz podstawowych pól)
              const extraData: { [key: string]: string | number | undefined } = {};
              Object.keys(data.rowData).forEach(key => {
                // Pomijamy podstawowe pola, które już są w TreeMapNode
                if (key !== countryKey && key !== marketKey && key !== parkKey && key !== areaKey && key !== occupancyKey) {
                  extraData[key] = data.rowData[key];
                }
              });
              
              return {
                id: `${country}-${market}-${park}`,
                value: data.area,
                label: park,
                colorValue: data.occupancy,
                region: market || undefined,
                extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
              };
            }
          );

          const marketValue = parkNodes.reduce(
            (sum, node) => sum + node.value,
            0
          );

          return {
            id: `${country}-${market}`,
            value: marketValue,
            label: market,
            region: market || undefined,
            children: parkNodes,
          };
        });

        const countryValue = marketNodes.reduce(
          (sum, node) => sum + node.value,
          0
        );

        return {
          id: country,
          value: countryValue,
          label: country,
          children: marketNodes,
        };
      }
    );

    const rootValue = countryNodes.reduce(
      (sum, node) => sum + node.value,
      0
    );

    return {
      id: "root",
      value: rootValue,
      label: "Root",
      children: countryNodes,
    };
  }, [parsedData]);

  return {
    parsedData,
    treemapData,
    error,
    parseFile,
    updateCell,
  };
}

