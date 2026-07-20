import React, { useState, useEffect } from 'react';
import { Database, Search, Table as TableIcon, LayoutGrid, FileDigit, List } from 'lucide-react';

export default function DatabaseExplorer({ activeDatabase }: { activeDatabase: string | null }) {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{
    columns: string[];
    rows: any[];
    count: number;
  } | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (activeDatabase) {
      fetchTables();
    }
  }, [activeDatabase]);

  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables?database=${activeDatabase || ''}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTables(data.tables || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string) => {
    setSelectedTable(tableName);
    setTableLoading(true);
    try {
      const res = await fetch(`/api/table/${tableName}?database=${activeDatabase || ''}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTableData({
        columns: data.columns,
        rows: data.rows,
        count: data.count
      });
    } catch (err: any) {
      setError(err.message);
      setTableData(null);
    } finally {
      setTableLoading(false);
    }
  };

  const filteredTables = tables.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!activeDatabase) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 text-center">
        <Database className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Database Connected</h3>
        <p className="text-gray-500 mt-2 max-w-md">Please connect to a SQL Server in the Settings tab to start exploring tables.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)]">
      {/* Sidebar: Table List */}
      <div className="w-full lg:w-72 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
            <LayoutGrid className="w-4 h-4 text-blue-600" />
            Tables ({tables.length})
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filter tables..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading tables...</div>
          ) : error && !tableData ? (
            <div className="p-4 text-center text-red-500 text-sm">{error}</div>
          ) : filteredTables.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No tables found</div>
          ) : (
            <ul className="space-y-0.5">
              {filteredTables.map(tableName => (
                <li key={tableName}>
                  <button
                    onClick={() => fetchTableData(tableName)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2
                      ${selectedTable === tableName 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <TableIcon className={`w-4 h-4 ${selectedTable === tableName ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="truncate">{tableName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Content: Table Viewer */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {tableLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !selectedTable || !tableData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <TableIcon className="w-12 h-12 text-gray-200 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Select a Table</h3>
            <p className="text-gray-500 mt-2">Click on any table in the sidebar to view its structure and top 100 records.</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-4 items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedTable}</h2>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5"><FileDigit className="w-4 h-4" /> {tableData.columns.length} Columns</span>
                  <span className="flex items-center gap-1.5"><List className="w-4 h-4" /> {tableData.count.toLocaleString()} Records</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50/30">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 shadow-sm z-10">
                  <tr>
                    {tableData.columns.map(col => (
                      <th key={col} className="px-6 py-3 font-medium tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tableData.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors bg-white">
                      {tableData.columns.map(col => (
                        <td key={col} className="px-6 py-4 text-gray-600 truncate max-w-xs">
                          {row[col] !== null ? String(row[col]) : <span className="text-gray-400 italic">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {tableData.rows.length === 0 && (
                    <tr>
                      <td colSpan={tableData.columns.length} className="px-6 py-8 text-center text-gray-500 bg-white">
                        No records found in this table.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-gray-100 bg-white text-xs text-gray-500 text-center">
              Showing top {Math.min(100, tableData.rows.length)} rows out of {tableData.count.toLocaleString()} total
            </div>
          </>
        )}
      </div>
    </div>
  );
}
