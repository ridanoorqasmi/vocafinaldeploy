/**
 * Phase 5: Chart Renderer Component
 * Data Analyst Agent (Poppy) - Chart Visualization
 * 
 * Renders charts from chart specs using Recharts
 */

'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Table2, BarChart3 } from 'lucide-react'
import type { ChartSpec } from '@/lib/poppy/services/charts/chart-selection'

interface ChartRendererProps {
  chartSpec: ChartSpec
  data: any[]
  artifactTitle: string
  isModal?: boolean // Phase 5 UX: If true, render in modal (larger size)
}

// Color palette for charts (theme defaults)
const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
]

export default function ChartRenderer({ chartSpec, data, artifactTitle, isModal = false }: ChartRendererProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  
  // In modal, use larger chart height
  const chartHeight = isModal ? 500 : 400

  // Transform data for chart (handle different data structures)
  const chartData = data.map(row => {
    const transformed: any = {};
    Object.keys(row).forEach(key => {
      const value = (row as any)[key];
      // Convert to number if possible
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        transformed[key] = Number(value);
      } else if (typeof value === 'number') {
        transformed[key] = value;
      } else {
        transformed[key] = value;
      }
    });
    return transformed;
  });

  // Format Y-axis ticks for better readability
  const formatYAxisTick = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString('en-US');
  };

  // Format X-axis labels (truncate if too long)
  const formatXAxisTick = (value: string | number) => {
    const str = String(value);
    return str.length > 12 ? `${str.substring(0, 10)}...` : str;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 backdrop-blur-sm">
          <p className="text-sm font-semibold text-white mb-2 border-b border-gray-700 pb-2">
            {String(label)}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, idx: number) => (
              <p key={idx} className="text-xs flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-300">{entry.name}:</span>
                <span className="font-semibold text-white">
                  {typeof entry.value === 'number' 
                    ? entry.value.toLocaleString('en-US', { maximumFractionDigits: 2 })
                    : entry.value}
                </span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const { type, x, y } = chartSpec;
    const yKeys = Array.isArray(y) ? y : [y];

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart 
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey={x} 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickFormatter={formatXAxisTick}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickFormatter={formatYAxisTick}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="square"
              />
              {yKeys.map((yKey, idx) => (
                <Bar 
                  key={yKey} 
                  dataKey={yKey} 
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart 
              data={chartData}
              margin={{ top: 10, right: 20, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey={x} 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatXAxisTick}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatYAxisTick}
                width={70}
                label={{ value: yKeys[0], angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#9ca3af', fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              {yKeys.map((yKey, idx) => (
                <Line 
                  key={yKey} 
                  type="monotone" 
                  dataKey={yKey} 
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS[idx % CHART_COLORS.length], r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart 
              data={chartData}
              margin={{ top: 10, right: 20, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey={x} 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatXAxisTick}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatYAxisTick}
                width={70}
                label={{ value: yKeys[0], angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#9ca3af', fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="square"
              />
              {yKeys.map((yKey, idx) => (
                <Area 
                  key={yKey} 
                  type="monotone" 
                  dataKey={yKey} 
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        // Transform data for pie chart - handle column name matching robustly
        // First, get all available column names from the first row
        const availableColumns = chartData.length > 0 ? Object.keys(chartData[0]) : [];
        
        // Helper to find column value (exact match first, then case-insensitive)
        const findColumnValue = (columnName: string, row: any): any => {
          // Try exact match first
          if (columnName in row) {
            return row[columnName];
          }
          
          // Try case-insensitive match
          const columnLower = columnName.toLowerCase().trim();
          for (const key of Object.keys(row)) {
            if (key.toLowerCase().trim() === columnLower) {
              return row[key];
            }
          }
          
          // Try with spaces/underscores normalized
          const normalizedColumn = columnName.replace(/\s+/g, '_').toLowerCase().trim();
          for (const key of Object.keys(row)) {
            const normalizedKey = key.replace(/\s+/g, '_').toLowerCase().trim();
            if (normalizedKey === normalizedColumn) {
              return row[key];
            }
          }
          
          return null;
        };
        
        // Determine which columns to use (with fallback)
        let xColumn = x;
        let yColumn = yKeys[0];
        
        // If specified columns don't exist, try to infer from available columns
        if (availableColumns.length > 0) {
          const firstRow = chartData[0];
          const xFound = findColumnValue(x, firstRow) !== null;
          const yFound = findColumnValue(yKeys[0], firstRow) !== null;
          
          // If x column not found, use first column
          if (!xFound && availableColumns.length > 0) {
            xColumn = availableColumns[0];
          }
          
          // If y column not found, find first numeric column
          if (!yFound) {
            for (const col of availableColumns) {
              const value = firstRow[col];
              if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value.replace(/,/g, ''))))) {
                yColumn = col;
                break;
              }
            }
          }
        }
        
        const pieData = chartData
          .map(row => {
            const xValue = findColumnValue(xColumn, row);
            const yValue = findColumnValue(yColumn, row);
            
            // Convert to number if needed - handle comma-separated numbers
            let numValue = 0;
            if (typeof yValue === 'number') {
              numValue = yValue;
            } else if (yValue !== null && yValue !== undefined && yValue !== '') {
              // Remove commas and parse
              const cleanedValue = String(yValue).replace(/,/g, '');
              const parsed = parseFloat(cleanedValue);
              numValue = isNaN(parsed) ? 0 : parsed;
            }
            
            // Handle empty labels - convert to "N/A" or keep as empty string
            const label = xValue === null || xValue === undefined || xValue === '' 
              ? 'N/A' 
              : String(xValue).trim();
            
            return {
              name: label || 'N/A',
              value: numValue,
            };
          })
          .filter(entry => entry.value > 0); // Only filter out zero/negative values, allow empty labels
        
        // If no valid data, show empty state
        if (pieData.length === 0) {
          return (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-sm">No valid data to display in pie chart</p>
            </div>
          );
        }
        
        // Calculate outer radius based on modal or sidebar
        const outerRadius = isModal ? 150 : 120;
        const innerRadius = 0; // Full pie chart (no donut)
        
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy={isModal ? "45%" : "50%"}
                labelLine={true}
                label={({ name, percent }) => {
                  if (percent < 0.03) return ''; // Hide labels for very small slices
                  return `${name}\n${(percent * 100).toFixed(1)}%`;
                }}
                outerRadius={outerRadius}
                innerRadius={innerRadius}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={2}
                isAnimationActive={true}
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    stroke="#1f2937"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip 
                content={<CustomTooltip />}
                formatter={(value: any) => [
                  typeof value === 'number' 
                    ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
                    : value,
                  'Value'
                ]}
              />
              <Legend 
                verticalAlign="bottom"
                height={isModal ? 50 : 36}
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value: string) => <span style={{ color: '#9ca3af', fontSize: '12px' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'stacked_bar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart 
              data={chartData}
              margin={{ top: 10, right: 20, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey={x} 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatXAxisTick}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={formatYAxisTick}
                width={70}
                label={{ value: Array.isArray(y) ? y.join(', ') : y, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#9ca3af', fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="square"
              />
              {yKeys.map((yKey, idx) => (
                <Bar 
                  key={yKey} 
                  dataKey={yKey} 
                  stackId="stack"
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={idx === yKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const renderTable = () => {
    if (data.length === 0) return null;

    const columns = Object.keys(data[0] || {});

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-700">
              {columns.map((key) => (
                <th key={key} className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase tracking-wider">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row: any, idx: number) => (
              <tr 
                key={idx} 
                className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors"
              >
                {columns.map((colName, colIdx) => (
                  <td key={colIdx} className="py-3 px-4 text-gray-200">
                    {typeof (row as any)[colName] === 'number'
                      ? (row as any)[colName].toLocaleString('en-US', {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: (row as any)[colName] % 1 === 0 ? 0 : 2
                        })
                      : String((row as any)[colName] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 10 && (
          <div className="bg-gray-800/30 px-4 py-3 border-t border-gray-700/50">
            <p className="text-xs text-gray-400 text-center">
              Showing 10 of {data.length} rows
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-4">
      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('chart')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            viewMode === 'chart'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Chart
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            viewMode === 'table'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
              : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          }`}
        >
          <Table2 className="w-4 h-4" />
          Table
        </button>
      </div>

      {/* Chart Description (if available) */}
      {chartSpec.description && viewMode === 'chart' && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300 leading-relaxed">
            {chartSpec.description}
          </p>
        </div>
      )}

      {/* Render based on view mode */}
      {viewMode === 'chart' ? (
        <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-800/50 shadow-xl">
          {renderChart()}
        </div>
      ) : (
        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-800/50">
          {renderTable()}
        </div>
      )}
    </div>
  );
}

