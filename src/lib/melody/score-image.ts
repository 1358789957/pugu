import type { LeadLine } from "./leadsheet";

type ScoreMeta = {
  title: string;
  keyMark: string;
  keyName: string;
  bpm: number;
};

const W = 1400;
const MARGIN_X = 88;
const MARGIN_Y = 72;

function parseJianpu(raw: string): { body: string; up: number; down: number } {
  const up = (raw.match(/'/g) ?? []).length;
  const down = (raw.match(/,/g) ?? []).length;
  return { body: raw.replace(/[' ,]/g, ""), up, down };
}

export async function renderScorePng(lines: LeadLine[], meta: ScoreMeta): Promise<Blob> {
  if (typeof document !== "undefined") {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const inner = W - MARGIN_X * 2;
  const rowH = 108;
  const headerH = 148;
  const footerH = 56;
  const height = headerH + Math.max(1, lines.length) * rowH + footerH;

  const canvas = document.createElement("canvas");
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法绘制词谱");
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, height);

  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 42px 'Noto Serif SC', 'Songti SC', serif";
  ctx.fillText(meta.title || "词谱", W / 2, 70);

  ctx.fillStyle = "#444444";
  ctx.font = "500 18px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.fillText(`${meta.keyMark}    4/4    ${Math.round(meta.bpm)} 拍    ${meta.keyName}`, W / 2, 104);

  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, 122);
  ctx.lineTo(W - MARGIN_X, 122);
  ctx.stroke();

  lines.forEach((line, li) => {
    const y0 = headerH + li * rowH;
    const cells = line.cells.length ? line.cells : [];
    const n = Math.max(1, cells.length);
    const colW = inner / n;

    cells.forEach((cell, i) => {
      const cx = MARGIN_X + colW * i + colW / 2;
      if (cell.bar && i > 0) {
        ctx.strokeStyle = "#222222";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(MARGIN_X + colW * i, y0 + 6);
        ctx.lineTo(MARGIN_X + colW * i, y0 + rowH - 14);
        ctx.stroke();
      }

      if (cell.chord) {
        ctx.fillStyle = "#111111";
        ctx.font = "600 15px 'IBM Plex Mono', ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(cell.chord, cx, y0 + 22);
      }

      const jp = parseJianpu(cell.jianpu || cell.name);
      ctx.fillStyle = "#111111";
      ctx.font = "600 26px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillText(jp.body + (cell.dash ? ` ${cell.dash}` : ""), cx, y0 + 56);

      if (jp.up) {
        ctx.beginPath();
        ctx.arc(cx, y0 + 32, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (jp.down) {
        ctx.beginPath();
        ctx.arc(cx, y0 + 64, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (cell.under) {
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = cell.under === 2 ? 2 : 1;
        const uw = 16;
        ctx.beginPath();
        ctx.moveTo(cx - uw, y0 + 62);
        ctx.lineTo(cx + uw, y0 + 62);
        ctx.stroke();
        if (cell.under === 2) {
          ctx.beginPath();
          ctx.moveTo(cx - uw, y0 + 66);
          ctx.lineTo(cx + uw, y0 + 66);
          ctx.stroke();
        }
      }

      const word = cell.lyric || (i === 0 ? line.text : "");
      if (word) {
        ctx.fillStyle = "#111111";
        ctx.font = "600 22px 'Noto Serif SC', 'Songti SC', serif";
        ctx.fillText(word, cx, y0 + 92);
      }
    });
  });

  ctx.fillStyle = "#888888";
  ctx.font = "400 13px 'Noto Sans SC', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("谱骨  ·  简谱词谱", W / 2, height - 22);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("导出图片失败"));
    }, "image/png");
  });
}
