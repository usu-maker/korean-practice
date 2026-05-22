import { useState, useRef, useEffect, useCallback } from "react";

const SYSTEM_PROMPT = `あなたは韓国語会話練習の先生「ソナ先生」です。ユーザーはハングル検定5級取得を目指す超初心者の日本人です。

## ルール
- 必ず韓国語で話しかける（シンプルな文章、5級レベル）
- 返答は以下の形式で：
  1. 韓国語の返答（短く、初級レベル）
  2. 読み方（ひらがな）
  3. 日本語訳
  4. もし文法ミスがあれば優しく指摘
  5. 次の会話につながる簡単な質問（韓国語＋読み方＋訳）

## 5級レベルの目安
- 基本あいさつ、自己紹介、数字、曜日、時間、基礎単語300語程度

## 音声読み上げのルール
返答の最初の行に [TTS]韓国語のみ[/TTS] を必ず含めること。

## 単語メモ
重要な単語が出たら返答の最後に：
📝 今日の単語: 単語（読み方）= 意味`;

function extractTTS(t) {
  const m = t.match(/\[TTS\]([\s\S]*?)\[\/TTS\]/);
  return m ? m[1].trim() : null;
}
function cleanDisplay(t) {
  return t.replace(/\[TTS\][\s\S]*?\[\/TTS\]\n?/, "").trim();
}
function extractVocab(t) {
  return [...t.matchAll(/📝\s*今日の単語[：:]?\s*(.+)/g)].map(m => m[1].trim());
}
function speakKorean(text, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR"; u.rate = 0.85;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export default function App() {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "안녕하세요！ 저는 소나 선생님이에요。\n(あんにょんはせよ！ じょのん そな そんせんにみえよ)\n\nはじめまして！ソナ先生です🌸\n「시작！」ボタンで会話を始めましょう！",
    isSystem: true,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [vocab, setVocab] = useState([]);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micState, setMicState] = useState("idle"); // idle | listening | unsupported
  const [micLang, setMicLang] = useState("ko-KR"); // ko-KR | ja-JP
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);
  const ttsOk = !!window.speechSynthesis;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicState("unsupported"); return; }
    const r = new SR();
    r.lang = micLang; r.continuous = false; r.interimResults = false;
    r.onresult = e => { setInput(e.results[0][0].transcript); setMicState("idle"); };
    r.onerror = () => setMicState("idle");
    r.onend = () => setMicState("idle");
    recRef.current = r;
  }, []);

  useEffect(() => {
    if (recRef.current) recRef.current.lang = micLang;
  }, [micLang]);

  useEffect(() => {

  const send = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const history = [...messages.filter(m => !m.isSystem), userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      let data;
      try { data = await res.json(); } catch { throw new Error(`サーバーからの応答が不正です (HTTP ${res.status})`); }
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error) || `HTTP ${res.status}`);
      if (!data.text) throw new Error(`textが空です: ${JSON.stringify(data).slice(0, 200)}`);
      const raw = data.text;
      const tts = extractTTS(raw);
      const display = cleanDisplay(raw);
      const newVocab = extractVocab(raw);
      if (newVocab.length) setVocab(prev => {
        const merged = [...prev];
        newVocab.forEach(v => { if (!merged.includes(v)) merged.push(v); });
        return merged;
      });
      setMessages(prev => [...prev, { role: "assistant", content: display, tts }]);
      if (autoSpeak && tts) { setIsSpeaking(true); speakKorean(tts, () => setIsSpeaking(false)); }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ エラー: ${e.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, loading, autoSpeak]);

  const toggleMic = () => {
    if (micState === "unsupported" || !recRef.current) return;
    if (micState === "listening") { recRef.current.stop(); setMicState("idle"); }
    else { try { recRef.current.start(); setMicState("listening"); } catch { setMicState("idle"); } }
  };

  const quickReplies = [
    { l: "네 (はい)", v: "네" },
    { l: "아니요 (いいえ)", v: "아니요" },
    { l: "모르겠어요 (わかりません)", v: "모르겠어요" },
    { l: "다시 해주세요 (もう一度)", v: "다시 해주세요" },
  ];

  return (
    <div style={c.app}>
      {/* Header */}
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
            <button style={c.iconBtn} onClick={() => setAutoSpeak(v => !v)}>
              {autoSpeak ? "🔊" : "🔇"}
            </button>
          )}
          <div style={c.badge}>5급</div>
        </div>
      </div>

      <div style={c.body}>
        {/* Chat */}
        <div style={c.chatCol}>
          <div style={c.msgs}>
            {messages.map((m, i) => (
              <div key={i} style={{ ...c.row, ...(m.role === "user" ? c.rowUser : {}) }}>
                {m.role === "assistant" && (
                  <div style={c.who}><span>🌸</span><span style={c.name}>소나 선생님</span></div>
                )}
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                  <div style={{ ...c.bubble, ...(m.role === "user" ? c.bubbleU : c.bubbleA) }}>
                    {m.content.split("\n").map((ln, j, a) => (
                      <span key={j}>{ln}{j < a.length - 1 && <br />}</span>
                    ))}
                  </div>
                  {m.role === "assistant" && m.tts && ttsOk && (
                    <button style={c.speakBtn} onClick={() => {
                      if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
                      else { setIsSpeaking(true); speakKorean(m.tts, () => setIsSpeaking(false)); }
                    }}>🔊</button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={c.row}>
                <div style={c.who}><span>🌸</span></div>
                <div style={{ ...c.bubble, ...c.bubbleA, padding: "14px 18px", display: "flex", gap: 5 }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} style={{ ...c.dot, animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {started && (
            <div style={c.quick}>
              {quickReplies.map(q => (
                <button key={q.v} style={c.qBtn} onClick={() => send(q.v)} disabled={loading}>{q.l}</button>
              ))}
            </div>
          )}

          <div style={c.inputArea}>
            {!started ? (
              <button style={c.startBtn} onClick={() => { setStarted(true); send("시작！（始める）"); }}>
                시작！　会話を始める 🌸
              </button>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  <button
                    style={{ ...c.micBtn, background: micState === "listening" ? "#e85d6b" : "#f0d9d9", opacity: micState === "unsupported" ? 0.3 : 1 }}
                    onClick={toggleMic}
                    disabled={micState === "unsupported"}
                    title={micState === "unsupported" ? "Chrome推奨" : micState === "listening" ? "停止" : "音声入力"}
                  >
                    <span style={{ fontSize: 20 }}>{micState === "listening" ? "⏹" : "🎤"}</span>
                  </button>
                  <button
                    style={{ border: "none", background: micLang === "ko-KR" ? "#e85d6b" : "#ddd", color: "#fff", borderRadius: 8, padding: "1px 5px", fontSize: 9, cursor: "pointer", fontWeight: 700 }}
                    onClick={() => setMicLang(l => l === "ko-KR" ? "ja-JP" : "ko-KR")}
                    title="音声入力言語を切り替え"
                  >
                    {micLang === "ko-KR" ? "한국어" : "日本語"}
                  </button>
                </div>
                <textarea
                  ref={inputRef}
                  style={c.ta}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={micState === "listening" ? "🎤 聞いています..." : "韓国語か日本語で入力… (Enter送信)"}
                  rows={2}
                  disabled={loading || micState === "listening"}
                />
                <button
                  style={{ ...c.sendBtn, opacity: (!input.trim() || loading) ? 0.45 : 1 }}
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                >送信</button>
              </>
            )}
          </div>
          {micState === "listening" && (
            <div style={c.listenBar}>🎤 {micLang === "ko-KR" ? "한국어" : "日本語"}で認識中… 話し終わると自動停止します</div>
          )}
        </div>

        {/* Vocab sidebar */}
        <div style={c.side}>
          <div style={c.sideTitle}>📝 単語メモ</div>
          {vocab.length === 0
            ? <div style={c.sideEmpty}>会話中に出てきた単語がここに貯まります</div>
            : vocab.map((v, i) => <div key={i} style={c.vocabItem}>{v}</div>)
          }
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}

const c = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: "#fdf6f0", fontFamily: "'Noto Sans JP','Noto Sans KR',sans-serif" },
  header: { background: "#e85d6b", color: "#fff", padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  hLeft: { display: "flex", alignItems: "center", gap: 10 },
  hRight: { display: "flex", alignItems: "center", gap: 8 },
  hTitle: { fontSize: 16, fontWeight: 700 },
  hSub: { fontSize: 10, opacity: 0.85 },
  iconBtn: { background: "rgba(255,255,255,.2)", border: "none", borderRadius: 18, padding: "3px 9px", fontSize: 15, cursor: "pointer", color: "#fff" },
  badge: { background: "#fff", color: "#e85d6b", fontWeight: 700, fontSize: 13, borderRadius: 16, padding: "3px 11px" },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  chatCol: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  msgs: { flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", flexDirection: "column", maxWidth: "86%", alignSelf: "flex-start", gap: 3 },
  rowUser: { alignSelf: "flex-end" },
  who: { display: "flex", alignItems: "center", gap: 5, marginBottom: 2 },
  name: { fontSize: 11, color: "#aaa", fontWeight: 600 },
  bubble: { padding: "9px 12px", fontSize: 14, lineHeight: 1.75, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  bubbleA: { background: "#fff", border: "1px solid #f0d9d9", color: "#333" },
  bubbleU: { background: "#e85d6b", color: "#fff" },
  speakBtn: { background: "none", border: "none", fontSize: 14, cursor: "pointer", opacity: 0.55, padding: 2, flexShrink: 0 },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "#e85d6b", display: "inline-block", animation: "bounce 1.2s infinite" },
  quick: { padding: "6px 12px", display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid #f0d9d9", background: "#fff8f6", flexShrink: 0 },
  qBtn: { background: "#fff", border: "1px solid #e85d6b", color: "#e85d6b", borderRadius: 18, padding: "4px 11px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" },
  inputArea: { padding: "9px 12px", background: "#fff", borderTop: "1px solid #f0d9d9", display: "flex", gap: 6, alignItems: "flex-end", flexShrink: 0 },
  micBtn: { border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  ta: { flex: 1, border: "1.5px solid #f0d9d9", borderRadius: 11, padding: "7px 10px", fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.5, background: "#fdf6f0" },
  sendBtn: { background: "#e85d6b", color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  startBtn: { flex: 1, background: "#e85d6b", color: "#fff", border: "none", borderRadius: 11, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  listenBar: { background: "#fce8ea", color: "#c0392b", fontSize: 11, padding: "5px 14px", textAlign: "center", flexShrink: 0 },
  side: { width: 165, borderLeft: "1px solid #f0d9d9", background: "#fffaf8", padding: 11, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 },
  sideTitle: { fontSize: 12, fontWeight: 700, color: "#e85d6b", borderBottom: "1px solid #f0d9d9", paddingBottom: 6, marginBottom: 2 },
  sideEmpty: { fontSize: 11, color: "#ccc", lineHeight: 1.6, textAlign: "center", marginTop: 14 },
  vocabItem: { background: "#fff", border: "1px solid #f0d9d9", borderRadius: 7, padding: "4px 8px", fontSize: 11, lineHeight: 1.5, color: "#555" },
};
