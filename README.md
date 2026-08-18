# 谱骨

上传歌曲，浏览器里扒主旋律和和弦，导出库乐队能直接拖进去的 MIDI。

不上传服务器，音高 / 人声分离 / 和弦都在本地算。

## 能干什么

- 拖入 MP3 / WAV，或哼唱录音
- 成曲先拆人声再扒旋律
- 钢琴卷帘、五线谱、词谱（上音符 / 中歌词 / 下和弦）
- 检测调性、速度、和弦进行
- 导出 Type-1 MIDI（速度轨 + 旋律轨 + 和弦轨）和干声 WAV

## 本地运行

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:8080

## 库乐队

1. 扒完点「库乐队 MIDI」
2. 把 `.mid` 拖进库乐队（Mac）或经「文件」导入（iPhone）
3. 工程速度改成检测出来的 BPM
4. 一般会有两条轨：旋律 + 和弦垫底

示例扒谱：《昼回のメモリー》→ [hirumawari-memory](https://github.com/1358789957/hirumawari-memory)

## 技术

TanStack Start + Web Audio。音高用 YIN，人声是 HPSS + 中置提取，和弦是色度模板 + Viterbi。
