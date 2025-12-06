"use client";

import { useExcelData } from "@/hooks/useExcelData";
import { FileUploader } from "@/components/FileUploader";
import { StockMap } from "@/components/StockMap";
import { EditableTable } from "@/components/EditableTable";

export default function Home() {
  const { parsedData, treemapData, error, parseFile, updateCell } =
    useExcelData();

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-[95vw] mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Excel to Treemap Visualizer
          </h1>
          <p className="text-gray-600">
            Upload your Excel or CSV file to visualize data as an interactive
            treemap
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Privacy & Security
              </p>
              <p className="text-xs text-blue-800">
                Your files are processed <strong>locally in your browser</strong> and are not sent to any server. 
                All data remains on your device and is cleared when you refresh the page.
              </p>
            </div>
          </div>
        </div>

        <FileUploader onFileSelect={parseFile} error={error} />

        {parsedData && (
          <>
            {!treemapData && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-semibold mb-2">
                  Cannot build treemap
                </p>
                <p className="text-sm text-yellow-700">
                  Check if the file contains columns: Country, Prologis Market,
                  Park/Bucket, Building Area
                </p>
                <p className="text-xs text-yellow-600 mt-2">
                  Found columns: {parsedData.headers.join(", ")}
                </p>
              </div>
            )}

            {treemapData && (
              <div className="w-full max-w-[95vw] mx-auto">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  Market Map
                </h2>
                <StockMap data={treemapData} availableHeaders={parsedData.headers} />
              </div>
            )}

            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Data Table ({parsedData.rows.length} rows)
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Edit cells below to update the treemap in real-time
              </p>
              <EditableTable
                headers={parsedData.headers}
                rows={parsedData.rows}
                onCellUpdate={updateCell}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

