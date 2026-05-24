import { useState, useRef, useEffect, useCallback } from "react";
import { CURRENT_VERSION, CHANGELOG } from "./version";

/* ─── テーマ定義 ─── */
const THEMES = [
  { id: "game",    label: "ゲーム",   emoji: "🎮", ko: "게임" },
  { id: "anime",   label: "アニメ",   emoji: "🎌", ko: "애니메이션" },
  { id: "sports",  label: "スポーツ", emoji: "⚽", ko: "스포츠" },
  { id: "kpop",    label: "K-pop",    emoji: "🎵", ko: "K팝" },
  { id: "cooking", label: "料理",     emoji: "🍜", ko: "요리" },
  { id: "travel",  label: "旅行",     emoji: "✈️", ko: "여행" },
];

/* ─── システムプロンプト ─── */
const BASE_SYSTEM = `あなたは韓国語会話練習の先生「ソナ先生」です。ユーザーはハングル検定5級取得を目指す超初心者の日本人です。

## ルール
- 必ず韓国語で話しかける（シンプルな文章、5級レベル）
- 返答は以下の形式で書くこと：

1. 韓国語の返答（短く、初級レベル）
2. 文法ミスがあれば韓国語で一言指摘
3. 次の会話につながる質問（韓国語のみ）

[JA]
（上の韓国語内容の日本語訳をまとめて）
[/JA]

## 重要なルール
- ひらがな・カタカナの読み方は一切書かない
- 日本語は必ず [JA]〜[/JA] の中だけに書く
- [JA] の外には韓国語のみ

## 5級レベルの目安
- 基本あいさつ、自己紹介、数字、曜日、時間、基礎単語300語程度`;

const THEME_SYSTEM_EXTRAS = {
  game: `\n\n## 今日のテーマ：ゲーム（게임）
- ゲームに関する話題を自然に振ってください
- 例：「요즘 어떤 게임 해요？」「좋아하는 게임 캐릭터가 있어요？」
- ゲームのキャラクターや最新作の話を取り入れてください
- 最新情報が提供された場合は積極的に会話に使ってください`,

  anime: `\n\n## 今日のテーマ：アニメ（애니메이션）
- アニメに関する話題を自然に振ってください
- 例：「좋아하는 애니메이션이 있어요？」「요즘 어떤 애니 봐요？」
- 韓国でも人気のアニメ作品や今期話題の作品を取り入れてください
- 最新情報が提供された場合は積極的に会話に使ってください`,

  sports: `\n\n## 今日のテーマ：スポーツ（스포츠）
- スポーツに関する話題を自然に振ってください
- 例：「좋아하는 스포츠가 뭐예요？」「운동 자주 해요？」
- 韓国の人気スポーツや選手、最新ニュースを取り入れてください
- 最新情報が提供された場合は積極的に会話に使ってください`,

  kpop: `\n\n## 今日のテーマ：K-pop（K팝）
- K-popに関する話題を自然に振ってください
- 例：「좋아하는 K팝 가수가 있어요？」「어떤 아이돌 좋아해요？」
- 人気グループや最新曲・カムバック情報を取り入れてください
- 最新情報が提供された場合は積極的に会話に使ってください`,

  cooking: `\n\n## 今日のテーマ：料理（요리）
- 韓国料理に関する話題を自然に振ってください
- 例：「한국 음식 좋아해요？」「떡볶이 먹어봤어요？」
- 人気韓国料理やトレンドのレシピ・食文化を取り入れてください
- 最新情報が提供された場合は積極的に会話に使ってください`,

  travel: `\n\n## 今日のテーマ：旅行（여행）
- 韓国旅行に関する話題を自然に振ってください
- 例：「한국에 가고 싶어요？」「서울에 가봤어요？」
- ソウル・釜山など人気観光スポットや最新情報を取り入れてください
- 最新情報が提供された場合は積極的に会話に使ってください`,
};

function buildSystemPrompt(theme) {
  if (!theme) return BASE_SYSTEM;
  return BASE_SYSTEM + (THEME_SYSTEM_EXTRAS[theme.id] || "");
}

/* ─── テキスト処理 ─── */
function extractJA(t) {
  const m = t.match(/\[JA\]([\s\S]*?)\[\/JA\]/);
  return m ? m[1].trim() : null;
}
function extractKorean(t) {
  return t.replace(/\[JA\][\s\S]*?\[\/JA\]\n?/g, "").trim();
}

/* ─── 音声 ─── */
function getKoreanVoice() {
  try {
    const voices = window.speechSynthesis.getVoices();
    const prefer = ["Yuna", "Heami", "유나", "Soyeon", "Google 한국의"];
    for (const n of prefer) {
      const v = voices.find(v => v.lang.startsWith("ko") && v.name.includes(n));
      if (v) return v;
    }
    return voices.find(v => v.lang.startsWith("ko")) || null;
  } catch { return null; }
}
function speakKorean(text, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang  = "ko-KR";
  u.rate  = 0.85;
  u.pitch = 1.2;
  const voice = getKoreanVoice();
  if (voice) u.voice = voice;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_RETRIES = 3;
const RETRY_WAIT_SEC = 3;

/* ════════════════════════════════════════
   メインコンポーネント
════════════════════════════════════════ */
export default function App() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "안녕하세요！ 저는 소나 선생님이에요 🌸",
    ja: "はじめまして！ソナ先生です。\nテーマを選んで「시작！」ボタンで会話を始めましょう！",
    showJA: true,
    isSystem: true,
  }]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [started,       setStarted]       = useState(false);
  const [theme,         setTheme]         = useState(null);
  const [autoSpeak,     setAutoSpeak]     = useState(true);
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [micState,      setMicState]      = useState("idle");
  const [micLang,       setMicLang]       = useState("ko-KR");
  const [retryInfo,     setRetryInfo]     = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [isNewVersion] = useState(() =>
    localStorage.getItem("seen_version") !== CURRENT_VERSION
  );

  /* 単語メモ（localStorage 永続） */
  const [vocab,      setVocab]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("korean_vocab") || "[]"); }
    catch { return []; }
  });
  const [newWord,    setNewWord]    = useState("");
  const [newMeaning, setNewMeaning] = useState("");

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const recRef    = useRef(null);
  const ttsOk     = !!window.speechSynthesis;

  /* 音声認識 初期化 */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicState("unsupported"); return; }
    const r = new SR();
    r.lang = "ko-KR"; r.continuous = false; r.interimResults = false;
    r.onresult = e => { setInput(e.results[0][0].transcript); setMicState("idle"); };
    r.onerror  = () => setMicState("idle");
    r.onend    = () => setMicState("idle");
    recRef.current = r;
    window.speechSynthesis?.getVoices();
    if (window.speechSynthesis)
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => { if (recRef.current) recRef.current.lang = micLang; }, [micLang]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { localStorage.setItem("korean_vocab", JSON.stringify(vocab)); }, [vocab]);

  /* 日本語訳トグル */
  const toggleJA = useCallback((idx) => {
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, showJA: !m.showJA } : m));
  }, []);

  /* 単語メモ操作 */
  const addVocab = () => {
    if (!newWord.trim()) return;
    setVocab(prev => [...prev, { word: newWord.trim(), meaning: newMeaning.trim() }]);
    setNewWord(""); setNewMeaning("");
  };
  const deleteVocab = (i) => setVocab(prev => prev.filter((_, idx) => idx !== i));

  /* 送信 & リトライ */
  const send = useCallback(async (text, currentTheme) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const history = [...messages.filter(m => !m.isSystem), userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const systemPrompt = buildSystemPrompt(currentTheme || theme);

    let lastError = null;
    try {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          for (let i = RETRY_WAIT_SEC; i > 0; i--) {
            setRetryInfo({ countdown: i, attempt, max: MAX_RETRIES });
            await sleep(1000);
          }
          setRetryInfo(null);
        }
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system: systemPrompt,
              theme: (currentTheme || theme)?.id || null,
              messages: history.map(m => ({ role: m.role, content: m.content })),
            }),
          });
          let data;
          try { data = await res.json(); }
          catch { throw Object.assign(
            new Error(`サーバーからの応答が読み取れませんでした (HTTP ${res.status})`),
            { retryable: true }
          ); }
          if (!res.ok) {
            const msg = typeof data.error === "string"
              ? data.error : `エラーが発生しました (HTTP ${res.status})`;
            throw Object.assign(new Error(msg), {
              retryable: res.status !== 400 && res.status !== 401 && res.status !== 403
            });
          }
          if (!data.text) throw Object.assign(
            new Error("AIからの返答が空でした。もう一度話しかけてみてください"),
            { retryable: true }
          );

          const ja     = extractJA(data.text);
          const korean = extractKorean(data.text);
          setMessages(prev => [...prev, { role: "assistant", content: korean, ja, showJA: false }]);
          if (autoSpeak && korean) {
            setIsSpeaking(true);
            speakKorean(korean, () => setIsSpeaking(false));
          }
          return;
        } catch (e) {
          lastError = e;
          if (e.retryable === false || attempt >= MAX_RETRIES) break;
        }
      }
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${lastError.message}` }]);
    } finally {
      setLoading(false);
      setRetryInfo(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, loading, autoSpeak, theme]);

  const handleStart = (selectedTheme) => {
    setStarted(true);
    send(`시작！（${selectedTheme.label}について話したいです）`, selectedTheme);
  };

  const toggleMic = () => {
    if (micState === "unsupported" || !recRef.current) return;
    if (micState === "listening") { recRef.current.stop(); setMicState("idle"); }
    else { try { recRef.current.start(); setMicState("listening"); } catch { setMicState("idle"); } }
  };

  const quickReplies = [
    { l: "네",          v: "네" },
    { l: "아니요",      v: "아니요" },
    { l: "모르겠어요",  v: "모르겠어요" },
    { l: "다시 해주세요", v: "다시 해주세요" },
  ];

  return (
    <div style={c.app}>

      {/* ══ ヘッダー ══ */}
      <div style={c.header}>
        <div style={c.hLeft}>
          <span style={{ fontSize: 24 }}>🇰🇷</span>
          <div>
            <div style={c.hTitle}>한국어 연습</div>
            <div style={c.hSub}>ハングル検定5級 会話練習</div>
          </div>
        </div>
        <div style={c.hRight}>
          {ttsOk && (
            <button style={c.iconBtn} onClick={() => setAutoSpeak(v => !v)}
                    title={autoSpeak ? "自動読み上げON" : "自動読み上げOFF"}>
              {autoSpeak ? "🔊" : "🔇"}
            </button>
          )}
          <div style={c.badge}>5급</div>
          <button
            style={c.verBtn}
            onClick={() => { setShowChangelog(true); localStorage.setItem("seen_version", CURRENT_VERSION); }}
            title="アップデート履歴"
          >
            v{CURRENT_VERSION}
            {isNewVersion && <span style={c.newDot}/>}
          </button>
        </div>
      </div>

      <div style={c.body}>
        {/* ══ チャット列 ══ */}
        <div style={c.chatCol}>

          {/* ── アバターパネル（上部中央） ── */}
          <div style={c.avatarPanel}>
            {/* 円形アバター：待機中→sona.png静止画、話し中→talking.gif */}
            <div style={c.avatarWrap}>
              <img
                src={isSpeaking ? "/sona-talking.gif" : "/sona.png"}
                alt="소나 선생님"
                style={c.avatarImg}
                draggable={false}
              />
            </div>
            <div style={c.avatarName}>소나 선생님</div>
            <div style={c.avatarStatus}>
              {isSpeaking ? "🗣 話し中…"
               : loading  ? "💭 考え中…"
               : theme    ? `${theme.emoji} ${theme.label}（${theme.ko}）`
               :             "✨ 待機中"}
            </div>
          </div>

          {/* ── テーマ選択パネル（未選択時） ── */}
          {!theme && (
            <div style={c.themePanel}>
              <div style={c.themePanelTitle}>🎯 今日は何について話しますか？</div>
              <div style={c.themeGrid}>
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    style={c.themeBtn}
                    onClick={() => setTheme(t)}
                  >
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{t.label}</span>
                    <span style={{ fontSize: 11, color: "#e85d6b", fontWeight: 600 }}>{t.ko}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── メッセージ ── */}
          <div style={c.msgs}>
            {messages.map((m, i) => (
              <div key={i} style={{ ...c.row, ...(m.role === "user" ? c.rowUser : {}) }}>
                {m.role === "assistant" && (
                  <div style={c.who}>
                    <span style={c.name}>소나 선생님</span>
                  </div>
                )}

                {m.role === "user" ? (
                  <div style={{ ...c.bubble, ...c.bubbleU }}>
                    {m.content}
                  </div>
                ) : (
                  <div>
                    <div style={{ ...c.bubble, ...c.bubbleA }}>
                      {m.content}
                      {m.showJA && m.ja && (
                        <div style={c.jaBlock}>{m.ja}</div>
                      )}
                    </div>
                    {!m.isSystem && (
                      <div style={c.msgActions}>
                        {ttsOk && (
                          <button style={c.actionBtn} title="読み上げ"
                            onClick={() => {
                              if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
                              else { setIsSpeaking(true); speakKorean(m.content, () => setIsSpeaking(false)); }
                            }}>🔊 읽기</button>
                        )}
                        {m.ja && (
                          <button
                            style={{ ...c.actionBtn, ...(m.showJA ? c.actionBtnOn : {}) }}
                            onClick={() => toggleJA(i)}
                          >{m.showJA ? "日訳を隠す" : "🇯🇵 日訳を見る"}</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* ローディング / リトライ */}
            {loading && (
              <div style={c.row}>
                <div style={c.who}/>
                {retryInfo ? (
                  <div style={{ ...c.bubble, ...c.bubbleA, padding: "11px 14px", color: "#e85d6b", fontSize: 13 }}>
                    ⏳ {retryInfo.countdown}秒後に再試行します… ({retryInfo.attempt}/{retryInfo.max}回目)
                  </div>
                ) : (
                  <div style={{ ...c.bubble, ...c.bubbleA, padding: "14px 18px", display: "flex", gap: 5 }}>
                    {[0, 0.2, 0.4].map((d, k) =>
                      <span key={k} style={{ ...c.dot, animationDelay: `${d}s` }}/>
                    )}
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* クイックリプライ */}
          {started && (
            <div style={c.quick}>
              {quickReplies.map(q => (
                <button key={q.v} style={c.qBtn}
                        onClick={() => send(q.v)} disabled={loading}>{q.l}</button>
              ))}
            </div>
          )}

          {/* 入力エリア */}
          <div style={c.inputArea}>
            {!started ? (
              theme ? (
                /* テーマ選択済み → スタートボタン */
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div style={c.selectedThemeBar}>
                    <span style={{ fontSize: 13, color: "#555" }}>
                      {theme.emoji} <strong>{theme.label}</strong>（{theme.ko}）が選ばれました
                    </span>
                    <button
                      style={c.changeThemeBtn}
                      onClick={() => setTheme(null)}
                    >変更</button>
                  </div>
                  <button
                    style={c.startBtn}
                    onClick={() => handleStart(theme)}
                  >
                    시작！　会話を始める 🌸
                  </button>
                </div>
              ) : (
                /* テーマ未選択 */
                <div style={{ flex: 1, textAlign: "center", color: "#bbb", fontSize: 13 }}>
                  上からテーマを選んでください
                </div>
              )
            ) : (
              /* 会話中 → 通常入力 */
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <button
                    style={{ ...c.micBtn, background: micState === "listening" ? "#e85d6b" : "#f0d9d9", opacity: micState === "unsupported" ? 0.3 : 1 }}
                    onClick={toggleMic} disabled={micState === "unsupported"}
                    title={micState === "unsupported" ? "Chrome推奨" : micState === "listening" ? "停止" : "音声入力"}
                  >
                    <span style={{ fontSize: 20 }}>{micState === "listening" ? "⏹" : "🎤"}</span>
                  </button>
                  <button
                    style={micState === "unsupported" ? { display: "none" } : {
                      border: "none", background: micLang === "ko-KR" ? "#e85d6b" : "#888",
                      color: "#fff", borderRadius: 6, padding: "2px 5px",
                      fontSize: 9, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap",
                    }}
                    onClick={() => setMicLang(l => l === "ko-KR" ? "ja-JP" : "ko-KR")}
                    title="言語切り替え"
                  >
                    {micLang === "ko-KR" ? "한국어" : "日本語"}
                  </button>
                </div>
                <textarea
                  ref={inputRef} style={c.ta}
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={micState === "listening" ? "🎤 聞いています..." : "韓国語か日本語で入力… (Enter送信)"}
                  rows={2} disabled={loading || micState === "listening"}
                />
                <button
                  style={{ ...c.sendBtn, opacity: (!input.trim() || loading) ? 0.45 : 1 }}
                  onClick={() => send(input)} disabled={!input.trim() || loading}
                >送信</button>
              </>
            )}
          </div>
          {micState === "listening" && (
            <div style={c.listenBar}>
              🎤 {micLang === "ko-KR" ? "한국어(韓国語)" : "日本語"}で認識中… 話し終わると自動停止します
            </div>
          )}
        </div>

        {/* ══ 単語メモ（サイドバー） ══ */}
        <div style={c.side}>
          <div style={c.sideTitle}>📝 単語メモ</div>
          <div style={c.vocabForm}>
            <input style={c.vocabInput} placeholder="단어 (韓国語)"
                   value={newWord} onChange={e => setNewWord(e.target.value)}
                   onKeyDown={e => e.key === "Enter" && addVocab()}/>
            <input style={c.vocabInput} placeholder="意味 (日本語)"
                   value={newMeaning} onChange={e => setNewMeaning(e.target.value)}
                   onKeyDown={e => e.key === "Enter" && addVocab()}/>
            <button style={{ ...c.vocabAddBtn, opacity: !newWord.trim() ? 0.4 : 1 }}
                    onClick={addVocab} disabled={!newWord.trim()}>＋ 追加</button>
          </div>
          {vocab.length === 0
            ? <div style={c.sideEmpty}>覚えたい単語を自由に追加しましょう</div>
            : vocab.map((v, i) => (
                <div key={i} style={c.vocabItem}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#333" }}>{v.word}</div>
                    {v.meaning && <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{v.meaning}</div>}
                  </div>
                  <button style={c.vocabDelBtn} onClick={() => deleteVocab(i)} title="削除">×</button>
                </div>
              ))
          }
        </div>
      </div>

      {/* ══ チェンジログモーダル ══ */}
      {showChangelog && (
        <div style={c.overlay} onClick={() => setShowChangelog(false)}>
          <div style={c.modal} onClick={e => e.stopPropagation()}>
            <div style={c.modalHeader}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>📋 アップデート履歴</span>
              <button style={c.closeBtn} onClick={() => setShowChangelog(false)}>✕</button>
            </div>
            <div style={c.modalBody}>
              {CHANGELOG.map((entry, i) => (
                <div key={entry.version} style={{ ...c.clEntry, ...(i === 0 ? c.clEntryLatest : {}) }}>
                  <div style={c.clVerRow}>
                    <span style={{ ...c.clVer, ...(i === 0 ? c.clVerLatest : {}) }}>
                      v{entry.version}
                    </span>
                    {i === 0 && <span style={c.clLatestTag}>最新</span>}
                    <span style={c.clDate}>{entry.date}</span>
                  </div>
                  <ul style={c.clList}>
                    {entry.changes.map((ch, j) =>
                      <li key={j} style={c.clItem}>• {ch}</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ CSS アニメーション ══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes bounce {
          0%,80%,100% { transform: translateY(0); }
          40%          { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

/* ════════════════════════════════════════
   スタイル定数
════════════════════════════════════════ */
const c = {
  app:        { display: "flex", flexDirection: "column", height: "100vh",
                background: "#fdf6f0", fontFamily: "'Noto Sans JP','Noto Sans KR',sans-serif" },
  /* Header */
  header:     { background: "#e85d6b", color: "#fff", padding: "11px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  hLeft:      { display: "flex", alignItems: "center", gap: 10 },
  hRight:     { display: "flex", alignItems: "center", gap: 8 },
  hTitle:     { fontSize: 16, fontWeight: 700 },
  hSub:       { fontSize: 10, opacity: 0.85 },
  iconBtn:    { background: "rgba(255,255,255,.2)", border: "none", borderRadius: 18,
                padding: "3px 9px", fontSize: 15, cursor: "pointer", color: "#fff" },
  badge:      { background: "#fff", color: "#e85d6b", fontWeight: 700,
                fontSize: 13, borderRadius: 16, padding: "3px 11px" },
  verBtn:     { position: "relative", background: "rgba(255,255,255,.15)",
                border: "1px solid rgba(255,255,255,.5)", color: "#fff", borderRadius: 12,
                padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  newDot:     { position: "absolute", top: -3, right: -3, width: 8, height: 8,
                borderRadius: "50%", background: "#ffdd57",
                display: "inline-block", border: "1.5px solid #e85d6b" },
  /* Layout */
  body:       { display: "flex", flex: 1, overflow: "hidden" },
  chatCol:    { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  /* Avatar panel */
  avatarPanel:{ display: "flex", flexDirection: "column", alignItems: "center",
                gap: 5, padding: "12px 16px 8px",
                background: "linear-gradient(to bottom,#fff0f2,#fff8f6)",
                borderBottom: "1px solid #f0d9d9", flexShrink: 0 },
  avatarWrap: { position: "relative", width: 100, height: 100,
                borderRadius: "50%", overflow: "hidden",
                border: "3px solid #e85d6b",
                boxShadow: "0 3px 14px rgba(232,93,107,.30)",
                flexShrink: 0 },
  avatarImg:  { width: "100%", height: "100%", objectFit: "cover",
                objectPosition: "center top", display: "block",
                userSelect: "none", WebkitUserDrag: "none" },
  avatarName: { fontSize: 13, fontWeight: 700, color: "#333" },
  avatarStatus:{ fontSize: 11, color: "#b08080" },
  /* Theme selection panel */
  themePanel: { padding: "12px 14px", background: "#fff8f6",
                borderBottom: "1px solid #f0d9d9", flexShrink: 0 },
  themePanelTitle: { fontSize: 13, fontWeight: 700, color: "#555",
                     marginBottom: 10, textAlign: "center" },
  themeGrid:  { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  themeBtn:   { display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "10px 6px", background: "#fff",
                border: "1.5px solid #f0d9d9", borderRadius: 12, cursor: "pointer",
                transition: "all .15s", fontFamily: "inherit" },
  /* Selected theme bar */
  selectedThemeBar: { display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "#fff0f2", border: "1px solid #f0d9d9",
                      borderRadius: 8, padding: "6px 10px" },
  changeThemeBtn: { background: "none", border: "1px solid #ccc", color: "#888",
                    borderRadius: 6, padding: "2px 8px", fontSize: 11,
                    cursor: "pointer", fontFamily: "inherit" },
  /* Messages */
  msgs:       { flex: 1, overflowY: "auto", padding: "12px",
                display: "flex", flexDirection: "column", gap: 10 },
  row:        { display: "flex", flexDirection: "column", maxWidth: "86%",
                alignSelf: "flex-start", gap: 3 },
  rowUser:    { alignSelf: "flex-end" },
  who:        { display: "flex", alignItems: "center", gap: 5, marginBottom: 2 },
  name:       { fontSize: 11, color: "#aaa", fontWeight: 600 },
  /* bubble: lineHeight を 1.4 に下げ、whiteSpace: pre-wrap で改行を維持 */
  bubble:     { padding: "9px 12px", fontSize: 14, lineHeight: 1.4, borderRadius: 14,
                boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                whiteSpace: "pre-wrap", wordBreak: "break-word" },
  bubbleA:    { background: "#fff", border: "1px solid #f0d9d9", color: "#333" },
  bubbleU:    { background: "#e85d6b", color: "#fff" },
  jaBlock:    { marginTop: 8, paddingTop: 8, borderTop: "1px dashed #f0d9d9",
                color: "#888", fontSize: 13, lineHeight: 1.4 },
  msgActions: { display: "flex", gap: 5, marginTop: 4 },
  actionBtn:  { background: "#fff", border: "1px solid #eee", borderRadius: 14,
                padding: "3px 10px", fontSize: 11, cursor: "pointer", color: "#bbb", fontFamily: "inherit" },
  actionBtnOn:{ background: "#fff0f2", border: "1px solid #e85d6b", color: "#e85d6b" },
  dot:        { width: 7, height: 7, borderRadius: "50%", background: "#e85d6b",
                display: "inline-block", animation: "bounce 1.2s infinite" },
  /* Quick replies */
  quick:      { padding: "6px 12px", display: "flex", gap: 6, flexWrap: "wrap",
                borderTop: "1px solid #f0d9d9", background: "#fff8f6", flexShrink: 0 },
  qBtn:       { background: "#fff", border: "1px solid #e85d6b", color: "#e85d6b",
                borderRadius: 18, padding: "4px 11px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" },
  /* Input */
  inputArea:  { padding: "9px 12px", background: "#fff", borderTop: "1px solid #f0d9d9",
                display: "flex", gap: 6, alignItems: "center", flexShrink: 0 },
  micBtn:     { border: "none", borderRadius: "50%", width: 40, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0 },
  ta:         { flex: 1, border: "1.5px solid #f0d9d9", borderRadius: 11, padding: "7px 10px",
                fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none",
                lineHeight: 1.5, background: "#fdf6f0" },
  sendBtn:    { background: "#e85d6b", color: "#fff", border: "none", borderRadius: 9,
                padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  startBtn:   { flex: 1, background: "#e85d6b", color: "#fff", border: "none",
                borderRadius: 11, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  listenBar:  { background: "#fce8ea", color: "#c0392b", fontSize: 11,
                padding: "5px 14px", textAlign: "center", flexShrink: 0 },
  /* Vocab sidebar */
  side:       { width: 175, borderLeft: "1px solid #f0d9d9", background: "#fffaf8",
                padding: 10, overflowY: "auto", display: "flex", flexDirection: "column",
                gap: 7, flexShrink: 0 },
  sideTitle:  { fontSize: 12, fontWeight: 700, color: "#e85d6b",
                borderBottom: "1px solid #f0d9d9", paddingBottom: 6, marginBottom: 2 },
  sideEmpty:  { fontSize: 11, color: "#ccc", lineHeight: 1.6, textAlign: "center", marginTop: 8 },
  vocabForm:  { display: "flex", flexDirection: "column", gap: 5 },
  vocabInput: { border: "1px solid #f0d9d9", borderRadius: 7, padding: "5px 7px",
                fontSize: 11, fontFamily: "inherit", outline: "none", background: "#fff", width: "100%" },
  vocabAddBtn:{ background: "#e85d6b", color: "#fff", border: "none", borderRadius: 7,
                padding: "5px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  vocabItem:  { background: "#fff", border: "1px solid #f0d9d9", borderRadius: 8,
                padding: "5px 7px", display: "flex", alignItems: "flex-start", gap: 4 },
  vocabDelBtn:{ background: "none", border: "none", color: "#ddd", cursor: "pointer",
                fontSize: 14, padding: "0 1px", flexShrink: 0, lineHeight: 1 },
  /* Changelog modal */
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:      { background: "#fff", borderRadius: 16, width: "min(92vw,420px)",
                maxHeight: "80vh", display: "flex", flexDirection: "column",
                boxShadow: "0 8px 40px rgba(0,0,0,.2)", overflow: "hidden" },
  modalHeader:{ background: "#e85d6b", color: "#fff", padding: "13px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  closeBtn:   { background: "rgba(255,255,255,.2)", border: "none", color: "#fff",
                borderRadius: "50%", width: 28, height: 28, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" },
  modalBody:  { overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 },
  clEntry:    { borderRadius: 10, padding: "11px 13px", background: "#fdf6f0", border: "1px solid #f0d9d9" },
  clEntryLatest:{ background: "#fff0f2", border: "1.5px solid #e85d6b" },
  clVerRow:   { display: "flex", alignItems: "center", gap: 7, marginBottom: 7 },
  clVer:      { fontWeight: 700, fontSize: 14, color: "#888" },
  clVerLatest:{ color: "#e85d6b" },
  clLatestTag:{ background: "#e85d6b", color: "#fff", borderRadius: 8, padding: "1px 7px", fontSize: 10, fontWeight: 700 },
  clDate:     { fontSize: 11, color: "#aaa", marginLeft: "auto" },
  clList:     { listStyle: "none", display: "flex", flexDirection: "column", gap: 4 },
  clItem:     { fontSize: 13, color: "#555", lineHeight: 1.4 },
};
