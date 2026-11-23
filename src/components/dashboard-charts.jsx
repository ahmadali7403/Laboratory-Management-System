"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#9333ea",
  "#e11d48",
  "#64748b",
];

const numberFormat = new Intl.NumberFormat("en-PK");

const moneyFormat = (value) => `Rs. ${numberFormat.format(Number(value || 0))}`;

function ChartCard({ title, subtitle, children, height = 300 }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
      <div style={{ width: "100%", height }}>{children}</div>
    </div>
  );
}

const axisStyle = {
  fontSize: 11,
  fill: "#94a3b8",
};

const tooltipStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
};

export function DailyActivityChart({ data = [] }) {
  return (
    <ChartCard
      title="Daily Laboratory Activity"
      subtitle="Orders and payments received during the last 30 days"
      height={320}
    >
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f9"
          />
          <XAxis
            dataKey="date"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            yAxisId="orders"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : value
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) =>
              name === "Revenue"
                ? moneyFormat(value)
                : numberFormat.format(value)
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            name="Orders"
            stroke="#2563eb"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#16a34a"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MonthlyPerformanceChart({ data = [] }) {
  return (
    <ChartCard
      title="Monthly Performance"
      subtitle="Month-wise laboratory orders and collected revenue"
      height={300}
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f9"
          />
          <XAxis
            dataKey="month"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="orders"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              value >= 1000 ? `${Math.round(value / 1000)}k` : value
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) =>
              name === "Revenue"
                ? moneyFormat(value)
                : numberFormat.format(value)
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="orders"
            dataKey="orders"
            name="Orders"
            fill="#3b82f6"
            radius={[5, 5, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name="Revenue"
            fill="#10b981"
            radius={[5, 5, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OrderStatusChart({ data = [] }) {
  const chartData = data.filter((item) => item.count > 0);
  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <ChartCard
      title="Order Status Overview"
      subtitle="Distribution of laboratory orders by status"
      height={300}
    >
      {chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No order data available yet
        </div>
      ) : (
        <div className="relative h-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="48%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                stroke="none"
              >
                {chartData.map((item, index) => (
                  <Cell
                    key={item.status}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-7">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800">
                {numberFormat.format(total)}
              </p>
              <p className="text-[10px] text-slate-400">Total Orders</p>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function OrganizationGrowthChart({ data = [] }) {
  return (
    <ChartCard
      title="Organization Growth"
      subtitle="New organization registrations during the last 6 months"
      height={300}
    >
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f9"
          />
          <XAxis
            dataKey="month"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="organizations"
            name="New Organizations"
            stroke="#7c3aed"
            strokeWidth={3}
            dot={{ r: 4, fill: "#7c3aed" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BranchComparisonChart({ data = [] }) {
  const rows = data.slice(0, 8);

  return (
    <ChartCard
      title="Branch Performance"
      subtitle="Comparison of orders across branches"
      height={320}
    >
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No branch comparison data available
        </div>
      ) : (
        <ResponsiveContainer>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 15, left: 10, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#f1f5f9"
            />
            <XAxis
              type="number"
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={95}
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="orders"
              name="Orders"
              fill="#2563eb"
              radius={[0, 5, 5, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function OrganizationStatusChart({ data = [] }) {
  const chartData = data.filter((item) => item.count > 0);
  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <ChartCard
      title="Organization Status"
      subtitle="Current platform organization distribution"
      height={300}
    >
      {chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No organization data available
        </div>
      ) : (
        <div className="relative h-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="48%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                stroke="none"
              >
                {chartData.map((item, index) => (
                  <Cell
                    key={item.status}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-7">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800">
                {numberFormat.format(total)}
              </p>
              <p className="text-[10px] text-slate-400">Organizations</p>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
