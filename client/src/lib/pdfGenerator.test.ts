// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas';
import { generateRankingsPDF, layoutRankingPages, pdfDateStamp, type RankingPDFRequest } from './pdfGenerator';
import type { GrowthRecord } from './rankingCalculations';

const pdf = vi.hoisted(() => ({ addPage: vi.fn(), addImage: vi.fn(), save: vi.fn(), setProperties: vi.fn() }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({ jsPDF: class { constructor() { return pdf; } } }));

function growthRequest(count: number): RankingPDFRequest {
  const rows = (prefix: string): GrowthRecord[] => Array.from({ length: count }, (_, i) => ({
    rank: i + 1, athleteName: `${prefix}${i + 1}`, studentId: i + 1,
    bestTime: '00:32.123', currentTime: '00:30.985', growthRate: 3.54,
    improvementSeconds: 1.138, bestDate: new Date('2026-06-10'), currentDate: new Date('2026-08-10'),
  }));
  return { kind: 'growth', monthLabel: '2026年8月', rankings: {
    periods: { current: { year: 2026, month: 8 }, previous: { year: 2026, month: 6 } },
    rankings: { '60m': { male: rows('60男'), female: rows('60女') }, '120m': { male: rows('120男'), female: rows('120女') } },
  } };
}

// jsdom has no layout engine. Model a small page to exercise page boundaries;
// actual A4 dimensions and font wrapping are also checked in browser PDF exports.
function mockPageCapacity(height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    let bottom = 0;
    if (this.tagName === 'MAIN') bottom = height;
    if (this.tagName === 'SECTION') {
      for (const section of Array.from(this.parentElement!.children)) {
        bottom += (section.querySelector('h2') ? 30 : 0) + (section.querySelector('thead') ? 30 : 0)
          + section.querySelectorAll('tbody tr').length * 35;
        if (section === this) break;
        bottom += 16;
      }
    }
    return { bottom } as DOMRect;
  });
}

describe('ranking PDF pagination', () => {
  beforeEach(() => { vi.clearAllMocks(); mockPageCapacity(240); });
  afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

  it('keeps every row once and omits repeated page, group and column headings at continuation breaks', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const pages = layoutRankingPages(host, growthRequest(7));
    const names = Array.from(host.querySelectorAll('tbody tr')).map((row) => row.children[1].textContent);
    const expected = ['60男', '60女', '120男', '120女'].flatMap((prefix) => Array.from({ length: 7 }, (_, i) => `${prefix}${i + 1}`));
    expect(names).toEqual(expected);
    expect(pages.length).toBeGreaterThan(1);
    for (const [index, page] of pages.entries()) {
      expect(page.rowCount).toBeGreaterThan(0);
      expect(page.element.querySelectorAll('header')).toHaveLength(index === 0 ? 1 : 0);
      expect(page.element.querySelector('footer')).toBeNull();
      if (index > 0) expect(page.element.style.paddingTop).toBe('20px');
      for (const section of Array.from(page.body.children)) {
        if (section.querySelector('h2')) {
          expect(section.querySelector('h2')?.textContent).toMatch(/個人メドレー \/ [男女]子/);
          expect(section.querySelectorAll('th')).toHaveLength(6);
        } else {
          expect(section.querySelectorAll('th')).toHaveLength(0);
        }
        expect(section.querySelectorAll('col')).toHaveLength(6);
        expect(section.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
        expect(section.getBoundingClientRect().bottom).toBeLessThanOrEqual(240);
      }
    }
    expect(host.querySelectorAll('header')).toHaveLength(1);
    expect(host.querySelectorAll('h2')).toHaveLength(4);
    expect(host.querySelectorAll('thead')).toHaveLength(4);
    expect(host.textContent).not.toContain('（続き）');
    const secondPageFirstGroup = pages[1].body.firstElementChild!;
    expect(secondPageFirstGroup.querySelector('h2')).toBeNull();
    expect(secondPageFirstGroup.querySelector('thead')).toBeNull();
  });

  it('moves a new group with its first row and preserves exact time precision', () => {
    const host = document.createElement('div');
    const pages = layoutRankingPages(host, growthRequest(4));
    expect(pages).toHaveLength(4);
    expect(pages[0].body.querySelectorAll('section')).toHaveLength(1);
    expect(pages[1].body.querySelector('h2')?.textContent).toBe('60m個人メドレー / 女子');
    expect(host.textContent).toContain('00\'32.123"');
    expect(host.textContent).toContain('00\'30.985"');
  });

  it('prints empty categories and names literally without creating HTML from names', () => {
    mockPageCapacity(920);
    const host = document.createElement('div');
    const name = '<img src=x onerror=alert(1)>長い名前のテスト選手';
    const pages = layoutRankingPages(host, { kind: 'measurement', monthLabel: '2026年8月', rankings: {
      '60m': { male: [{ rank: 1, athleteName: name, time: '00:30.985', date: new Date('2026-08-10') }], female: [] },
      '120m': { male: [], female: [] },
    } });
    expect(pages).toHaveLength(1);
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain(name);
    expect(host.textContent?.match(/記録がありません/g)).toHaveLength(3);
  });

  it('captures pages separately and removes the temporary layout after saving', async () => {
    const canvas = { toDataURL: () => 'data:image/jpeg;base64,AA==', width: 794, height: 1123 } as HTMLCanvasElement;
    vi.mocked(html2canvas).mockResolvedValue(canvas);
    await generateRankingsPDF(growthRequest(7), 'rankings.pdf');
    const calls = vi.mocked(html2canvas).mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every(([page, options]) => page.dataset.rankingPdfPage !== undefined && options?.height === 1123)).toBe(true);
    expect(pdf.addImage).toHaveBeenCalledTimes(calls.length);
    expect(pdf.addPage).toHaveBeenCalledTimes(calls.length - 1);
    expect(pdf.save).toHaveBeenCalledWith('rankings.pdf', { returnPromise: true });
    expect(document.body.children).toHaveLength(0);
  });

  it('cleans up and propagates rendering errors, without saving an incomplete PDF', async () => {
    vi.mocked(html2canvas).mockRejectedValue(new Error('canvas failure'));
    await expect(generateRankingsPDF(growthRequest(1), 'rankings.pdf')).rejects.toThrow('canvas failure');
    expect(pdf.save).not.toHaveBeenCalled();
    expect(document.body.children).toHaveLength(0);
    await expect(generateRankingsPDF(growthRequest(0), 'empty.pdf')).rejects.toThrow('出力するランキングがありません');
    expect(document.body.children).toHaveLength(0);
  });

  it('uses the Japanese calendar date for filenames around midnight', () => {
    expect(pdfDateStamp(new Date('2026-09-10T14:59:59Z'))).toBe('2026-09-10');
    expect(pdfDateStamp(new Date('2026-09-10T15:00:00Z'))).toBe('2026-09-11');
  });

  it('rejects a row that cannot fit without splitting it across pages', () => {
    mockPageCapacity(25);
    expect(() => layoutRankingPages(document.createElement('div'), growthRequest(1)))
      .toThrow('1行の内容がA4用紙に収まりません');
  });
});
