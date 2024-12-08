import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();
  
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
    return new Date(date).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric'
    });
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
             poolLength === 25 ? "25ｍプール" :
             "50ｍプール",
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
        .map(r => r.isCompetition ? 6 : 3),
    })),
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isMobile ? 'bottom' : 'top',
        align: 'start',
        labels: {
          boxWidth: isMobile ? 6 : 12,
          padding: isMobile ? 4 : 10,
          font: {
            size: isMobile ? 8 : 11,
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
          size: isMobile ? 12 : 14,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          weight: '500'
        },
        padding: { top: isMobile ? 4 : 8, bottom: isMobile ? 4 : 8 }
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
          text: 'タイム',
          font: {
            size: isMobile ? 10 : 12
          }
        },
        ticks: {
          callback: function(this: Scale<CoreScaleOptions>, value: number | string): string {
            value = Number(value);
            const minutes = Math.floor(value / 60);
            const seconds = (value % 60).toFixed(2);
            return `${minutes}:${seconds.padStart(5, '0')}`;
          },
          font: {
            size: isMobile ? 9 : 11
          },
          maxTicksLimit: isMobile ? 6 : 8
        },
        grid: {
          display: !isMobile
        }
      },
      x: {
        grid: {
          display: !isMobile
        },
        ticks: {
          maxRotation: isMobile ? 45 : 0,
          minRotation: isMobile ? 45 : 0,
          font: {
            size: isMobile ? 9 : 10
          },
          maxTicksLimit: isMobile ? 6 : 10
        }
      }
    },
    layout: {
      padding: {
        left: isMobile ? 4 : 8,
        right: isMobile ? 4 : 8,
        top: isMobile ? 4 : 8,
        bottom: isMobile ? 20 : 8
      }
    }
  };

  return (
    <div className="w-full h-[200px] sm:h-[300px] md:h-[400px] p-1 sm:p-4">
      <Line 
        data={data} 
        options={options}
        className="!w-full !h-full"
      />
    </div>
  );
};

export default TimeProgressChart;
