import html2pdf from 'html2pdf.js';

export async function generateRankingsPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error(`Element with id '${elementId}' not found`);
    return;
  }

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: { 
      unit: 'mm' as const, 
      format: 'a4' as const, 
      orientation: 'portrait' as const
    },
    pagebreak: { 
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.pdf-page-break-before',
      after: '.pdf-page-break-after',
    }
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('PDFの生成中にエラーが発生しました');
  }
}
