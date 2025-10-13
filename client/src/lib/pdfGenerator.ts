import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type RankingRecord = {
  rank: number;
  athleteName: string;
  time: string;
  date: Date;
};

type GrowthRecord = {
  rank: number;
  athleteName: string;
  studentId: number;
  bestTime: string;
  currentTime: string;
  growthRate: number;
  improvementSeconds: number;
  bestDate: Date;
  currentDate: Date;
};

type IMRankingsData = {
  '60m': {
    male: RankingRecord[];
    female: RankingRecord[];
  };
  '120m': {
    male: RankingRecord[];
    female: RankingRecord[];
  };
};

type GrowthRankingsData = {
  periods: {
    current: { year: number; month: number };
    previous: { year: number; month: number };
  };
  rankings: {
    '60m': {
      male: GrowthRecord[];
      female: GrowthRecord[];
    };
    '120m': {
      male: GrowthRecord[];
      female: GrowthRecord[];
    };
  };
};

function formatTime(time: string): string {
  const [minutes, seconds] = time.split(':');
  if (!seconds) return time;
  return `${minutes}'${seconds}"`;
}

export function generateCombinedRankingsPDF(
  imRankings: IMRankingsData,
  growthRankings: GrowthRankingsData,
  imMonth: string,
  growthMonth: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text('IM測定ランキング・伸び率レポート', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 15;

  doc.setFontSize(14);
  doc.text(`IM測定ランキング (${imMonth})`, 14, yPosition);
  yPosition += 8;

  const imRankingData = [
    { distance: '60m', gender: '男子', data: imRankings['60m'].male },
    { distance: '60m', gender: '女子', data: imRankings['60m'].female },
    { distance: '120m', gender: '男子', data: imRankings['120m'].male },
    { distance: '120m', gender: '女子', data: imRankings['120m'].female },
  ];

  imRankingData.forEach((section) => {
    if (section.data.length > 0) {
      doc.setFontSize(12);
      doc.text(`${section.distance} ${section.gender}`, 14, yPosition);
      yPosition += 5;

      const tableData = section.data.map((record) => [
        record.rank.toString(),
        record.athleteName,
        formatTime(record.time),
        new Date(record.date).toLocaleDateString('ja-JP'),
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['順位', '選手名', 'タイム', '記録日']],
        body: tableData,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 10,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
        },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 8;

      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
    }
  });

  if (yPosition > 200) {
    doc.addPage();
    yPosition = 20;
  } else {
    yPosition += 10;
  }

  doc.setFontSize(14);
  doc.text(`IM伸び率ランキング (${growthMonth})`, 14, yPosition);
  yPosition += 8;

  const growthRankingData = [
    { distance: '60m', gender: '男子', data: growthRankings.rankings['60m'].male },
    { distance: '60m', gender: '女子', data: growthRankings.rankings['60m'].female },
    { distance: '120m', gender: '男子', data: growthRankings.rankings['120m'].male },
    { distance: '120m', gender: '女子', data: growthRankings.rankings['120m'].female },
  ];

  growthRankingData.forEach((section) => {
    if (section.data.length > 0) {
      doc.setFontSize(12);
      doc.text(`${section.distance} ${section.gender}`, 14, yPosition);
      yPosition += 5;

      const tableData = section.data.map((record) => [
        record.rank.toString(),
        record.athleteName,
        formatTime(record.bestTime),
        formatTime(record.currentTime),
        `${record.growthRate > 0 ? '+' : ''}${record.growthRate.toFixed(2)}%`,
        `${record.improvementSeconds > 0 ? '-' : '+'}${Math.abs(record.improvementSeconds).toFixed(2)}秒`,
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['順位', '選手名', '自己ベスト', '今回', '伸び率', '改善']],
        body: tableData,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9,
        },
        headStyles: {
          fillColor: [40, 167, 69],
          textColor: 255,
          fontStyle: 'bold',
        },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 8;

      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
    }
  });

  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`IM_Rankings_Report_${timestamp}.pdf`);
}
