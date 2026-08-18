/**
 * 《昼回のメモリー》第一句.
 *
 * 简谱是固定调: C=1, D=2, E=3, F=4, G=5, A=6, B=7. Never 1=G / 首调.
 *
 * Same relative line, two keys — do not mix the strings:
 *   C major (the C-major check, 14 notes):
 *     1 2 3 2 3 4 3 2 7 1 2 2 7 1
 *     C D E D E F E D B C D D B C
 *   G major (do not use as the C test; first 8):
 *     5 6 7 6 7 1 7 6
 *     G A B A B C B A
 *
 * They start on the tonic. In C the tonic is 1; in G it is written 5
 * because G=5 when 1=C.
 *
 * Hirumawari audio is in G. For the C-major fixture: transpose concert
 * MIDI down 7 (`fromTonic = 7`) then 固定调, and compare the first 14
 * degrees to HIRUMAWARI_OPENING_C. Raw G-audio 固定调 first 8 may be
 * HIRUMAWARI_OPENING_G8 — that is not the C-major check.
 */
export const HIRUMAWARI_OPENING_C = ["1", "2", "3", "2", "3", "4", "3", "2", "7", "1", "2", "2", "7", "1"] as const;

export const HIRUMAWARI_OPENING_G8 = ["5", "6", "7", "6", "7", "1", "7", "6"] as const;

export const HIRUMAWARI_AUDIO_TONIC = 7;
export const HIRUMAWARI_PHRASE_START = 1.45;
export const HIRUMAWARI_PHRASE_END = 6.4;
