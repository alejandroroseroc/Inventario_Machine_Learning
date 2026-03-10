import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const customTootlipFormatter = (value) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(value);
};

export default function SalesChart({ data = [] }) {
    return (
        <div className="chart-box">
            <h2 className="card-title">Ventas últimos 7 días</h2>
            <div style={{ width: '100%', flex: 1, minHeight: 0 }}>
                <ResponsiveContainer>
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={10} />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 13 }}
                            tickFormatter={(val) => {
                                if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                                if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
                                return `$${val}`;
                            }}
                            dx={-10}
                        />
                        <Tooltip
                            cursor={{ fill: '#f1f5f9' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value) => [customTootlipFormatter(value), "Total"]}
                            labelStyle={{ color: '#0f1a2b', fontWeight: 'bold', marginBottom: '4px' }}
                        />
                        <Bar dataKey="valor" fill="#1e3a8a" radius={[6, 6, 0, 0]} barSize={36} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
