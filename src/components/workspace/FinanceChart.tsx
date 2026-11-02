import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export function FinanceChart({
  movements,
  payments,
  days = 30,
}: {
  movements?: any[];
  payments?: any[];
  days?: number;
}) {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days + 1);
  const grouped: Record<string, number> = {};
  for (const r of movements || []) {
    if (String(r.paid_date) < from.toISOString().slice(0, 10)) continue;
    const key = String(r.paid_date).slice(0, 7);
    grouped[key] = (grouped[key] || 0) + Number(r.amount);
  }
  for (const p of payments || [])
    grouped[p.status] = (grouped[p.status] || 0) + 1;
  const rows = Object.entries(grouped).map(([name, value]) => ({
    name,
    value,
  }));
  return (
    <div className="h-64">
      {rows.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-muted-foreground">No records in this period.</p>
      )}
    </div>
  );
}
