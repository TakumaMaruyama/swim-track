import React from 'react';
import { useIsMobile } from '../hooks/use-mobile';
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
  const filteredRecords = records
    .filter(r => {
      return r.style === style &&
             r.distance === distance;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date || '');
      const dateB = new Date(b.date || '');
      return dateA.getTime() - dateB.getTime();
    });

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

  const { isMobile } = useIsMobile();
  
  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: isMobile ? 'bottom' as const : 'top' as const,
        align: 'center',
        labels: {
          boxWidth: isMobile ? 6 : 40,
          padding: isMobile ? 6 : 20,
          font: {
            size: isMobile ? 9 : 12,
            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      title: {
        display: true,
        text: `${style} ${distance}m の記録推移`,
        font: {
          size: isMobile ? 13 : 16,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          weight: '500'
        },
        padding: { top: isMobile ? 0 : 10, bottom: isMobile ? 5 : 10 }
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
          display: !isMobile,
          text: 'タイム (秒)',
        },
        ticks: {
          callback: function(this: Scale<CoreScaleOptions>, value: number | string): string {
            value = Number(value);
            const minutes = Math.floor(value / 60);
            const seconds = (value % 60).toFixed(2);
            return `${minutes}:${seconds.padStart(5, '0')}`;
          },
          font: {
            size: isMobile ? 10 : 12
          }
        },
      },
      x: {
        ticks: {
          maxRotation: isMobile ? 45 : 0,
          font: {
            size: isMobile ? 10 : 12
          }
        }
      }
    },
  };

  return (
    <div className="w-full h-[250px] sm:h-[300px] md:h-[400px] p-1 sm:p-2">
      <Line 
        data={data} 
        options={{
          ...options,
          maintainAspectRatio: false,
          responsive: true,
          layout: {
            padding: {
              left: isMobile ? 5 : 20,
              right: isMobile ? 5 : 20,
              top: isMobile ? 5 : 20,
              bottom: isMobile ? 20 : 20
            }
          }
        }} 
      />
    </div>
  );
};

export default TimeProgressChart;
