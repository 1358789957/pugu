import { jianpuDegree } from "./leadsheet";

/**
 * C=1 固定调 colors. Accidentals keep their own hue — never collapse onto
 * a diatonic neighbor.
 */
const DEGREE_FILL: Record<string, string> = {
  "1": "#e85d4c",
  "#1": "#e88a4c",
  b2: "#e88a4c",
  "2": "#e8b44c",
  "#2": "#c8c84a",
  b3: "#c8c84a",
  "3": "#9ad44a",
  "4": "#5cbc6c",
  "#4": "#3cbc98",
  b5: "#3cbc98",
  "5": "#3ca8d0",
  "#5": "#4c7ce0",
  b6: "#4c7ce0",
  "6": "#7c5ce0",
  "#6": "#b04cd8",
  b7: "#b04cd8",
  "7": "#e050a0",
};

const DEGREE_INK: Record<string, string> = {
  "1": "#9a2e22",
  "#1": "#9a4e22",
  b2: "#9a4e22",
  "2": "#8a6818",
  "#2": "#6a6a14",
  b3: "#6a6a14",
  "3": "#4a7818",
  "4": "#1e6a32",
  "#4": "#146a54",
  b5: "#146a54",
  "5": "#145878",
  "#5": "#1c3c8a",
  b6: "#1c3c8a",
  "6": "#3c288a",
  "#6": "#6a2480",
  b7: "#6a2480",
  "7": "#8a2460",
};

export function jianpuDegreeKey(midi: number): string {
  return jianpuDegree(midi);
}

export function degreeFill(midi: number): string {
  return DEGREE_FILL[jianpuDegreeKey(midi)] ?? "#9b9288";
}

export function degreeInk(midi: number): string {
  return DEGREE_INK[jianpuDegreeKey(midi)] ?? "#4a453e";
}

export function degreeFillAlpha(midi: number, alpha: number): string {
  const hex = degreeFill(midi).slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
