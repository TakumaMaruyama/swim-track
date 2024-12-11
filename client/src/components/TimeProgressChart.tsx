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

  const timeToSeconds = (time: string) => {
    const [minutes, seconds] = time.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  // Group records by pool length
  const poolLengths = [...new Set(filteredRecords.map(r => r.poolLength))].sort();
  const colors = [
    { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.5)' },
    { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' },
    { border: 'rgb(53, 162, 235)', background: 'rgba(53, 162, 235, 0.5)' },
  ];

  const data = {
    labels: filteredRecords.map(r => formatDate(r.date)),
    datasets: poolLengths.map((poolLength, index) => ({
      label: poolLength === 15 ? "15ｍプール" :
             poolLength === 25 ? "25ｍプール（短水路）" :
             "50ｍプール（長水路）",
      data: filteredRecords
        .filter(r => r.poolLength === poolLength)
        .map(r => ({
          x: formatDate(r.date),
          y: timeToSeconds(r.time)
        })),
      borderColor: colors[index % colors.length].border,
      backgroundColor: colors[index % colors.length].background,
      tension: 0.3,
      pointStyle: filteredRecords
        .filter(r => r.poolLength === poolLength)
        .map(r => r.isCompetition ? 'star' : 'circle'),
      pointRadius: filteredRecords
        .filter(r => r.poolLength === poolLength)
        .map(r => r.isCompetition ? 8 : 4),
    })),
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
            const seconds = context.raw as number;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = (seconds % 60).toFixed(2);
            return `${minutes}:${remainingSeconds.padStart(5, '0')}`;
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
          callback: function(this: Scale<CoreScaleOptions>, value: number | string): string {
            value = Number(value);
            const minutes = Math.floor(value / 60);
            const seconds = (value % 60).toFixed(2);
            return `${minutes}:${seconds.padStart(5, '0')}`;
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
