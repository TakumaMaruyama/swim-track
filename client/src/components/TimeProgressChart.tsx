import * as React from 'react';
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
        position: 'bottom',
        align: 'start',
        labels: {
          boxWidth: isMobile ? 4 : 12,
          padding: isMobile ? 2 : 10,
          font: {
            size: isMobile ? 7 : 11,
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
          size: isMobile ? 10 : 14,
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          weight: '500'
        },
        padding: { top: 0, bottom: isMobile ? 2 : 8 }
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
            size: isMobile ? 8 : 12
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
            size: isMobile ? 8 : 11
          },
          maxTicksLimit: 6
        },
        grid: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: isMobile ? 8 : 10
          },
          maxTicksLimit: 6,
          padding: isMobile ? 2 : 8
        }
      }
    },
    layout: {
      padding: {
        left: isMobile ? 2 : 8,
        right: isMobile ? 2 : 8,
        top: 0,
        bottom: isMobile ? 16 : 8
      }
    }
  };

  return (
    <div className="w-full h-[180px] sm:h-[280px] lg:h-[400px] p-0.5 sm:p-2 lg:p-4 -mx-1 sm:mx-0">
      <Line 
        data={data} 
        options={options}
        className="!w-full !h-full"
      />
    </div>
  );
};

export default TimeProgressChart;
