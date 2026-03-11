import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ExtendedSwimRecord } from "../hooks/use-swim-records";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface TimeProgressChartProps {
  records: ExtendedSwimRecord[];
  style: string;
  distance: number;
}

type ChartRecord = ExtendedSwimRecord & {
  chartX: number;
  dateLabel: string;
};

type ChartPoint = {
  x: number;
  y: number;
  isCompetition: boolean;
  competitionName: string | null;
  competitionLocation: string | null;
  time: string;
  poolLength: number;
  dateLabel: string;
};

const parseDate = (date: Date | string | null) => {
  if (!date) return null;

  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const timeToSeconds = (time: string | null): number => {
  if (!time) return 0;

  const [minutes, seconds] = time.split(':').map((value) => {
    const parsedValue = parseFloat(value);
    return Number.isNaN(parsedValue) ? 0 : parsedValue;
  });

  return (minutes * 60) + seconds;
};

const formatSeconds = (totalSeconds: number): string => {
  if (Number.isNaN(totalSeconds) || totalSeconds === 0) return '0:00.00';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2);
  return `${minutes}:${seconds.padStart(5, '0')}`;
};

const formatDate = (date: Date | string | null) => {
  const parsedDate = parseDate(date);
  return parsedDate ? parsedDate.toLocaleDateString('ja-JP') : '';
};

const createChartX = (date: Date | string | null, duplicateIndex: number) => {
  const timestamp = parseDate(date)?.getTime() ?? 0;

  // 同日同時刻の複数記録でも、描画順が崩れないよう微小差を付ける
  return timestamp + duplicateIndex;
};

const TimeProgressChart: React.FC<TimeProgressChartProps> = ({ 
  records, 
  style, 
  distance
}) => {
  const filteredRecords = React.useMemo<ChartRecord[]>(() => {
    const duplicateCounts = new Map<number, number>();

    return records
      .filter(r => {
        return r.style === style &&
               r.distance === distance;
      })
      .sort((a, b) => {
        const timeDiff =
          (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0);

        if (timeDiff !== 0) {
          return timeDiff;
        }

        return a.id - b.id;
      })
      .map((record) => {
        const timestamp = parseDate(record.date)?.getTime() ?? 0;
        const duplicateIndex = duplicateCounts.get(timestamp) ?? 0;
        duplicateCounts.set(timestamp, duplicateIndex + 1);

        return {
          ...record,
          chartX: createChartX(record.date, duplicateIndex),
          dateLabel: formatDate(record.date),
        };
      });
  }, [records, style, distance]);

  // プール長ごとの色を定義
  const poolColors = {
    15: { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.5)' },   // オレンジ（15mプール）
    25: { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' },   // 赤（25mプール）
    50: { border: 'rgb(53, 162, 235)', background: 'rgba(53, 162, 235, 0.5)' },   // 青（50mプール）
  } as const;

  // プール長の順序を明示的に指定し、存在するプール長のみをフィルタリング
  const poolLengths = [15, 25, 50].filter(length => 
    filteredRecords.some(record => record.poolLength === length)
  ).sort((a, b) => a - b);

  const data = {
    datasets: poolLengths.map(poolLength => {
      const color = poolColors[poolLength as keyof typeof poolColors];
      const poolRecords = filteredRecords.filter(record => record.poolLength === poolLength);

      return {
        label: poolLength === 15 ? "15m" :
               poolLength === 25 ? "25m（短水路）" :
               "50m（長水路）",
        data: poolRecords.map((record): ChartPoint => ({
          x: record.chartX,
          y: timeToSeconds(record.time),
          isCompetition: record.isCompetition,
          competitionName: record.competitionName,
          competitionLocation: record.competitionLocation,
          time: record.time,
          poolLength: record.poolLength,
          dateLabel: record.dateLabel,
        })),
        parsing: false,
        borderColor: color.border,
        backgroundColor: color.background,
        tension: 0,
        pointStyle: poolRecords.map(record => record.isCompetition ? 'star' : 'circle'),
        pointRadius: poolRecords.map(record => record.isCompetition ? 8 : 4),
      };
    }),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${style} ${distance}m の記録推移`,
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const raw = items[0]?.raw;
            if (!raw || typeof raw !== 'object' || !('dateLabel' in raw)) {
              return '';
            }

            return String(raw.dateLabel);
          },
          label: (context: TooltipItem<'line'>) => {
            if (!context.raw || typeof context.raw !== 'object') return '';
            const data = context.raw as { 
              y: number, 
              isCompetition: boolean,
              competitionName: string | null,
              competitionLocation: string | null,
              time: string,
              poolLength: number
            };
            
            const timeStr = formatSeconds(Number(data.y));
            if (data.isCompetition && data.competitionName) {
              const location = data.competitionLocation ? ` @ ${data.competitionLocation}` : '';
              return `${timeStr} (${data.competitionName}${location})`;
            }
            return timeStr;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        afterBuildTicks: (axis) => {
          axis.ticks = filteredRecords.map((record) => ({
            value: record.chartX,
          }));
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          callback: (value) => {
            return formatDate(new Date(Number(value)));
          },
        },
      },
      y: {
        reverse: true,
        title: {
          display: true,
          text: 'タイム (秒)',
        },
        ticks: {
          callback: function(value: number | string): string {
            return formatSeconds(Number(value));
          },
        },
      },
    },
  };

  return (
    <div className="w-full h-[800px] sm:h-[700px] md:h-[400px]">
      <Line 
        data={data} 
        options={{
          ...options,
          maintainAspectRatio: false,
          responsive: true
        }} 
      />
    </div>
  );
};

export default TimeProgressChart;
