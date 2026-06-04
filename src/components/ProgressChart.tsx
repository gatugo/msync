'use client';

import { useState, useSyncExternalStore } from 'react';
import { X, Sparkles } from 'lucide-react';
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
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const adult = data.adult;
        const child = data.child;
        const rest = data.rest;
        const score = data.score;
        const total = adult + child + rest;
        const balanceRatio = total > 0 ? {
            adult: Math.round((adult / total) * 100),
            child: Math.round((child / total) * 100),
            rest: Math.round((rest / total) * 100),
        } : { adult: 0, child: 0, rest: 0 };

        let statusText = 'Balanced';
        let statusColor = 'text-green-400';
        if (total > 0) {
            if (balanceRatio.adult > 60) {
                statusText = 'Adult Heavy';
                statusColor = 'text-blue-400';
            } else if (balanceRatio.child > 50) {
                statusText = 'Play Heavy';
                statusColor = 'text-pink-400';
            } else if (balanceRatio.rest > 50) {
                statusText = 'Rest Heavy';
                statusColor = 'text-emerald-400';
            }
        } else {
            statusText = 'No Tasks';
            statusColor = 'text-slate-400';
        }

        return (
            <div className="glass-panel backdrop-blur-2xl rounded-2xl border border-white/10 p-4 shadow-[0_15px_30px_rgba(0,0,0,0.6)] min-w-[210px] animate-in fade-in zoom-in-95 duration-100">
                <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{data.displayDate}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 ${statusColor}`}>
                        {statusText}
                    </span>
                </div>
                
                <div className="flex items-center justify-between mb-3 bg-white/[0.03] rounded-xl px-2.5 py-2 border border-white/5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ego Score</span>
                    <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                        ✨ {score}
                    </span>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-blue-300 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-md shadow-blue-500/50" />
                            <span>Adult Focus</span>
                        </div>
                        <span className="font-semibold text-slate-200">{adult} <span className="text-[10px] text-slate-400">({balanceRatio.adult}%)</span></span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-pink-300 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 shadow-md shadow-pink-500/50" />
                            <span>Child Joy</span>
                        </div>
                        <span className="font-semibold text-slate-200">{child} <span className="text-[10px] text-slate-400">({balanceRatio.child}%)</span></span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-emerald-300 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-emerald-400 to-green-600 shadow-md shadow-emerald-500/50" />
                            <span>Rest Break</span>
                        </div>
                        <span className="font-semibold text-slate-200">{rest} <span className="text-[10px] text-slate-400">({balanceRatio.rest}%)</span></span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

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
    const dateCopy = new Date(now);
    cutoffDate.setDate(dateCopy.getDate() - daysToShow);

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
                    Loading stats...
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[300px]">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white/90">Ego Balance Dynamics</h3>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">7-day vs 30-day task completion history</p>
                </div>
                <div className="flex bg-slate-900 border border-white/5 p-1 rounded-xl">
                    <button
                        onClick={() => setTimeRange('7days')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === '7days' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setTimeRange('30days')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === '30days' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        30 Days
                    </button>
                </div>
            </div>

            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: -5, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorAdult" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="colorChild" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#ec4899" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="colorRest" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                        <XAxis
                            dataKey="displayDate"
                            stroke="#ffffff10"
                            fontSize={9}
                            fontWeight={700}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#64748b' }}
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
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                            <Legend
                                verticalAlign="top"
                                align="right"
                                iconType="circle"
                                wrapperStyle={{ paddingBottom: '10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}
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

            {/* Footer Hint */}
            <div className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">
                    Higher score indicates optimal Adult/Child harmony
                </p>
            </div>
        </div>
    );
}
