"use client";

import { RawRowData } from "@/types/data";

interface EditableTableProps {
  headers: string[];
  rows: RawRowData[];
  onCellUpdate: (rowIndex: number, columnKey: string, value: string | number) => void;
}

export function EditableTable({
  headers,
  rows,
  onCellUpdate,
}: EditableTableProps) {
  const handleCellChange = (
    rowIndex: number,
    columnKey: string,
    value: string
  ) => {
    const numValue = Number(value);
    const finalValue = isNaN(numValue) ? value : numValue;
    onCellUpdate(rowIndex, columnKey, finalValue);
  };

  return (
    <div className="w-full overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {headers.map((header) => (
                <td key={header} className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    value={row[header] ?? ""}
                    onChange={(e) =>
                      handleCellChange(rowIndex, header, e.target.value)
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

