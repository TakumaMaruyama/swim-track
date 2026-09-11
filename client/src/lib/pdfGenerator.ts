import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { GrowthRankingsData, IMRankingsData } from './rankingCalculations';

export type RankingPDFRequest =
  | { kind: 'measurement'; rankings: IMRankingsData; monthLabel: string }
  | { kind: 'growth'; rankings: GrowthRankingsData; monthLabel: string };

type PDFRow = { cells: string[]; tone?: 'improved' | 'regressed' };
type PDFGroup = { title: string; rows: PDFRow[] };
type PDFPage = { element: HTMLElement; body: HTMLElement; footer: HTMLElement; rowCount: number };

// Render one fixed-size A4 page at a time, independent of the screen width.
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const INK = '#172033';

export function pdfDateStamp(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date);
}

function formatTime(time: string): string {
  const [minutes, seconds] = time.split(':');
  return seconds ? `${minutes}'${seconds}"` : time;
}

function groupsFor(request: RankingPDFRequest): PDFGroup[] {
  return (['60m', '120m'] as const).flatMap((distance) =>
    (['male', 'female'] as const).map((gender) => ({
      title: `${distance}個人メドレー / ${gender === 'male' ? '男子' : '女子'}`,
      rows: request.kind === 'measurement'
        ? request.rankings[distance][gender].map((row) => ({ cells: [
          String(row.rank), row.athleteName, formatTime(row.time),
          row.date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        ] }))
        : request.rankings.rankings[distance][gender].map((row) => ({
          cells: [String(row.rank), row.athleteName, formatTime(row.bestTime), formatTime(row.currentTime),
            `${row.growthRate > 0 ? '+' : ''}${row.growthRate.toFixed(2)}%`,
            `${row.improvementSeconds > 0 ? '-' : row.improvementSeconds < 0 ? '+' : ''}${Math.abs(row.improvementSeconds).toFixed(2)}秒`],
          tone: row.growthRate > 0 ? 'improved' as const : row.growthRate < 0 ? 'regressed' as const : undefined,
        })),
    }))
  );
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, style: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.style.cssText = style;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createPage(host: HTMLElement, request: RankingPDFRequest): PDFPage {
  const element = node('div', `box-sizing:border-box;width:${PAGE_WIDTH}px;height:${PAGE_HEIGHT}px;padding:40px;background:#fff;color:${INK};font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;`);
  element.dataset.rankingPdfPage = '';
  const header = node('header', 'box-sizing:border-box;height:76px;margin-bottom:16px;border-bottom:2px solid #2563eb;');
  header.append(node('h1', 'margin:0 0 6px;font-size:23px;line-height:30px;font-weight:700;', request.kind === 'measurement' ? 'IM測定ランキング' : 'IM伸び率ランキング'));
  header.append(node('p', 'margin:0;font-size:13px;line-height:19px;', `${request.monthLabel}測定結果${request.kind === 'growth' ? ' / 過去の自己ベストとの比較' : ' / 各種目・男女別 上位3名'}`));
  const body = node('main', 'height:920px;overflow:hidden;');
  const footer = node('footer', 'box-sizing:border-box;height:31px;padding-top:10px;border-top:1px solid #dbe3ef;display:flex;justify-content:space-between;font-size:10px;line-height:14px;color:#64748b;');
  element.append(header, body, footer);
  host.append(element);
  return { element, body, footer, rowCount: 0 };
}

function createGroup(page: PDFPage, title: string, continued: boolean, growth: boolean) {
  const section = node('section', 'margin:0 0 16px;');
  section.append(node('h2', 'margin:0 0 7px;font-size:16px;line-height:23px;font-weight:700;', `${title}${continued ? '（続き）' : ''}`));
  const table = node('table', 'width:100%;border-collapse:collapse;table-layout:fixed;');
  const widths = growth ? [7, 33, 16, 16, 14, 14] : [7, 45, 23, 25];
  const columns = growth ? ['順位', '選手名', '自己ベスト', '今回', '伸び率', 'タイム差'] : ['順位', '選手名', 'タイム', '測定日'];
  const colgroup = node('colgroup', '');
  widths.forEach((width) => colgroup.append(node('col', `width:${width}%;`)));
  const thead = node('thead', '');
  const headerRow = node('tr', '');
  columns.forEach((label, index) => headerRow.append(node('th', `padding:6px 7px;background:#eaf0f8;font-size:11px;line-height:17px;text-align:${index === 1 ? 'left' : 'center'};font-weight:700;`, label)));
  thead.append(headerRow);
  const tbody = node('tbody', '');
  table.append(colgroup, thead, tbody);
  section.append(table);
  page.body.append(section);
  return { section, tbody, columnCount: columns.length };
}

function createRow(row: PDFRow | null, index: number, columnCount: number): HTMLTableRowElement {
  const tr = node('tr', `background:${index % 2 === 0 ? '#ffffff' : '#f6f8fc'};`);
  tr.dataset.rankingPdfRow = '';
  if (!row) {
    const td = node('td', 'padding:10px 7px;font-size:12px;line-height:20px;color:#64748b;text-align:center;', '記録がありません');
    td.colSpan = columnCount;
    tr.append(td);
    return tr;
  }
  row.cells.forEach((value, index) => {
    const color = index >= 4 && row.tone ? (row.tone === 'improved' ? '#15803d' : '#b91c1c') : INK;
    tr.append(node('td', `padding:7px;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;vertical-align:middle;color:${color};text-align:${index === 1 ? 'left' : 'center'};${index === 1 ? 'white-space:normal;overflow-wrap:anywhere;' : 'white-space:nowrap;'}font-weight:${index === 0 || index >= 4 ? '700' : '400'};`, value));
  });
  return tr;
}

// Measure actual rows with the browser fonts. Keep headings with at least one row,
// and repeat the event, gender and column headings on every continuation page.
export function layoutRankingPages(host: HTMLElement, request: RankingPDFRequest): PDFPage[] {
  const groups = groupsFor(request);
  if (groups.every((group) => group.rows.length === 0)) throw new Error('出力するランキングがありません');
  const pages = [createPage(host, request)];
  let page = pages[0];
  for (const group of groups) {
    let block = createGroup(page, group.title, false, request.kind === 'growth');
    const rows = group.rows.length ? group.rows : [null];
    for (let index = 0; index < rows.length; index++) {
      const row = createRow(rows[index], index, block.columnCount);
      block.tbody.append(row);
      if (block.section.getBoundingClientRect().bottom > page.body.getBoundingClientRect().bottom) {
        row.remove();
        if (!block.tbody.children.length) block.section.remove();
        if (page.rowCount === 0) throw new Error('1行の内容がA4用紙に収まりません');
        page = createPage(host, request);
        pages.push(page);
        block = createGroup(page, group.title, index > 0, request.kind === 'growth');
        block.tbody.append(row);
        if (block.section.getBoundingClientRect().bottom > page.body.getBoundingClientRect().bottom) {
          throw new Error('1行の内容がA4用紙に収まりません');
        }
      }
      page.rowCount++;
    }
  }
  pages.forEach((page, index) => page.footer.append(node('span', '', 'SwimTrack'), node('span', '', `${index + 1} / ${pages.length}`)));
  return pages;
}

export async function generateRankingsPDF(request: RankingPDFRequest, filename: string): Promise<void> {
  const host = node('div', 'position:fixed;left:-10000px;top:0;pointer-events:none;');
  host.setAttribute('aria-hidden', 'true');
  // html2canvas measures baselines in the original document with a hidden
  // inline image. Undo Tailwind's block-image reset only for that measurement.
  const baselineStyle = node('style', '', 'body > div[style*="visibility: hidden"] > img { display: inline-block !important; }');
  host.append(baselineStyle);
  document.body.append(host);
  try {
    await document.fonts?.ready;
    const pages = layoutRankingPages(host, request);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    pdf.setProperties({ title: request.kind === 'measurement' ? 'IM測定ランキング' : 'IM伸び率ランキング', creator: 'SwimTrack' });
    for (const [index, page] of pages.entries()) {
      const canvas = await html2canvas(page.element, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
        width: PAGE_WIDTH, height: PAGE_HEIGHT, windowWidth: 1024, windowHeight: 1400, scrollX: 0, scrollY: 0,
      });
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
      canvas.width = 0;
      canvas.height = 0;
    }
    await pdf.save(filename, { returnPromise: true });
  } finally {
    host.remove();
  }
}
