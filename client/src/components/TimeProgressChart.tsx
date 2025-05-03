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
  Scale,
  CoreScaleOptions,
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

const TimeProgressChart: React.FC<TimeProgressChartProps> = ({ 
  records, 
  style, 
  distance
}) => {
  const filteredRecords = React.useMemo(() => {
    return records
      .filter(r => {
        return r.style === style &&
               r.distance === distance;
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || '');
        const dateB = new Date(b.date || '');
        return dateA.getTime() - dateB.getTime();
      });
  }, [records, style, distance]);

  const timeToSeconds = (time: string | null): number => {
    if (!time) return 0;
    try {
      const [minutes, seconds] = time.split(':').map(str => {
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      });
      return (minutes * 60) + seconds;
    } catch (error) {
      console.error('Error parsing time:', error);
      return 0;
    }
  };

  const formatSeconds = (totalSeconds: number): string => {
    if (isNaN(totalSeconds) || totalSeconds === 0) return '0:00.00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);
    return `${minutes}:${seconds.padStart(5, '0')}`;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP');
  };

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
    labels: filteredRecords.map(r => formatDate(r.date)),
    datasets: poolLengths.map(poolLength => {
      const color = poolColors[poolLength as keyof typeof poolColors];
      return {
        label: poolLength === 15 ? "15m" :
               poolLength === 25 ? "25m（短水路）" :
               "50m（長水路）",
        data: filteredRecords
          .filter(r => r.poolLength === poolLength)
          .map(r => {
            return {
              x: formatDate(r.date),
              y: timeToSeconds(r.time),
              isCompetition: r.isCompetition,
              competitionName: r.competitionName,
              competitionLocation: r.competitionLocation,
              time: r.time,
              poolLength: r.poolLength
            };
          }),
        borderColor: color.border,
        backgroundColor: color.background,
        tension: 0.3,
        pointStyle: filteredRecords
          .filter(r => r.poolLength === poolLength)
          .map(r => r.isCompetition ? 'star' : 'circle'),
        pointRadius: filteredRecords
          .filter(r => r.poolLength === poolLength)
          .map(r => r.isCompetition ? 8 : 4),
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
          label: (context: TooltipItem<'line'>) => {
            if (!context.raw || typeof context.raw !== 'object') return '';
            console.log('Tooltip data:', context.raw);
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
