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
}

export function TimeProgressChart({ records, style, distance }: TimeProgressChartProps) {
  const filteredRecords = records
    .filter(r => r.style === style && r.distance === distance)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const data = {
    labels: filteredRecords.map(r => new Date(r.date).toLocaleDateString('ja-JP')),
    datasets: [
      {
        label: `${style} ${distance}m`,
        data: filteredRecords.map(r => {
          const [minutes, seconds] = r.time.split(':');
          return parseFloat(minutes) * 60 + parseFloat(seconds);
        }),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
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
    },
    scales: {
      y: {
        reverse: true,
        title: {
          display: true,
          text: 'タイム (秒)',
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
