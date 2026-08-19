/**
 * Full (or verse+one chorus) published 首调 from jianpu.space.
 * Parsed from #jianpuOut: skip 前奏/间奏/尾奏, first lyric occurrence only.
 * Each lyric-cued line is one phrase. Decode and score phrase-by-phrase.
 * Do not treat 昼回 1+2 as the ruler for this set.
 */
import { NEW_POP_FULL_FIXTURES } from "./pop-new-fixtures";
export type FullPopSpan = "full-vocal-once" | "verse+chorus";

export type FullPopPhrase = {
  lyric: string;
  publishedMovableDo: readonly string[];
};

export type FullPopFixture = {
  id: string;
  publishedKey: string;
  siteBpm: number | null;
  span: FullPopSpan;
  nFullVocalOnce: number;
  throughLyric: string;
  phrases: readonly FullPopPhrase[];
  publishedFullMovableDo: readonly string[];
};

export const GAOBAI_QIQU_PHRASES = [
  { lyric: "塞納河畔 左岸的咖啡", publishedMovableDo: ["1", "1", "7,", "1", "7,", "1", "7,", "1", "2"] },
  { lyric: "我手一杯 品嚐你的美", publishedMovableDo: ["7,", "7,", "6,", "7,", "6,", "7,", "6,", "7,", "1"] },
  { lyric: "留下唇印的嘴 嗚___", publishedMovableDo: ["6,", "1", "3", "2", "1", "3", "4", "3", "2", "1"] },
  { lyric: "花店玫瑰 名字寫錯誰", publishedMovableDo: ["7,", "1", "7,", "1", "7,", "1", "7,", "1", "2"] },
  { lyric: "告白氣球 風吹到對街", publishedMovableDo: ["6,", "7,", "6,", "7,", "6,", "7,", "6,", "7,", "1"] },
  { lyric: "微笑在天上飛", publishedMovableDo: ["6,", "1", "3", "2", "1", "1", "6,", "7,"] },
  { lyric: "你說你有點難追 想讓我知難而退", publishedMovableDo: ["1", "1", "1", "1", "1", "6,", "7,", "1", "1", "1", "2", "2", "5,", "6,"] },
  { lyric: "禮物不需挑最貴 只要香榭的落葉", publishedMovableDo: ["7,", "7,", "7,", "7,", "7,", "5,", "6,", "7,", "7,", "7,", "1", "1", "1", "2"] },
  { lyric: "營造浪漫的約會 不害怕搞砸一切", publishedMovableDo: ["3", "3", "3", "6,", "1", "1", "2", "3", "3", "3", "6,", "1", "1", "2"] },
  { lyric: "擁有你就擁有 全世界_", publishedMovableDo: ["3", "3", "3", "3", "1", "2", "2", "3", "5,", "4", "3"] },
  { lyric: "親愛的 愛上你 從那天起", publishedMovableDo: ["4", "3", "2", "1", "2", "3", "1"] },
  { lyric: "甜蜜的很輕易", publishedMovableDo: ["6,", "1", "5", "1", "3", "3"] },
  { lyric: "親愛的 別任性 你的眼睛", publishedMovableDo: ["5,", "4", "3", "4", "3", "2", "1", "2", "3", "6"] },
  { lyric: "在說我願意", publishedMovableDo: ["3", "6,", "1", "2", "1", "1", "2"] },
  { lyric: "親愛的 愛上你 戀愛日記", publishedMovableDo: ["5,", "4", "3", "4", "3", "2", "1", "2", "3", "1"] },
  { lyric: "飄香水的回憶", publishedMovableDo: ["6,", "1", "5", "1", "3", "3"] },
  { lyric: "一整瓶 的夢境 全都有你", publishedMovableDo: ["5,", "4", "3", "4", "3", "2", "1", "2", "3", "6"] },
  { lyric: "攪拌在一起_", publishedMovableDo: ["3", "6,", "1", "2", "2"] },
] as const;

export const GAOBAI_QIQU_FULL = GAOBAI_QIQU_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const YEKONG_ZUI_LIANG_PHRASES = [
  { lyric: "夜空中最亮的星,能否聽清", publishedMovableDo: ["3", "2", "3", "2", "3", "5", "5", "5,", "1", "2", "1", "1"] },
  { lyric: "那仰望的人,心底的孤獨和嘆息", publishedMovableDo: ["1", "2", "3", "1", "5,", "1", "2", "3", "1", "5,", "2", "3", "5,"] },
  { lyric: "oh夜空中最亮的星,能否記起", publishedMovableDo: ["3", "2", "3", "2", "3", "5", "5", "5,", "1", "2", "1", "1"] },
  { lyric: "曾與我同行,消失在風裡的身影__", publishedMovableDo: ["1", "2", "3", "1", "5,", "1", "2", "3", "1", "5,", "5", "3", "4", "5", "5", "3'", "2'", "1'"] },
  { lyric: "我祈禱擁有一顆透明的心靈", publishedMovableDo: ["1'", "1'", "1'", "6", "5", "5'", "6'", "6'", "1'", "2'"] },
  { lyric: "和會流淚的眼睛", publishedMovableDo: ["3'", "5'", "5'", "1'", "2'"] },
  { lyric: "給我再去相信的勇氣", publishedMovableDo: ["1'", "1'", "1'", "1'", "6", "5", "5'", "6'", "6'", "1'", "1'", "2'"] },
  { lyric: "oh越過謊言去擁抱你", publishedMovableDo: ["3'", "5'", "5", "5'", "3'", "2'", "3'", "2'", "1'"] },
  { lyric: "每當我找不到存在的意義", publishedMovableDo: ["1'", "1'", "1'", "6", "5", "5'", "6'", "6'", "1'", "1'", "2'"] },
  { lyric: "每當我迷失在黑夜裡", publishedMovableDo: ["3'", "5'", "5'", "5'", "1'", "2'", "2'", "3'", "1'"] },
  { lyric: "oh~__夜空中最亮的星", publishedMovableDo: ["1'", "1'", "1'", "6", "5'", "6'", "6'", "1'", "2'"] },
  { lyric: "請指引我靠近你", publishedMovableDo: ["3'", "5'", "5'", "3'", "2'"] },
  { lyric: "夜空中最亮的星,是否知道", publishedMovableDo: ["3", "2", "3", "2", "3", "5", "5", "5,", "1", "2", "1", "1"] },
  { lyric: "曾與我同行的身影,如今在哪裡", publishedMovableDo: ["1", "2", "3", "1", "5,", "1", "2", "3", "1", "5,", "2", "3", "5,"] },
  { lyric: "oh夜空中最亮的星,是否在意", publishedMovableDo: ["3", "2", "3", "2", "3", "5", "5", "5,", "1", "2", "1", "1", "1"] },
  { lyric: "是等太陽升起,還是意外先來臨__", publishedMovableDo: ["1", "2", "3", "1", "5,", "1", "2", "3", "1", "5", "3", "4", "5", "5", "3'", "2'", "1'"] },
  { lyric: "我寧願所有痛苦都留在心裡", publishedMovableDo: ["1'", "1'", "1'", "6", "5", "5'", "6'", "6'", "1'", "1'", "2'"] },
  { lyric: "也不願忘記你的眼睛__", publishedMovableDo: ["3'", "5'", "5'", "5'", "1'", "2'", "1'", "7"] },
  { lyric: "oh請照亮我前行", publishedMovableDo: ["3'", "5'", "5'", "3'", "2'"] },
] as const;

export const YEKONG_ZUI_LIANG_FULL = YEKONG_ZUI_LIANG_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const QINGHUACI_PHRASES = [
  { lyric: "素胚勾勒出青花筆鋒濃轉淡", publishedMovableDo: ["2", "1", "6,", "1", "1", "6,", "1", "1", "6,", "1", "6,", "5,", "2", "1", "6,"] },
  { lyric: "瓶身描繪的牡丹一如妳初妝", publishedMovableDo: ["1", "1", "6,", "1", "1", "3", "2", "1", "1", "5,", "6,", "3"] },
  { lyric: "冉冉檀香透過窗心事我了然", publishedMovableDo: ["3", "3", "2", "3", "3", "2", "3", "5", "3", "3", "3", "3"] },
  { lyric: "宣紙上走筆至此擱一半__", publishedMovableDo: ["2", "2", "2", "2", "2", "1", "2", "3", "2", "2", "1", "6,"] },
  { lyric: "釉色渲染仕女圖韻味被私藏", publishedMovableDo: ["1", "1", "6,", "1", "1", "6,", "1", "6,", "5,", "5,", "6,", "3"] },
  { lyric: "而妳嫣然的一笑如含苞待放", publishedMovableDo: ["5", "5", "3", "5", "5", "3", "2", "1", "1", "2", "1", "2"] },
  { lyric: "妳的美一縷飄_散 去到我去不了的地方", publishedMovableDo: ["3", "2", "2", "1", "2", "1", "6,", "2", "1", "1", "6,", "1", "1", "1"] },
  { lyric: "天青色等煙雨 而我在等妳", publishedMovableDo: ["5", "5", "3", "2", "3", "6,", "2", "3", "5", "3"] },
  { lyric: "炊煙裊裊昇起 隔江千萬里", publishedMovableDo: ["2", "5", "5", "3", "2", "3", "5,", "2", "3", "5", "2"] },
  { lyric: "在瓶底書漢隸仿前朝的飄逸", publishedMovableDo: ["1", "1", "2", "3", "5", "6", "5", "3", "5", "3", "3", "2"] },
  { lyric: "就當我為遇見妳伏筆", publishedMovableDo: ["2", "1", "2", "1", "2", "1", "2", "3", "5"] },
  { lyric: "月色被打撈起 暈開了結局", publishedMovableDo: ["2", "5", "5", "3", "2", "3", "5,", "2", "3", "5", "2"] },
  { lyric: "如傳世的青花瓷自顧自美麗 妳眼帶笑意", publishedMovableDo: ["1", "1", "2", "3", "5", "6", "5", "3", "5", "3", "3", "2", "2", "5,", "3", "2", "2", "1"] },
  { lyric: "色白花青的錦鯉躍然於碗底", publishedMovableDo: ["2", "1", "6,", "1", "1", "6,", "1", "1", "6,", "1", "6,", "5,", "2", "1", "6,"] },
  { lyric: "臨摹宋體落款時卻惦記著妳", publishedMovableDo: ["1", "1", "6,", "1", "1", "3", "2", "1", "1", "5,", "6,", "3"] },
  { lyric: "妳隱藏在窯燒裡千年的秘密", publishedMovableDo: ["3", "3", "2", "3", "3", "2", "3", "5", "3", "3", "3", "3"] },
  { lyric: "極細膩猶如繡花針落地__", publishedMovableDo: ["2", "2", "2", "2", "2", "1", "2", "3", "2", "2", "1", "6,"] },
  { lyric: "簾外芭蕉惹驟雨門環惹銅綠", publishedMovableDo: ["1", "1", "6,", "1", "1", "6,", "1", "6,", "5,", "5,", "6,", "3"] },
  { lyric: "而我路過那江南小鎮惹了妳", publishedMovableDo: ["5", "5", "3", "5", "5", "3", "2", "1", "1", "2", "1", "2"] },
  { lyric: "在潑墨山水畫_裡 妳從墨色深處被隱去__", publishedMovableDo: ["3", "2", "2", "1", "2", "1", "6,", "2", "1", "1", "6,", "1", "1", "1", "2", "1"] },
] as const;

export const QINGHUACI_FULL = QINGHUACI_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const DAOXIANG_PHRASES = [
  { lyric: "對這個世界如果你有太多的抱怨", publishedMovableDo: ["1", "1", "6,", "1", "6,", "1", "1", "1", "2", "2", "2", "2", "3", "1"] },
  { lyric: "跌倒了就不敢繼續往前走", publishedMovableDo: ["1", "6,", "1", "1", "1", "2", "2", "2", "2", "3", "1"] },
  { lyric: "為什麼人要這麼的脆弱 墮落", publishedMovableDo: ["1", "6,", "1", "1", "1", "2", "2", "2", "2", "1", "3"] },
  { lyric: "請你打開電視看看", publishedMovableDo: ["3", "1", "1", "1", "6,", "1", "1", "1", "6,"] },
  { lyric: "多少人為生命在努力勇敢的走下去", publishedMovableDo: ["1", "6,", "1", "1", "1", "2", "2", "2", "2", "3", "1", "1"] },
  { lyric: "我們是不是該知足", publishedMovableDo: ["1", "6,", "1", "1", "1", "2", "2", "2", "2", "3", "1"] },
  { lyric: "珍惜一切 就算沒有擁_有", publishedMovableDo: ["1", "4", "3", "2", "2", "1", "2", "1", "2", "3", "1", "3", "5"] },
  { lyric: "還記得你說家是唯一的城堡_ 隨著稻香河流繼續奔跑_", publishedMovableDo: ["5", "5", "5", "5", "5", "5", "5", "5", "3", "2", "1", "1", "3", "3", "3", "3", "3", "3", "3", "3", "1", "6,"] },
  { lyric: "微微笑 小時候的夢我知道", publishedMovableDo: ["6,", "1", "1", "1", "1", "2", "2", "2", "1", "3", "3", "3", "5"] },
  { lyric: "不要哭讓螢火蟲帶著你逃跑_ 鄉間的歌謠永遠的依靠_", publishedMovableDo: ["5", "5", "5", "5", "5", "5", "5", "5", "3", "2", "1", "1", "3", "3", "3", "3", "3", "3", "3", "3", "1", "6,"] },
  { lyric: "回家吧 回到最初的美好", publishedMovableDo: ["6,", "1", "1", "1", "1", "2", "2", "2", "1", "1"] },
] as const;

export const DAOXIANG_FULL = DAOXIANG_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const QIFENGLE_PHRASES = [
  { lyric: "這一路上走走停停", publishedMovableDo: ["2", "1", "2", "1", "2", "3", "5", "3"] },
  { lyric: "順著少年漂流的痕跡", publishedMovableDo: ["2", "1", "2", "1", "2", "3", "2", "1", "6,"] },
  { lyric: "邁出車站的前一刻", publishedMovableDo: ["2", "1", "2", "1", "2", "3", "5", "3"] },
  { lyric: "竟有些猶豫", publishedMovableDo: ["2", "3", "2", "1", "2"] },
  { lyric: "不禁笑這近鄉情怯", publishedMovableDo: ["2", "1", "2", "1", "2", "3", "5", "3"] },
  { lyric: "仍無可避免", publishedMovableDo: ["2", "3", "2", "1", "6,", "3", "2", "1", "2"] },
  { lyric: "而長野的天 依舊那麼暖", publishedMovableDo: ["1", "3", "2", "1", "2", "1", "5,", "3", "2", "1", "7,"] },
  { lyric: "風吹起了從前", publishedMovableDo: ["1", "1", "2", "3", "1"] },
  { lyric: "從前初識這世間 萬般流連", publishedMovableDo: ["6", "5", "6", "1", "7", "6", "7"] },
  { lyric: "看著天邊似在眼_前 也甘願赴湯蹈火去走它一遍_", publishedMovableDo: ["7", "6", "7", "3", "1'", "2'", "1'", "7", "6", "5", "6", "5", "6", "5", "6", "5", "6", "5", "2", "5"] },
  { lyric: "如今走過這世間 萬般流連", publishedMovableDo: ["2", "3", "1", "2", "3", "1", "6", "5", "6", "2", "7", "6", "7"] },
  { lyric: "翻過歲月不同側_臉 措不及防闖入你的笑顏", publishedMovableDo: ["7", "6", "7", "3", "1'", "2'", "1'", "7", "6", "5", "6", "3'", "3'", "5", "6", "3'", "3'", "5"] },
  { lyric: "我曾難自拔於世界之大", publishedMovableDo: ["6", "1'", "2'", "3'", "6'", "5'", "6'", "5'", "6'", "5'", "2'"] },
  { lyric: "也沉溺於其中夢話", publishedMovableDo: ["3'", "6'", "5'", "6'", "5'", "6'", "5'", "3'"] },
  { lyric: "不得真假 不做掙紮 不懼笑_話_", publishedMovableDo: ["2'", "1'", "6", "1'", "1'", "2'", "1'", "6", "1'", "3'", "3'", "2'", "3'", "2'", "1'", "2'"] },
  { lyric: "我曾將青春翻湧成她", publishedMovableDo: ["3'", "6'", "5'", "6'", "5'", "6'", "5'", "2'"] },
  { lyric: "也曾指尖彈出盛夏", publishedMovableDo: ["3'", "6'", "5'", "6'", "5'", "6'", "5'", "3'"] },
  { lyric: "心之所動 且就隨緣去吧", publishedMovableDo: ["2'", "1'", "6", "3'", "2'", "1'", "6", "1'", "1'", "6", "3'"] },
  { lyric: "逆著光行走 任風_吹雨打", publishedMovableDo: ["2'", "1'", "6", "3'", "2'", "1'", "6", "1'", "1'"] },
] as const;

export const QIFENGLE_FULL = QIFENGLE_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const JIANGNAN_PHRASES = [
  { lyric: "風到這裡就是黏 黏住過客的思念", publishedMovableDo: ["6,", "7,", "1", "5", "3", "1", "6,", "7,", "7,", "7,", "1", "7,", "5,", "6,"] },
  { lyric: "雨到了這裡纏成線 纏著我們流連人世間", publishedMovableDo: ["6,", "6,", "7,", "1", "5", "3", "1", "6,", "7,", "7,", "7,", "1", "2", "1", "7,", "5,", "6,"] },
  { lyric: "你在身邊就是緣 緣份寫在三生石_上面", publishedMovableDo: ["6,", "7,", "1", "5", "3", "1", "6,", "7,", "7,", "7,", "1", "7,", "7,", "5,", "6,", "1", "6,"] },
  { lyric: "愛有萬分之一甜 寧願我就葬在這一點", publishedMovableDo: ["6,", "7,", "1", "5", "3", "1", "6,", "7,", "7,", "7,", "1", "2", "1", "7,", "5,", "6,"] },
  { lyric: "圈圈圓圓圈圈 天天年年天天 的我 深深看你的臉", publishedMovableDo: ["3", "3", "3", "3", "3", "3", "3", "3", "3", "3", "3", "3", "3", "3", "4", "3", "1", "2", "1", "1", "1", "1"] },
  { lyric: "生氣的溫柔 埋怨的溫柔 的_臉", publishedMovableDo: ["5", "1", "1", "1", "6,", "5", "1", "1", "6", "5", "5", "1", "2"] },
  { lyric: "不懂愛恨情愁煎熬的我們 都以為相愛就像風雲的善變", publishedMovableDo: ["3", "4", "3", "4", "5", "4", "3", "1", "2", "4", "3", "2", "1", "7,", "1", "2", "3", "2", "1", "2", "7,", "1", "5,"] },
  { lyric: "相信愛一天 抵過永遠 在這一剎那凍結了時間", publishedMovableDo: ["6,", "6", "6", "1", "1", "5", "5", "1", "4", "3", "4", "3", "5", "4", "3", "1", "2", "1", "2"] },
  { lyric: "不懂怎麼表現溫柔的我們 還以為殉情只是古老的傳言", publishedMovableDo: ["3", "4", "3", "4", "5", "4", "3", "1", "2", "4", "3", "2", "1", "7,", "1", "2", "3", "2", "1", "2", "7,", "1", "1", "5,"] },
  { lyric: "離愁能有多痛 痛有多濃 當夢被埋在江南煙雨中", publishedMovableDo: ["6,", "6", "6", "1", "1", "5", "5", "1", "4", "3", "4", "3", "5", "4", "3", "1", "2", "4", "3", "2"] },
  { lyric: "心碎了才懂", publishedMovableDo: ["2", "1"] },
  { lyric: "喔_____", publishedMovableDo: ["5,", "5", "4", "3", "2", "1", "1", "5,"] },
] as const;

export const JIANGNAN_FULL = JIANGNAN_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const HOULAI_PHRASES = [
  { lyric: "後__來 我總算學會了 如何去愛", publishedMovableDo: ["3", "2", "1", "1", "1", "1", "2", "3", "4", "3", "4", "2", "1", "2", "1", "7,"] },
  { lyric: "可惜你早已遠去 消失在人海", publishedMovableDo: ["1", "6,", "6,", "7,", "1", "1", "2", "3", "7,", "7,", "1", "7,", "6,"] },
  { lyric: "後__來 終於在眼淚中明白", publishedMovableDo: ["6,", "6", "5", "4", "3", "4", "5", "7,", "1", "4", "3"] },
  { lyric: "有些人 一旦錯過就不再_", publishedMovableDo: ["4", "4", "4", "3", "2", "1", "7,", "2", "1"] },
  { lyric: "梔子花 白花瓣", publishedMovableDo: ["1", "7,", "1", "3,", "4,", "5,"] },
  { lyric: "落在我藍色百褶裙上", publishedMovableDo: ["6,", "6,", "6,", "5,", "4,", "6,", "5,", "4,", "3,"] },
  { lyric: "愛_你 你輕聲說", publishedMovableDo: ["4,", "5,", "5,", "3,", "5,", "6,", "6,"] },
  { lyric: "我低下頭 聞見一陣芬芳", publishedMovableDo: ["4,", "6,", "6,", "1", "1", "2", "7,", "6,", "6,", "5,"] },
  { lyric: "那個永恆的夜晚 十七歲仲夏", publishedMovableDo: ["1", "7,", "1", "1", "3,", "4,", "5,", "6,", "5,", "4,", "3,"] },
  { lyric: "你吻我的那個夜晚", publishedMovableDo: ["4,", "4,", "4,", "#5,", "#5,", "n5,", "4,", "#5,", "n5,"] },
  { lyric: "讓我往後的時光 每當有感_嘆", publishedMovableDo: ["6,", "7,", "1", "1", "1", "2", "3", "3", "4", "3", "2", "1"] },
  { lyric: "總想起 當天的星_光", publishedMovableDo: ["2", "6,", "6,", "7,", "7,", "1", "2", "2", "1", "1"] },
  { lyric: "那時候 的愛情", publishedMovableDo: ["1", "7,", "1", "3,", "4,", "5,"] },
  { lyric: "為什麼 就能那樣簡單", publishedMovableDo: ["6,", "6,", "6,", "5,", "4,", "6,", "5,", "2,", "3,", "3,"] },
  { lyric: "而又是為什麼 人年少時", publishedMovableDo: ["4,", "4,", "4,", "5,", "5,", "3,", "5,", "6,", "6,"] },
  { lyric: "一定要讓 深愛的人受傷", publishedMovableDo: ["4,", "6,", "6,", "1", "1", "2", "7,", "6,", "6,", "5,"] },
  { lyric: "在這相似的深夜裡 你是否一樣", publishedMovableDo: ["1", "1", "7,", "1", "1", "3,", "4,", "5,", "6,", "5,", "4,", "3,"] },
  { lyric: "也在靜靜 追悔感傷", publishedMovableDo: ["4,", "4,", "4,", "#5,", "#5,", "n5,", "4,", "#5,", "n5,"] },
  { lyric: "如果當時我們能 不那麼倔_強", publishedMovableDo: ["6,", "7,", "1", "1", "1", "2", "3", "3", "4", "3", "2", "1"] },
  { lyric: "現在也 不那麼遺_憾", publishedMovableDo: ["2", "6,", "6,", "7,", "7,", "1", "2", "2", "1", "1", "6,", "6,"] },
  { lyric: "你都如何回憶我 帶著笑或是很沉默", publishedMovableDo: ["4", "3", "4", "1", "7,", "6,", "6,", "6,", "5", "4", "5", "4", "3", "3", "3", "2"] },
  { lyric: "這些年來 有沒有人能讓你不寂寞", publishedMovableDo: ["1", "6,", "6,", "7,", "1", "6,", "1", "3", "3", "2", "2", "3", "2", "1"] },
  { lyric: "永遠不會 再重_來", publishedMovableDo: ["5,", "1", "1", "5,", "5", "4", "3", "4", "1", "1"] },
  { lyric: "有一個男孩 愛著那個女孩", publishedMovableDo: ["4", "4", "4", "4", "3", "2", "1", "1", "1"] },
] as const;

export const HOULAI_FULL = HOULAI_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const TIMIAN_PHRASES = [
  { lyric: "別堆砌懷念讓劇情 變得狗血", publishedMovableDo: ["5,", "3", "3", "2", "3", "3", "2", "3", "3", "2", "3", "7,"] },
  { lyric: "深愛了多年又何必 毀了經典", publishedMovableDo: ["5,", "3", "3", "2", "3", "3", "2", "3", "3", "2", "3", "7,"] },
  { lyric: "都已成年不拖不欠", publishedMovableDo: ["3", "5", "3", "5", "1", "1", "2", "2"] },
  { lyric: "浪費時間是我情願", publishedMovableDo: ["3", "5", "3", "5", "7,", "7,", "5,", "1"] },
  { lyric: "像謝幕的演員 眼看著燈光熄滅", publishedMovableDo: ["3", "5", "3", "5", "1", "1", "5,", "2", "1", "2", "1", "2", "3"] },
  { lyric: "來不及 再轟轟烈烈", publishedMovableDo: ["3", "5", "3", "5", "1", "1", "2", "2"] },
  { lyric: "就保留 告別的尊嚴", publishedMovableDo: ["7", "7", "7", "7", "5", "5", "2", "3"] },
  { lyric: "我愛你不後悔 也尊重故事結尾", publishedMovableDo: ["3", "5", "3", "5", "1", "1", "5,", "2", "1", "2", "1", "7,", "6,"] },
  { lyric: "分手應該體面 誰都不要說抱歉", publishedMovableDo: ["1", "2", "3", "1", "2", "3", "1", "5", "5", "5", "3", "2", "1"] },
  { lyric: "何來虧欠 我敢給就敢心碎", publishedMovableDo: ["1", "6,", "7,", "1", "6,", "3", "3", "3", "7,", "6,", "5,"] },
  { lyric: "鏡頭前面是從前的我們 在喝彩", publishedMovableDo: ["1", "6,", "7,", "1", "5,", "6", "5", "5", "3", "1", "2", "3", "6,"] },
  { lyric: "流著淚聲嘶力竭", publishedMovableDo: ["3", "3", "3", "3", "2", "1", "3"] },
  { lyric: "離開也很體面 才沒辜負這些年", publishedMovableDo: ["1", "2", "3", "1", "2", "3", "1", "5", "5", "5", "3", "2", "1"] },
  { lyric: "愛得熱烈 認真付出的畫面", publishedMovableDo: ["1", "6,", "7,", "1", "6,", "3", "3", "2", "3", "5", "1"] },
  { lyric: "別讓執念 毀掉了昨天", publishedMovableDo: ["1", "6,", "7,", "1", "5,", "6", "5", "7", "1'", "5", "3", "1", "6,"] },
  { lyric: "我愛過你 俐落乾脆", publishedMovableDo: ["3", "6,", "7,", "1"] },
  { lyric: "最熟悉的街主角卻 換了人演", publishedMovableDo: ["5,", "3", "3", "2", "3", "3", "2", "3", "3", "2", "3", "7,"] },
  { lyric: "我哭到哽咽心再痛 就當破繭", publishedMovableDo: ["5,", "3", "3", "2", "3", "3", "2", "3", "3", "2", "3", "7,"] },
  { lyric: "再見 不負遇見", publishedMovableDo: ["3", "6,", "1", "7,", "1", "1"] },
] as const;

export const TIMIAN_FULL = TIMIAN_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const BUNENG_SHUO_DE_MIMI_PHRASES = [
  { lyric: "冷咖啡離開了杯墊", publishedMovableDo: ["5,", "4", "4", "4", "4", "4", "3", "3"] },
  { lyric: "我忍住的情緒在很後面", publishedMovableDo: ["4", "4", "4", "5", "3", "2", "1", "7,", "7,", "1"] },
  { lyric: "拼命想挽回的從前", publishedMovableDo: ["5,", "5", "5", "5", "5", "5", "4", "4"] },
  { lyric: "在我臉上依舊清晰可見", publishedMovableDo: ["5", "5", "5", "5", "5", "4", "4", "3", "3", "2"] },
  { lyric: "最美的不是下雨天", publishedMovableDo: ["5,", "4", "4", "4", "4", "4", "3", "3"] },
  { lyric: "是曾與妳躲過雨的屋簷__", publishedMovableDo: ["4", "4", "4", "5", "3", "2", "1", "7,", "7,", "1", "2", "1"] },
  { lyric: "回憶的畫_面", publishedMovableDo: ["6,", "1", "5", "6", "1", "1"] },
  { lyric: "在盪著鞦韆　夢開始不甜", publishedMovableDo: ["5", "5", "5", "5", "5", "4", "4", "3", "3", "2"] },
  { lyric: "妳說把愛漸漸放下會_走更遠", publishedMovableDo: ["1", "1'", "7", "1'", "1'", "5", "5", "5", "5", "4", "4", "4"] },
  { lyric: "又何必去改變　已錯過_的時間", publishedMovableDo: ["3", "1", "1'", "7", "1'", "1'", "5", "5", "5", "5", "4", "4", "4"] },
  { lyric: "妳用妳的指尖阻止我說再見", publishedMovableDo: ["3", "1", "1'", "7", "1'", "7", "6", "1", "7", "6", "7", "6"] },
  { lyric: "想像妳在身邊　在完全失去之前", publishedMovableDo: ["5", "1", "6", "5", "6", "5", "4", "4", "3", "4", "5", "6", "6"] },
  { lyric: "或許命運的籤　只讓我們遇見", publishedMovableDo: ["3", "1", "1'", "7", "1'", "1'", "5", "5", "5", "5", "2'", "2'"] },
  { lyric: "只讓我們相戀這一季的秋天", publishedMovableDo: ["1'", "1", "1'", "7", "1'", "7", "6", "1", "7", "6", "7", "6"] },
  { lyric: "飄落後才發現　這幸福的碎片_", publishedMovableDo: ["5", "1", "6", "5", "6", "5", "4", "4", "3", "4", "5", "6", "6"] },
  { lyric: "要我怎麼撿", publishedMovableDo: ["5", "4", "3", "5,", "2", "1"] },
] as const;

export const BUNENG_SHUO_DE_MIMI_FULL = BUNENG_SHUO_DE_MIMI_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const GUYONGZHE_PHRASES = [
  { lyric: "都是勇敢的", publishedMovableDo: ["3", "1", "2", "1", "3"] },
  { lyric: "你額頭的傷口 你的不同 你犯的錯", publishedMovableDo: ["1", "2", "1", "2", "3", "6,", "1", "6,", "1", "6,", "1", "2", "1", "7,"] },
  { lyric: "都不必隱藏", publishedMovableDo: ["3", "1", "2", "1", "3"] },
  { lyric: "你破舊的玩偶 你的面具 你的自_我", publishedMovableDo: ["1", "2", "1", "2", "3", "6,", "1", "6,", "1", "6,", "1", "3", "1", "2", "7,"] },
  { lyric: "他們說 要帶著光 馴服每一頭怪獸", publishedMovableDo: ["6,", "1", "6", "6", "6", "5", "6", "6", "5", "6", "5", "6", "5", "3", "6,", "1"] },
  { lyric: "他們說 要縫好你的傷 沒有人愛小_丑", publishedMovableDo: ["6", "6", "6", "5", "6", "5", "7", "7", "7", "6", "7", "5", "6", "3"] },
  { lyric: "為何孤獨不可光榮?", publishedMovableDo: ["3", "5", "3", "2", "3", "2", "3"] },
  { lyric: "人只有不完美 值得歌頌", publishedMovableDo: ["2", "3", "5", "3", "5", "3", "2", "3", "2", "3", "2", "1", "2"] },
  { lyric: "誰說污泥滿身的不算_英雄?", publishedMovableDo: ["3", "6,", "1", "3", "2", "3", "2", "1", "1", "6,"] },
  { lyric: "愛你孤身走暗巷 愛你不跪的模樣", publishedMovableDo: ["6", "7", "1'", "2'", "7", "1'", "1'", "1'", "7", "1'", "2'", "7", "1'", "1'", "1'", "2'"] },
  { lyric: "愛你對峙過絕望 不肯哭一場", publishedMovableDo: ["3'", "2'", "3'", "2'", "3'", "3'", "2'", "3'", "5'", "3'", "6", "7"] },
  { lyric: "愛你破爛的衣裳 卻敢堵命運的槍", publishedMovableDo: ["1'", "2'", "7", "1'", "1'", "1'", "7", "1'", "2'", "7", "1'", "1'", "1'", "2'"] },
  { lyric: "愛你和我那麼像 缺口都一樣", publishedMovableDo: ["3'", "2'", "3'", "2'", "3'", "3'", "2'", "3'", "5'", "3'", "5'"] },
  { lyric: "去嗎? 配嗎? 這襤褸的披風", publishedMovableDo: ["3'", "5'", "3'", "5'", "3'", "5'", "6'", "3'", "5'", "5'"] },
  { lyric: "戰嗎? 戰啊! 以最卑微的夢", publishedMovableDo: ["3'", "5'", "3'", "5'", "3'", "5'", "6'", "3'", "5'", "5'", "5'"] },
  { lyric: "致那黑夜中的嗚咽與怒吼_", publishedMovableDo: ["3'", "2'", "2'", "1'", "3'", "2'", "2'", "1'", "1'", "6"] },
  { lyric: "誰說站在光裡的才算英雄?_", publishedMovableDo: ["5'", "5'", "3'", "2'", "2'", "1'", "3'", "2'", "2'", "1'", "1'", "6"] },
] as const;

export const GUYONGZHE_FULL = GUYONGZHE_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const XIAOQINGGE_PHRASES = [
  { lyric: "這是一首簡_單的小情歌", publishedMovableDo: ["1", "7,", "1", "7,", "1", "7,", "5,", "3,", "5,", "7,", "6,"] },
  { lyric: "唱著人們心腸的曲折", publishedMovableDo: ["1", "7,", "1", "7,", "1", "7,", "1", "3", "3", "6,", "1", "6,"] },
  { lyric: "我想我很快樂  當有你的溫熱", publishedMovableDo: ["1", "3", "2", "5,", "7,", "5,", "7,", "2", "1"] },
  { lyric: "腳邊的空氣轉_了____", publishedMovableDo: ["3", "2", "1", "2", "1", "5,", "b6,", "5,", "1", "7,", "6,", "5,"] },
  { lyric: "唱著我們心頭的白鴿", publishedMovableDo: ["1", "7,", "1", "7,", "1", "7,", "1", "3", "5", "5", "4", "3"] },
  { lyric: "我想我很適合  當一個歌頌者", publishedMovableDo: ["4", "3", "2", "4", "3", "2", "3", "2", "1"] },
  { lyric: "青春在風中飄著", publishedMovableDo: ["3", "2", "3", "4", "3", "1", "2", "5,", "6,", "1"] },
  { lyric: "你知道  就算大雨讓整座城_市顛倒", publishedMovableDo: ["3", "3", "2", "1", "3", "2", "1", "2", "3", "2", "1", "1"] },
  { lyric: "我會給你懷抱_", publishedMovableDo: ["1", "6,", "1", "2", "3", "2", "3", "5,", "6,", "1"] },
  { lyric: "受不了  看見你背影來_到", publishedMovableDo: ["1", "6,", "1", "2", "3", "2", "3", "5,", "5,", "6,", "1"] },
  { lyric: "寫下我  度秒如年難挨__的離騷", publishedMovableDo: ["1", "6,", "1", "2", "3", "2", "3", "2", "2", "1", "2"] },
  { lyric: "就算整個世界被寂_寞綁票", publishedMovableDo: ["3", "3", "2", "1", "3", "2", "1", "2", "3", "2", "1", "1"] },
  { lyric: "我也不會奔跑_", publishedMovableDo: ["1", "6,", "1", "2", "3", "2", "3", "5,", "6,", "1"] },
  { lyric: "逃不了  最後誰也都蒼_老", publishedMovableDo: ["1", "6,", "1", "2", "3", "2", "3", "5,", "5,", "6,", "1"] },
  { lyric: "寫下我  時間和琴聲交__錯的城_堡", publishedMovableDo: ["1", "6,", "1", "2", "3", "2", "3", "2", "2", "1", "1", "2", "1"] },
  { lyric: "da da da da da da da da da da da da da", publishedMovableDo: ["2", "2", "1", "1", "7,", "7,", "1", "2", "2", "1", "1", "7,", "7,"] },
  { lyric: "唱著我們心頭的白鴿__ ho___", publishedMovableDo: ["1", "7,", "1", "7,", "1", "7,", "1", "3", "5", "6", "5", "1'", "7", "6", "5", "5", "4", "3"] },
  { lyric: "最後誰也都蒼_老", publishedMovableDo: ["1", "6,", "1", "2", "3", "2", "3", "5,", "5,", "6,", "1"] },
  { lyric: "哼哼 哼哼 哼哼", publishedMovableDo: ["1", "2", "1", "2", "2", "3"] },
] as const;

export const XIAOQINGGE_FULL = XIAOQINGGE_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const POP_FULL_FIXTURES: FullPopFixture[] = [
  {
    id: "gaobai-qiqu",
    publishedKey: "/key(B3)",
    siteBpm: 90.1,
    span: "full-vocal-once",
    nFullVocalOnce: 168,
    throughLyric: "攪拌在一起_",
    phrases: GAOBAI_QIQU_PHRASES,
    publishedFullMovableDo: GAOBAI_QIQU_FULL,
  },
  {
    id: "yekong-zui-liang",
    publishedKey: "/key(B2)",
    siteBpm: 108,
    span: "full-vocal-once",
    nFullVocalOnce: 204,
    throughLyric: "oh請照亮我前行",
    phrases: YEKONG_ZUI_LIANG_PHRASES,
    publishedFullMovableDo: YEKONG_ZUI_LIANG_FULL,
  },
  {
    id: "qinghuaci",
    publishedKey: "/key(A3)",
    siteBpm: 108,
    span: "full-vocal-once",
    nFullVocalOnce: 251,
    throughLyric: "在潑墨山水畫_裡 妳從墨色深處被隱去__",
    phrases: QINGHUACI_PHRASES,
    publishedFullMovableDo: QINGHUACI_FULL,
  },
  {
    id: "daoxiang",
    publishedKey: "/key(A3)",
    siteBpm: 82,
    span: "verse+chorus",
    nFullVocalOnce: 310,
    throughLyric: "回家吧 回到最初的美好",
    phrases: DAOXIANG_PHRASES,
    publishedFullMovableDo: DAOXIANG_FULL,
  },
  {
    id: "qifengle",
    publishedKey: "/key(Gb3)",
    siteBpm: 75,
    span: "verse+chorus",
    nFullVocalOnce: 391,
    throughLyric: "逆著光行走 任風_吹雨打",
    phrases: QIFENGLE_PHRASES,
    publishedFullMovableDo: QIFENGLE_FULL,
  },
  {
    id: "jiangnan",
    publishedKey: "/key(Bb3)",
    siteBpm: 120,
    span: "full-vocal-once",
    nFullVocalOnce: 195,
    throughLyric: "喔_____",
    phrases: JIANGNAN_PHRASES,
    publishedFullMovableDo: JIANGNAN_FULL,
  },
  {
    id: "houlai",
    publishedKey: "/key(Eb4)",
    siteBpm: 74.9,
    span: "full-vocal-once",
    nFullVocalOnce: 252,
    throughLyric: "有一個男孩 愛著那個女孩",
    phrases: HOULAI_PHRASES,
    publishedFullMovableDo: HOULAI_FULL,
  },
  {
    id: "timian",
    publishedKey: "/key(Bb3)",
    siteBpm: 85,
    span: "full-vocal-once",
    nFullVocalOnce: 197,
    throughLyric: "再見 不負遇見",
    phrases: TIMIAN_PHRASES,
    publishedFullMovableDo: TIMIAN_FULL,
  },
  {
    id: "buneng-shuo-de-mimi",
    publishedKey: "/key(G3)",
    siteBpm: 72,
    span: "full-vocal-once",
    nFullVocalOnce: 165,
    throughLyric: "要我怎麼撿",
    phrases: BUNENG_SHUO_DE_MIMI_PHRASES,
    publishedFullMovableDo: BUNENG_SHUO_DE_MIMI_FULL,
  },
  {
    id: "guyongzhe",
    publishedKey: "/key(B2)",
    siteBpm: 130,
    span: "verse+chorus",
    nFullVocalOnce: 317,
    throughLyric: "誰說站在光裡的才算英雄?_",
    phrases: GUYONGZHE_PHRASES,
    publishedFullMovableDo: GUYONGZHE_FULL,
  },
  {
    id: "xiaoqingge",
    publishedKey: "/key(D4)",
    siteBpm: 66,
    span: "full-vocal-once",
    nFullVocalOnce: 213,
    throughLyric: "哼哼 哼哼 哼哼",
    phrases: XIAOQINGGE_PHRASES,
    publishedFullMovableDo: XIAOQINGGE_FULL,
  },
  ...(NEW_POP_FULL_FIXTURES as FullPopFixture[]),
];

export function fullPopById(id: string): FullPopFixture | undefined {
  return POP_FULL_FIXTURES.find((s) => s.id === id);
}
