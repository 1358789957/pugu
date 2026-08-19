/**
 * New jianpu.space pop songs (verse+one chorus, or unique vocal once).
 * Parsed from #jianpuOut: skip 前奏/间奏/尾奏, first lyric occurrence only.
 * Old 11 stay in pop-full-fixtures.ts. 昼回 is not in this set.
 */

export const PAOMO_PHRASES = [
  { lyric: "陽光下的泡沫 是彩色的", publishedMovableDo: ["3", "3", "3", "3", "2", "2", "3", "4", "5", "2", "2", "2", "2"] },
  { lyric: "就像被騙的我 是幸福的", publishedMovableDo: ["2", "1", "3", "3", "5", "6", "3", "3", "3", "3"] },
  { lyric: "追究什麼對錯 你的謊言", publishedMovableDo: ["3", "2", "2", "3", "4", "5", "2", "2", "2", "2"] },
  { lyric: "基於你還愛我", publishedMovableDo: ["2", "1", "3"] },
  { lyric: "美麗的泡沫 雖然一剎花火", publishedMovableDo: ["1", "1", "3", "#5", "6", "6", "6", "5", "6", "5"] },
  { lyric: "你所有承諾 雖然都太脆弱", publishedMovableDo: ["2", "2", "2", "1", "2", "3", "3", "3", "2", "3", "2"] },
  { lyric: "但愛像泡沫 如果能夠看破", publishedMovableDo: ["1", "1", "1", "2", "3", "4", "4", "4", "3", "4", "3"] },
  { lyric: "有什麼難過", publishedMovableDo: ["2", "2", "2", "1", "2", "1"] },
] as const;
export const PAOMO_FULL = PAOMO_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const NAXIENIAN_PHRASES = [
  { lyric: "又回到最初的起點", publishedMovableDo: ["3", "3", "3", "4", "3", "3", "2", "1"] },
  { lyric: "記憶中妳青澀的臉", publishedMovableDo: ["2", "2", "2", "4", "3", "2"] },
  { lyric: "我們終於來到了這一天", publishedMovableDo: ["1", "7,", "1", "7,", "1", "7,", "6,", "5,"] },
  { lyric: "桌墊下的老照片", publishedMovableDo: ["5,", "1", "2", "3", "4", "6,", "1", "7,", "#5,"] },
  { lyric: "無數回憶連結", publishedMovableDo: ["3", "4", "3", "2", "1", "1", "7,", "1"] },
  { lyric: "今天男孩要赴女孩最後的約", publishedMovableDo: ["4", "3", "2", "1", "4", "3", "2", "1", "2"] },
  { lyric: "呆呆地站在鏡子前", publishedMovableDo: ["2", "2", "2", "4", "3", "2"] },
  { lyric: "笨拙繫上紅色領帶的結", publishedMovableDo: ["1", "7,", "1", "7,", "1", "7,", "1", "6", "5"] },
  { lyric: "將頭髮梳成大人模樣", publishedMovableDo: ["5", "4", "3", "5", "5", "6", "4", "3", "2", "2", "3", "4"] },
  { lyric: "穿上一身帥氣西裝", publishedMovableDo: ["4", "5", "3", "2", "1", "1", "7,", "1"] },
  { lyric: "等會兒見妳一定比想像美", publishedMovableDo: ["4", "3", "4", "6,", "1", "7,", "1", "1"] },
  { lyric: "好想再回到那些年的時光", publishedMovableDo: ["4", "4", "4", "4", "3", "7,", "3", "2", "2", "1", "1", "1", "4", "3", "2", "3"] },
  { lyric: "回到教室座位前後 故意討妳溫柔的罵", publishedMovableDo: ["4", "3", "4", "6", "6", "7", "5", "4", "4", "5", "3"] },
  { lyric: "黑板上排列組合 妳捨得解開嗎", publishedMovableDo: ["6", "6", "6", "6", "#5", "6", "7", "3", "7", "1'", "7", "5", "1"] },
  { lyric: "誰與誰坐他又愛著她", publishedMovableDo: ["4", "3", "2", "1", "4", "3", "4", "5", "5"] },
  { lyric: "那些年錯過的大雨", publishedMovableDo: ["5", "5", "7", "1'", "1'", "1'", "5", "5", "5", "5", "1'"] },
  { lyric: "那些年錯過的愛情", publishedMovableDo: ["2'", "2'", "2'", "5", "#5", "2'", "3'"] },
  { lyric: "好想擁抱妳 擁抱錯過的勇氣", publishedMovableDo: ["2'", "1'", "1'", "1'", "7", "1'", "7", "5", "6", "2'", "2", "2", "3"] },
  { lyric: "曾經想征服全世界", publishedMovableDo: ["4", "3", "4", "6", "5", "4", "3", "4"] },
  { lyric: "到最後回首才發現", publishedMovableDo: ["5", "5", "2'", "7", "1'", "1'", "7", "5"] },
  { lyric: "這世界滴滴點點全部都是妳", publishedMovableDo: ["4", "3", "4", "5", "6", "3'", "2'", "1'", "2'"] },
  { lyric: "好想告訴妳 告訴妳我沒有忘記", publishedMovableDo: ["2'", "1'", "1'", "1'", "7", "1'", "7", "5", "6", "3'", "3'", "4", "4", "5"] },
  { lyric: "那天晚上滿天星星", publishedMovableDo: ["6", "5", "6", "1'", "7", "7", "7", "6"] },
  { lyric: "平行時空下的約定", publishedMovableDo: ["#5", "#5", "3'", "2'", "1'", "1'", "7", "5"] },
  { lyric: "再一次相遇我會緊緊抱著妳", publishedMovableDo: ["4", "3", "4", "5", "6", "3'", "2'", "1'", "2'"] },
  { lyric: "緊緊抱著妳", publishedMovableDo: ["1'", "1'", "7", "1'", "1'"] },
] as const;
export const NAXIENIAN_FULL = NAXIENIAN_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const ANJING_PHRASES = [
  { lyric: "只剩下鋼琴陪我彈了一天", publishedMovableDo: ["3", "3", "3", "3", "2", "1", "7,", "2", "2", "2", "1", "5,", "3"] },
  { lyric: "睡著的大提琴　安靜的舊舊的", publishedMovableDo: ["2", "1", "1", "1", "5,", "3", "2", "1", "1", "2"] },
  { lyric: "我想你已表現的非常明白", publishedMovableDo: ["3", "3", "3", "3", "2", "1", "7,", "2", "2", "2", "1", "5,", "3"] },
  { lyric: "我懂我也知道　你沒有捨不得__", publishedMovableDo: ["2", "1", "1", "1", "5,", "3", "2", "1", "1", "2", "3", "4"] },
  { lyric: "你說你也會難過我不相信", publishedMovableDo: ["4", "4", "4", "4", "3", "2", "1", "1", "1", "2", "2"] },
  { lyric: "牽著你陪著我　也只是曾經", publishedMovableDo: ["5,", "5", "5", "5", "4", "3", "2", "2", "2", "3", "3", "6,"] },
  { lyric: "希望他是真的比我還要愛你_", publishedMovableDo: ["4", "3", "4", "3", "2", "1", "7,", "1", "7,", "1", "5,", "3", "3"] },
  { lyric: "我才會逼自己離開", publishedMovableDo: ["4", "3", "4", "3", "2", "1", "2"] },
  { lyric: "你要我說多難堪　我根本不想分開", publishedMovableDo: ["5,", "3", "4", "5", "4", "3", "5", "5,", "3", "4", "5", "4", "3", "5"] },
  { lyric: "為什麼還要我用微笑來帶過", publishedMovableDo: ["5,", "3", "4", "5", "4", "3", "1", "2", "2", "2", "3", "1"] },
  { lyric: "我沒有這種天份　包容你也接受他", publishedMovableDo: ["5", "5", "1", "1", "7,", "1", "1", "5", "5", "1", "1", "7,", "1", "1"] },
  { lyric: "不用擔心的太多　我會一直好好過", publishedMovableDo: ["4", "4", "3", "3", "2", "2", "1", "4", "4", "3", "3", "2", "2", "1"] },
  { lyric: "你已經遠遠離開　我也會慢慢走開", publishedMovableDo: ["5,", "3", "4", "5", "4", "3", "5", "5,", "3", "4", "5", "4", "3", "5"] },
  { lyric: "為什麼我連分開都遷就著你", publishedMovableDo: ["5,", "3", "4", "5", "4", "3", "1", "2", "2", "2", "3", "1"] },
  { lyric: "我真的沒有天份　安靜的沒這麼快", publishedMovableDo: ["5", "5", "7,", "1", "7,", "1", "1", "5", "5", "7,", "1", "7,", "1", "1"] },
  { lyric: "我會學著放棄你　是因為我太愛你", publishedMovableDo: ["4", "4", "3", "3", "2", "2", "1", "4", "3", "2", "1", "6,", "7,", "1"] },
] as const;
export const ANJING_FULL = ANJING_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const YUJIAN_PHRASES = [
  { lyric: "聽見 冬天 的離開 我在某年某月醒過來", publishedMovableDo: ["5", "3", "5", "2", "3", "2", "1", "1", "7,", "6,", "7,", "1", "7,", "1", "2", "3", "5", "3"] },
  { lyric: "我想 我等 我期待 未來卻不能因此安排", publishedMovableDo: ["5", "2", "3", "2", "1", "1", "7,", "6,", "7,", "1", "7,", "1", "2", "1", "5''", "6''", "7''"] },
  { lyric: "陰天 傍晚 車窗外 未來有一個人在等待", publishedMovableDo: ["5", "2", "3", "2", "1", "1", "7,", "6,", "7,", "1", "7,", "1", "2", "3", "5", "3"] },
  { lyric: "向左 向右 向前看 愛要拐幾個彎_才來", publishedMovableDo: ["5", "2'", "1'", "7", "1'", "1", "7,", "6,", "7,", "1", "7,", "1", "2", "1", "5", "6", "7"] },
  { lyric: "我遇見誰 會有怎樣的對白", publishedMovableDo: ["1'", "7", "1'", "7", "6", "5", "6", "5", "1", "2", "3"] },
  { lyric: "我等的人 他在多遠的未來_", publishedMovableDo: ["4", "3", "4", "5", "1", "2", "3", "2", "3", "5", "6", "7"] },
  { lyric: "我聽見風 來自地鐵和人海", publishedMovableDo: ["1'", "7", "1'", "2'", "1'", "2'", "3'", "5", "1", "2", "3"] },
  { lyric: "我排著隊 拿著愛的號碼牌", publishedMovableDo: ["4", "3", "4", "3", "2", "1", "7,", "1", "5''"] },
] as const;
export const YUJIAN_FULL = YUJIAN_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const KEXI_MEI_RUGUO_PHRASES = [
  { lyric: "假如把犯得起的錯 能錯的都錯過", publishedMovableDo: ["1", "1", "7,", "1", "1", "1", "2", "2", "2", "2", "2", "2", "1", "1"] },
  { lyric: "應該還來得及去悔過", publishedMovableDo: ["1", "1", "1", "1", "1", "1", "1", "7,", "2"] },
  { lyric: "假如沒把一切說破", publishedMovableDo: ["1", "1", "1", "1", "7,", "1", "2", "2"] },
  { lyric: "那一場小風波 將一笑帶過", publishedMovableDo: ["2", "2", "2", "2", "3", "3", "3", "2", "1", "2", "2"] },
  { lyric: "在感情面前 講什麼自我", publishedMovableDo: ["7,", "6,", "7,", "1", "6,", "3,", "3,", "3,", "1", "7,"] },
  { lyric: "要得過且過 才好過", publishedMovableDo: ["7,", "7,", "6,", "7,", "1", "1", "2", "2"] },
  { lyric: "全都怪我", publishedMovableDo: ["5,", "3", "2", "3"] },
  { lyric: "不該沉默時沉默 該勇敢時軟弱", publishedMovableDo: ["3", "2", "3", "1", "7,", "5", "5", "3", "2", "3", "7,", "6,"] },
  { lyric: "如果不是我_ 誤會自己灑脫 讓我們難過", publishedMovableDo: ["6", "5", "4", "3", "4", "4", "3", "3", "2", "3", "7,", "6,", "6", "5", "4", "3", "4", "5"] },
  { lyric: "可當初的你 和現在的我 假如重來過", publishedMovableDo: ["1", "2", "3", "2", "3", "1", "2", "3", "2", "3", "1", "2", "3", "2", "4"] },
  { lyric: "倘若那天", publishedMovableDo: ["5,", "3", "2", "3"] },
  { lyric: "把該說的話好好說 該體諒的不執著", publishedMovableDo: ["5,", "3", "2", "3", "1", "7,", "5", "5", "3", "2", "3", "7,", "6,"] },
  { lyric: "如果那天我_ 不受情緒挑撥 你會怎麼做", publishedMovableDo: ["6", "6", "5", "4", "3", "4", "4", "3", "5", "4", "3", "7,", "6,", "6", "5", "4", "3", "4", "5"] },
  { lyric: "那麼多如果 可能如果我", publishedMovableDo: ["1", "2", "3", "2", "3", "1", "2", "3", "2", "3", "1", "2", "3", "2", "4"] },
  { lyric: "可惜沒如果 只剩下结果", publishedMovableDo: ["4", "3", "4", "7,", "1"] },
] as const;
export const KEXI_MEI_RUGUO_FULL = KEXI_MEI_RUGUO_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const GANBEI_PHRASES = [
  { lyric: "會不會 有一天 時間真的能倒退", publishedMovableDo: ["3", "5", "5", "3", "5", "5", "6", "7", "1'", "5", "3", "6", "5", "6", "7"] },
  { lyric: "退回 你的我的 回不去的 悠悠的歲月", publishedMovableDo: ["1'", "5", "3", "6", "5", "3", "2", "1", "3", "2", "2", "1", "2", "3", "5"] },
  { lyric: "也許會 有一天 世界真的有終點", publishedMovableDo: ["5", "3", "5", "5", "6", "7", "1'", "5", "1'", "2'", "3'", "3", "5"] },
  { lyric: "也要和你舉起回憶釀的甜 和你再乾一杯", publishedMovableDo: ["4", "3", "2", "1", "7,", "5,", "5", "7,", "1", "3", "4", "3", "2", "1"] },
  { lyric: "如果說 要我選出 代表青春 那個畫面", publishedMovableDo: ["1", "3,", "3,", "2,", "3,", "3,", "3,", "2,", "3,", "3,", "3,", "2,", "3,", "2,", "3,", "5,", "5,", "3,", "2,"] },
  { lyric: "浮現了 那滴眼淚 那片藍天 那年畢業", publishedMovableDo: ["2,", "3,", "3,", "2,", "2,", "3,", "3,", "2,", "3,", "3,", "3,", "5,", "5,", "3,", "2,"] },
  { lyric: "那一張 邊哭邊笑 還要擁抱 是你的臉", publishedMovableDo: ["5,", "6,", "6,", "5,", "5,", "6,", "6,", "5,", "6,", "5,", "6,", "1", "1", "6,", "5,"] },
  { lyric: "想起來 可愛可憐 可歌可泣 可是多懷念", publishedMovableDo: ["1", "6,", "6,", "5,", "3", "1", "6,", "5,", "2", "2", "2", "3", "2"] },
  { lyric: "懷念總是 突然懷念 不談條件", publishedMovableDo: ["2,", "3,", "3,", "2,", "2,", "3,", "3,", "2,", "3,", "2,", "3,", "5,", "5,", "3,", "2,"] },
  { lyric: "當回憶 衝破考卷 衝出歲月 在我眼前", publishedMovableDo: ["2,", "3,", "3,", "2,", "2,", "3,", "3,", "2,", "3,", "3,", "3,", "5,", "5,", "3,", "2,"] },
  { lyric: "我和你 流著汗水 喝著汽水 在操場邊", publishedMovableDo: ["5,", "6,", "6,", "5,", "5,", "6,", "6,", "5,", "6,", "6,", "6,", "1", "1", "6,", "5,"] },
  { lyric: "說好了 無論如何 一起走到 未來的世界", publishedMovableDo: ["1", "6,", "6,", "5,", "3", "1", "6,", "5,", "2", "2", "2", "3", "2"] },
  { lyric: "現在就是 那個未來 那個世界", publishedMovableDo: ["2", "3", "3", "2", "2", "3", "3", "2", "2", "3", "3", "3", "2", "2", "1"] },
  { lyric: "為什麼 你的身邊 我的身邊 不是同一邊", publishedMovableDo: ["5", "3", "2", "1", "5", "3", "2", "1", "6", "5", "3", "2", "1"] },
  { lyric: "友情曾像 諾亞方舟 堅強誓言", publishedMovableDo: ["6", "6", "6", "5", "5", "6", "6", "5", "6", "7", "7", "7", "7", "6", "5"] },
  { lyric: "只是我 望著海面 等著永遠 模糊了視線", publishedMovableDo: ["1'", "6", "6", "5", "1'", "1'", "6", "5", "5", "5", "5", "6", "5", "3", "5"] },
] as const;
export const GANBEI_FULL = GANBEI_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const TURAN_HAO_XIANG_NI_PHRASES = [
  { lyric: "最怕空氣突然安靜", publishedMovableDo: ["3", "3", "1", "2", "1", "7,", "1"] },
  { lyric: "最怕朋友突然的關心", publishedMovableDo: ["1", "4", "4", "3", "4", "3", "4", "5"] },
  { lyric: "最怕回憶 突然翻滾絞痛著 不平息", publishedMovableDo: ["2", "1", "7,", "1", "6", "6", "7", "2'", "1'", "7", "6", "5", "5", "6", "3", "1", "7,", "1"] },
  { lyric: "最怕突然 聽到你的消息", publishedMovableDo: ["5", "5", "5", "4", "6,", "7,", "1", "5,"] },
  { lyric: "想念如果會有聲音", publishedMovableDo: ["3", "3", "1", "2", "1", "7,", "1", "1"] },
  { lyric: "不願那是悲傷的哭泣", publishedMovableDo: ["4", "4", "3", "4", "3", "4", "5", "2", "1", "7,", "1", "6"] },
  { lyric: "事到如今 終於讓自己屬於 我自己", publishedMovableDo: ["6", "7", "2'", "1'", "7", "6", "5", "5", "6", "3", "1", "7,", "1"] },
  { lyric: "只剩眼淚 還騙不過自己", publishedMovableDo: ["5", "5", "5", "4", "6,", "7,", "1", "6", "7"] },
  { lyric: "突然好想你 你會在哪裡", publishedMovableDo: ["1'", "3'", "2'", "1'", "2'", "5", "2'", "1'", "6", "7"] },
  { lyric: "過得快樂或委屈", publishedMovableDo: ["1'", "3'", "2'", "1'", "3'", "6", "7"] },
  { lyric: "突然好想你 突然鋒利的回_憶_", publishedMovableDo: ["1'", "3'", "2'", "5'", "2'", "4'", "3'", "2'", "3'", "2'", "2'", "1'", "6", "7"] },
  { lyric: "突然模糊的眼睛", publishedMovableDo: ["1'", "3'", "2'", "1'", "1'", "5,"] },
] as const;
export const TURAN_HAO_XIANG_NI_FULL = TURAN_HAO_XIANG_NI_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const GUANGNIAN_ZHIWAI_PHRASES = [
  { lyric: "感受停在我髮端的指尖", publishedMovableDo: ["3", "3", "2", "2", "1", "1", "7,", "7,", "1", "1", "5,", "5,", "5,"] },
  { lyric: "如何瞬間 凍結時間", publishedMovableDo: ["3", "5,", "5,", "5,", "2"] },
  { lyric: "記住望著我堅定的雙眼__", publishedMovableDo: ["3", "3", "2", "2", "1", "1", "7,", "7,", "1", "1", "7,", "6,", "5,", "5,", "5,"] },
  { lyric: "也許已經 沒有明天", publishedMovableDo: ["3", "5,", "5,", "5,", "2"] },
  { lyric: "面對浩瀚的_星_海__", publishedMovableDo: ["6,", "7,", "6,", "7,", "1", "7,", "1", "2", "3", "4", "3", "6,"] },
  { lyric: "我們微小得像_塵_埃__", publishedMovableDo: ["6,", "7,", "6,", "7,", "1", "7,", "1", "2", "3", "4", "3", "1", "2"] },
  { lyric: "漂浮在__ 一_片__無奈_", publishedMovableDo: ["3", "4", "3", "1", "2", "3", "4", "3", "2", "1", "2"] },
  { lyric: "緣份讓我們相遇亂世以外", publishedMovableDo: ["7,", "1", "1", "2", "2", "3", "3", "5", "5", "6", "6"] },
  { lyric: "命運卻要我們危難中相愛", publishedMovableDo: ["1", "2", "2", "3", "3", "5", "5", "1", "3", "2", "2"] },
  { lyric: "也許未來遙遠在光年之外", publishedMovableDo: ["1", "1", "1", "2", "2", "3", "3", "5", "5", "6", "6"] },
  { lyric: "我願守候未知裡為你等待", publishedMovableDo: ["1", "2", "2", "3", "3", "5", "5", "1", "3", "2", "2", "4", "3", "2", "1"] },
  { lyric: "我沒想到 為了你 我能瘋狂到", publishedMovableDo: ["1", "5", "5", "5", "5", "1", "1", "6,", "4", "3", "2", "1"] },
  { lyric: "山崩海嘯 沒有你 根本不想逃", publishedMovableDo: ["1", "5", "5", "5", "5", "1", "1", "7,", "4", "3", "2", "6,"] },
  { lyric: "我的大腦 為了你 已經瘋狂到", publishedMovableDo: ["1", "5", "5", "5", "5", "1", "1", "6,", "4", "3", "2", "1"] },
  { lyric: "脈搏心跳 沒有你 根本不重要", publishedMovableDo: ["1", "5", "5", "5", "5", "1", "1", "7,"] },
] as const;
export const GUANGNIAN_ZHIWAI_FULL = GUANGNIAN_ZHIWAI_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const KGE_ZHI_WANG_PHRASES = [
  { lyric: "我以為要是唱得用心良苦", publishedMovableDo: ["1", "2", "3", "2", "1", "7,", "5,", "1", "7,", "1", "5,"] },
  { lyric: "妳總會對我多點在乎", publishedMovableDo: ["1", "7,", "1", "5,", "1", "1", "7,", "1", "2", "1", "2"] },
  { lyric: "我以為雖然愛情 已成往事", publishedMovableDo: ["3", "2", "1", "7,", "5,", "1", "7,", "1", "5", "6"] },
  { lyric: "千言萬語說出來可以互相安撫", publishedMovableDo: ["4", "3", "2", "4", "3", "2", "1", "5,", "6,", "1", "2", "1"] },
  { lyric: "期待妳感動 真實的我們難相處", publishedMovableDo: ["1", "3", "5", "7", "2'", "1'", "5", "3", "3", "3", "5", "6", "5", "5,", "1", "3"] },
  { lyric: "寫詞的讓我 唱出你要的幸福", publishedMovableDo: ["5", "6", "5", "3", "1", "4", "3", "1", "2", "1", "3", "5"] },
  { lyric: "誰曾經感動 分手的關頭才懂得", publishedMovableDo: ["7", "2'", "1'", "7", "1'", "2'", "1'", "5", "3", "1", "1", "2", "3"] },
  { lyric: "離開排行榜 更銘心刻骨", publishedMovableDo: ["3", "6,", "4", "3", "4", "6", "5", "5", "6", "7"] },
  { lyric: "我已經相信 有些人我永遠不必等", publishedMovableDo: ["3'", "1'", "7", "5", "6", "7", "6", "7", "6", "5", "3", "6", "7", "1'"] },
  { lyric: "所以我明白 在燈火闌珊處為什麼會哭", publishedMovableDo: ["4'", "1'", "1'", "3'", "2'", "1'", "6", "4", "4", "6", "1'", "3'", "2'", "5", "6", "7"] },
  { lyric: "你不會相信 嫁給我明天有多幸福", publishedMovableDo: ["3'", "1'", "7", "5", "6", "7", "3'", "2'", "1'", "6", "3", "6", "7", "#1'"] },
  { lyric: "只想你明白 我心甘情願 愛愛愛愛到要吐", publishedMovableDo: ["4'", "1'", "1'", "3'", "2'", "1'", "6", "1'", "1'", "1'", "1'", "2'", "3'", "2'", "2'", "1'"] },
  { lyric: "那是醉生夢死 才能熬成的苦", publishedMovableDo: ["7", "1'", "7", "5", "6", "6", "6", "5", "3", "1"] },
  { lyric: "愛如潮水 我忘了 我是誰", publishedMovableDo: ["1", "2", "3", "4", "4", "1'", "7", "5", "1"] },
  { lyric: "至少還有 你哭", publishedMovableDo: ["4", "4", "4", "3", "6,", "7,", "1", "3", "5", "1'", "7", "5"] },
] as const;
export const KGE_ZHI_WANG_FULL = KGE_ZHI_WANG_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const XIANGJIANNI_PHRASES = [
  { lyric: "當愛情遺落成遺跡 用象形刻劃成回憶", publishedMovableDo: ["5,", "2", "1", "2", "1", "2", "5", "5", "5,", "1", "7,", "1", "6,", "1", "3", "3"] },
  { lyric: "想念幾個世紀 才是刻骨銘心", publishedMovableDo: ["6,", "6,", "7,", "1", "5,", "5,", "5,", "4,", "3", "3", "4", "2"] },
  { lyric: "若能回到冰河時期 多想把你抱緊處理", publishedMovableDo: ["5,", "2", "1", "2", "1", "2", "5", "5", "5,", "1", "7,", "1", "6,", "1", "6", "5"] },
  { lyric: "你的笑多療癒 讓人生也甦醒", publishedMovableDo: ["1", "6", "7", "1'", "1", "1", "3", "4", "3", "4", "5", "2", "1", "2"] },
  { lyric: "失去 你的風景 像座廢墟 像失落文明__", publishedMovableDo: ["3", "2", "3", "6", "2", "1", "2", "5", "1", "7,", "1", "2", "5,", "6,", "5,", "1", "2"] },
  { lyric: "能否 一場奇蹟 一線生機 能不能 有再一次 相遇", publishedMovableDo: ["3", "2", "3", "6", "2", "1", "2", "7", "7", "1'", "1'", "7", "1'", "7", "1'", "3", "5"] },
  { lyric: "想見你 只想見你 未來過去 我只想見你", publishedMovableDo: ["1'", "7", "1'", "3", "2", "3", "5", "2", "1", "2", "7", "7", "1'", "1'", "3", "5", "1'", "7", "1'"] },
  { lyric: "穿越了 千個萬個 時間線裡 人海裡相依__", publishedMovableDo: ["6", "5", "6", "1'", "5", "1'", "5", "3", "4", "6", "5", "6", "2", "3", "2", "1'", "7", "1'"] },
  { lyric: "用盡了 邏輯心機 推理愛情 最難解的謎", publishedMovableDo: ["3", "2", "3", "5", "2", "1", "2", "7", "7", "1'", "1'", "2'", "3'", "2'", "3'", "1'"] },
  { lyric: "會不會 妳也 和我一樣 在等待一句 我願意", publishedMovableDo: ["6", "6", "6", "5", "1'", "5", "3", "4", "5", "6", "1'", "3'", "2'", "1'"] },
] as const;
export const XIANGJIANNI_FULL = XIANGJIANNI_PHRASES.flatMap((p) => [...p.publishedMovableDo]);

export const NEW_POP_IDS = [
  "paomo",
  "naxienian",
  "anjing",
  "yujian",
  "kexi-mei-ruguo",
  "ganbei",
  "turan-hao-xiang-ni",
  "guangnian-zhiwai",
  "kge-zhi-wang",
  "xiangjianni",
] as const;

export const NEW_POP_FULL_FIXTURES = [
  {
    id: "paomo",
    publishedKey: "/key(E3)",
    siteBpm: 68,
    span: "verse+chorus",
    nFullVocalOnce: 271,
    throughLyric: "有什麼難過",
    phrases: PAOMO_PHRASES,
    publishedFullMovableDo: PAOMO_FULL,
  },
  {
    id: "naxienian",
    publishedKey: "/key(F3)",
    siteBpm: 79,
    span: "full-vocal-once",
    nFullVocalOnce: 240,
    throughLyric: "緊緊抱著妳",
    phrases: NAXIENIAN_PHRASES,
    publishedFullMovableDo: NAXIENIAN_FULL,
  },
  {
    id: "anjing",
    publishedKey: "/key(Bb3)",
    siteBpm: 72,
    span: "full-vocal-once",
    nFullVocalOnce: 199,
    throughLyric: "我會學著放棄你　是因為我太愛你",
    phrases: ANJING_PHRASES,
    publishedFullMovableDo: ANJING_FULL,
  },
  {
    id: "yujian",
    publishedKey: "/key(Ab3)",
    siteBpm: 92,
    span: "verse+chorus",
    nFullVocalOnce: 165,
    throughLyric: "我排著隊 拿著愛的號碼牌",
    phrases: YUJIAN_PHRASES,
    publishedFullMovableDo: YUJIAN_FULL,
  },
  {
    id: "kexi-mei-ruguo",
    publishedKey: "/key(C4)",
    siteBpm: 80,
    span: "verse+chorus",
    nFullVocalOnce: 209,
    throughLyric: "可惜沒如果 只剩下结果",
    phrases: KEXI_MEI_RUGUO_PHRASES,
    publishedFullMovableDo: KEXI_MEI_RUGUO_FULL,
  },
  {
    id: "ganbei",
    publishedKey: "/key(F3)",
    siteBpm: 82,
    span: "verse+chorus",
    nFullVocalOnce: 511,
    throughLyric: "只是我 望著海面 等著永遠 模糊了視線",
    phrases: GANBEI_PHRASES,
    publishedFullMovableDo: GANBEI_FULL,
  },
  {
    id: "turan-hao-xiang-ni",
    publishedKey: "/key(D3)",
    siteBpm: 70,
    span: "verse+chorus",
    nFullVocalOnce: 236,
    throughLyric: "突然模糊的眼睛",
    phrases: TURAN_HAO_XIANG_NI_PHRASES,
    publishedFullMovableDo: TURAN_HAO_XIANG_NI_FULL,
  },
  {
    id: "guangnian-zhiwai",
    publishedKey: "/key(E4)",
    siteBpm: 88,
    span: "verse+chorus",
    nFullVocalOnce: 300,
    throughLyric: "脈搏心跳 沒有你 根本不重要",
    phrases: GUANGNIAN_ZHIWAI_PHRASES,
    publishedFullMovableDo: GUANGNIAN_ZHIWAI_FULL,
  },
  {
    id: "kge-zhi-wang",
    publishedKey: "/key(D3)",
    siteBpm: 78,
    span: "verse+chorus",
    nFullVocalOnce: 312,
    throughLyric: "至少還有 你哭",
    phrases: KGE_ZHI_WANG_PHRASES,
    publishedFullMovableDo: KGE_ZHI_WANG_FULL,
  },
  {
    id: "xiangjianni",
    publishedKey: "/key(F#3)",
    siteBpm: 65,
    span: "verse+chorus",
    nFullVocalOnce: 320,
    throughLyric: "會不會 妳也 和我一樣 在等待一句 我願意",
    phrases: XIANGJIANNI_PHRASES,
    publishedFullMovableDo: XIANGJIANNI_FULL,
  },
];
