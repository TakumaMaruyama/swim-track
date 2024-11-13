import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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
  poolLength: number;
}

export function TimeProgressChart({ records, style, distance, poolLength }: TimeProgressChartProps) {
  const filteredRecords = records
    .filter(r => {
      console.log('Filtering record:', {
        recordStyle: r.style,
        recordDistance: r.distance,
        recordPoolLength: r.poolLength,
        expectedPoolLength: poolLength
      });
      return r.style === style && 
             r.distance === distance && 
             r.poolLength === poolLength;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const timeToSeconds = (time: string) => {
    const [minutes, seconds] = time.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  const data = {
    labels: filteredRecords.map(r => new Date(r.date).toLocaleDateString('ja-JP')),
    datasets: [
      {
        label: `${style} ${distance}m (${poolLength}mプール)`,
        data: filteredRecords.map(r => timeToSeconds(r.time)),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.3,
        pointStyle: filteredRecords.map(r => r.isCompetition ? 'star' : 'circle'),
        pointRadius: filteredRecords.map(r => r.isCompetition ? 8 : 4),
      },
    ],
  };

  const options = {
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
          label: (context: any) => {
            const seconds = context.raw;
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
          callback: (value: number) => {
            const minutes = Math.floor(value / 60);
            const seconds = (value % 60).toFixed(2);
            return `${minutes}:${seconds.padStart(5, '0')}`;
          },
        },
      },
    },
  };

  return (
    <div className="w-full h-[300px]">
      <Line data={data} options={options} />
    </div>
  );
}