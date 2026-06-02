'use client';

import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { DailySnapshot } from '@/types';

interface ProgressChartProps {
    history: DailySnapshot[];
}

type TimeRange = '7days' | '30days';

// Custom hook for hydration check
function useHydration() {
    return useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    );
}

export default function ProgressChart({ history }: ProgressChartProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('7days');
    const mounted = useHydration();

    // Filter data based on time range
    const now = new Date();
    const daysToShow = timeRange === '7days' ? 7 : 30;
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - daysToShow);

    const filteredHistory = history
        .filter((snapshot) => new Date(snapshot.date) >= cutoffDate)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Generate chart data with filled gaps for missing days
    const chartData: Array<{
        date: string;
        displayDate: string;
        adult: number;
        child: number;
        rest: number;
        score: number;
    }> = [];

    for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const snapshot = filteredHistory.find((h) => h.date === dateStr);

        chartData.push({
            date: dateStr,
            displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            adult: snapshot?.adultCompleted || 0,
            child: snapshot?.childCompleted || 0,
            rest: snapshot?.restCompleted || 0,
            score: snapshot?.score || 0,
        });
    }

    if (!mounted) {
        return (
            <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6">
                <div className="h-64 flex items-center justify-center text-white/40">
                    Loading chart...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/40 backdrop-blur-2xl rounded-2xl p-4 sm:p-6 relative border border-white/5 shadow-[0_0_40px_-15px_rgba(99,102,241,0.2)] animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <span className="material-icons-round text-white text-lg">insights</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Daily Balance</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Progress Overview</p>
                    </div>
                </div>
                <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setTimeRange('7days')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${timeRange === '7days'
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setTimeRange('30days')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${timeRange === '30days'
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        30 Days
                    </button>
                </div>
            </div>

            {/* Chart Area */}
            {chartData.every((d) => d.adult === 0 && d.child === 0 && d.rest === 0) ? (
                <div className="h-64 md:h-[350px] flex flex-col items-center justify-center text-center p-6 relative animate-in fade-in duration-700">
                    {/* Glowing background blur */}
                    <div className="absolute inset-0 bg-amber-500/5 blur-3xl rounded-full scale-75 pointer-events-none" />
                    
                    <div className="relative mb-4">
                        <div className="w-16 h-14 rounded-2xl bg-gradient-to-br from-amber-400/10 to-orange-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shadow-lg shadow-amber-500/5 animate-pulse">
                            <span className="material-icons-round text-3xl">analytics</span>
                        </div>
                    </div>
                    <h4 className="text-base font-bold text-white mb-1.5 tracking-tight">Sync History is Quiet</h4>
                    <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
                        Complete your scheduled tasks today to start plotting your three-brain balance charts and energy tracking.
                    </p>
                </div>
            ) : (
                <div className="h-[300px] md:h-[420px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: -10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorAdult" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="colorChild" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.9} />
                                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="colorRest" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                                    <stop offset="95%" stopColor="#059669" stopOpacity={0.6} />
                                </linearGradient>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis
                                dataKey="displayDate"
                                stroke="#ffffff20"
                                fontSize={10}
                                fontWeight={700}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b' }}
                                dy={10}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="#ffffff20"
                                fontSize={10}
                                fontWeight={700}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b' }}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="#ffffff20"
                                fontSize={10}
                                fontWeight={700}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                                tick={{ fill: '#f59e0b' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                                    backdropFilter: 'blur(10px)'
                                }}
                                itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />
                            <Legend
                                verticalAlign="top"
                                align="right"
                                iconType="circle"
                                wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                            />

                            <Bar
                                yAxisId="left"
                                dataKey="adult"
                                name="Adult"
                                stackId="tasks"
                                fill="url(#colorAdult)"
                                radius={[0, 0, 0, 0]}
                                barSize={20}
                            />
                            <Bar
                                yAxisId="left"
                                dataKey="child"
                                name="Child"
                                stackId="tasks"
                                fill="url(#colorChild)"
                                radius={[0, 0, 0, 0]}
                                barSize={20}
                            />
                            <Bar
                                yAxisId="left"
                                dataKey="rest"
                                name="Rest"
                                stackId="tasks"
                                fill="url(#colorRest)"
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />

                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="score"
                                name="Balance Score"
                                stroke="#f59e0b"
                                strokeWidth={4}
                                dot={{ fill: '#f59e0b', r: 4, strokeWidth: 2, stroke: '#0f172a' }}
                                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                                animationDuration={1000}
                                filter="url(#glow)"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Footer Hint */}
            <div className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <span className="material-icons-round text-amber-500 text-sm">auto_awesome</span>
                <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">
                    Higher score indicates optimal Adult/Child harmony
                </p>
            </div>
        </div>
    );
}
