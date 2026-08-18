/**
 * 《昼回のメモリー》开口两句.
 *
 * 简谱是固定调: C=1, D=2, E=3, F=4, G=5, A=6, B=7. Never 1=G / 首调.
 *
 * C-major checks only (do not use G-major numbering as the C test):
 *   第一句 (14): 1 2 3 2 3 4 3 2 7 1 2 2 7 1
 *               C D E D E F E D B C D D B C
 *   第二句 (13): 6 7 1 7 1 1 1 7 5 1 2 1 3
 *               A B C B C C C B G C D C E
 *
 * G-audio 固定调 of the same concert line is a different string
 * (第一句 5 6 7… / 第二句 3 #4 5…) — not the C fixture.
 *
 * Hirumawari audio is in G. Transpose concert MIDI down 7
 * (`fromTonic = 7`) then 固定调 before comparing.
 */
export const HIRUMAWARI_OPENING_C = ["1", "2", "3", "2", "3", "4", "3", "2", "7", "1", "2", "2", "7", "1"] as const;

export const HIRUMAWARI_PHRASE2_C = ["6", "7", "1", "7", "1", "1", "1", "7", "5", "1", "2", "1", "3"] as const;

export const HIRUMAWARI_OPENING_G8 = ["5", "6", "7", "6", "7", "1", "7", "6"] as const;

export const HIRUMAWARI_PHRASE2_G = ["3", "#4", "5", "#4", "5", "5", "5", "#4", "2", "5", "6", "5", "7"] as const;

export const HIRUMAWARI_AUDIO_TONIC = 7;
export const HIRUMAWARI_PHRASE_START = 1.45;
export const HIRUMAWARI_PHRASE_END = 6.4;
export const HIRUMAWARI_PHRASE2_START = 7.55;
export const HIRUMAWARI_PHRASE2_END = 12.0;
