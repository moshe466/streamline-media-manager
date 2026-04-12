

'use client';

import { useState, useEffect } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend, Tooltip } from 'recharts';
import { getStreamDetails, type StreamDetails } from '@/services/flussonic';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface StreamStatsChartProps {
  streamName: string;
  initialData: StreamDetails;
}

interface ChartDataPoint {
  time: string;
  viewers: number;
  inBitrate: number;
  outBitrate: number;
}

const MAX_DATA_POINTS = 30; 

const formatBitrateForChart = (bitrate?: number | null): number => {
    if (!bitrate) return 0;
    // Convert kbps to Mbps for display
    return parseFloat((bitrate / 1000).toFixed(2));
};

export function StreamStatsChart({ streamName, initialData }: StreamStatsChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>(() => {
    const now = new Date();
    const stats = initialData.stats;
    return [{ 
        time: now.toLocaleTimeString('he-IL'), 
        viewers: stats?.client_count || 0,
        inBitrate: formatBitrateForChart(stats?.input_media_info?.bitrate as number | null | undefined),
        outBitrate: formatBitrateForChart(stats?.bitrate as number | null | undefined)
    }];
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      
      const details = await getStreamDetails(streamName);
      if (details?.stats?.alive) {
        const now = new Date();
        const stats = details.stats;
        const newPoint: ChartDataPoint = {
          time: now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          viewers: stats.client_count || 0,
          inBitrate: formatBitrateForChart(stats.input_media_info?.bitrate as number | null | undefined),
          outBitrate: formatBitrateForChart(stats.bitrate as number | null | undefined),
        };

        setData(currentData => {
          const newData = [...currentData, newPoint];
          return newData.length > MAX_DATA_POINTS ? newData.slice(newData.length - MAX_DATA_POINTS) : newData;
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [streamName]);

  const chartConfig = {
      viewers: { label: "צופים", color: "#3b82f6" }, // blue-500
      inBitrate: { label: "In Bitrate (Mbps)", color: "#f97316" }, // orange-500
      outBitrate: { label: "Out Bitrate (Mbps)", color: "#22c55e" }, // green-500
  } satisfies React.ComponentProps<typeof ChartContainer>["config"];

  return (
     <ChartContainer config={chartConfig} className="w-full h-full min-h-[200px]">
        <AreaChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis yAxisId="left" stroke={chartConfig.viewers.color} tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" stroke={chartConfig.outBitrate.color} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}`} />
            <Tooltip
                content={<ChartTooltipContent
                    indicator="dot"
                    formatter={(value, name) => {
                        if (name === 'viewers') return [value, 'צופים'];
                        if (name === 'inBitrate') return [value, 'Bitrate נכנס (Mbps)'];
                        if (name === 'outBitrate') return [value, 'Bitrate יוצא (Mbps)'];
                        return [value, name];
                    }}
                />}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area yAxisId="left" dataKey="viewers" type="monotone" fill={chartConfig.viewers.color} fillOpacity={0.2} stroke={chartConfig.viewers.color} strokeWidth={2} />
            <Area yAxisId="right" dataKey="inBitrate" type="monotone" fill={chartConfig.inBitrate.color} fillOpacity={0.2} stroke={chartConfig.inBitrate.color} strokeWidth={2} />
            <Area yAxisId="right" dataKey="outBitrate" type="monotone" fill={chartConfig.outBitrate.color} fillOpacity={0.2} stroke={chartConfig.outBitrate.color} strokeWidth={2} />
        </AreaChart>
    </ChartContainer>
  );
}
