import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
2. 文法・自然さチェック（下記ルール参照）
3. 次の会話につながる質問（韓国語のみ）

[JA]
（1〜3の内容をすべて省略せずに日本語に翻訳する。チェック欄の内容も含めてすべて訳す）
[/JA]

## 文法・自然さチェック ルール
ユーザーの韓国語入力に文法ミス・不自然な表現・誤字があった場合：
- 韓国語の返答の直後（[JA]の前）に以下の形式を必ず含める（記号・改行も正確に）

✏️ チェック：
入力：（ユーザーの入力をそのまま記載）
修正：（正しい表現）
解説：（日本語で理由を1〜2文で簡潔に説明）

- ミスがない場合は「✅ 完璧です！」と返答末尾（[JA]の前）に一言添える
- 指摘は責めず、優しく励ますトーンで
- ✏️チェック欄の「解説：」は日本語で書いてよい（[JA]外での唯一の例外）

## 重要なルール
- ひらがな・カタカナの読み方は一切書かない
- 日本語は必ず [JA]〜[/JA] の中だけに書く（✏️チェック欄の「解説：」のみ例外）
- [JA] の外には韓国語のみ

## 5級レベルの目安
- 基本あいさつ、自己紹介、数字、曜日、時間、基礎単語300語程度

## 新出単語の提案
[JA][/JA]の直後に以下の形式で今回の会話から覚えると良い単語を1〜2個提案すること：
[VOCAB]
韓国語｜日本語の意味
（2つ目があれば改行で追加）
[/VOCAB]
提案がない場合は[VOCAB]ブロック自体を省略してよい。`;

const THEME_SYSTEM_EXTRAS = {
  game: `\n\n## 今日のテーマ：ゲーム（게임）
- ゲームが大好きなソナ先生として、オタク目線で熱量高く話す
- 具体的なタイトル名・キャラ名・イベント情報を積極的に使う
- 会話例：「요즘 어떤 게임 해요？」「최애 캐릭터가 누구예요？」
- 最新のアップデート・コラボ・ガチャ情報も自然に取り入れる`,

  anime: `\n\n## 今日のテーマ：アニメ（애니메이션）
- アニメ好きのソナ先生として、今期アニメへの熱い感想を語る
- 具体的な作品名・キャラ名・声優・展開に触れる
- 会話例：「요즘 어떤 애니 봐요？」「최애 캐릭터가 있어요？」
- 「あのシーン良かった！」「最終回どうだった？」的なファン目線で話す`,

  sports: `\n\n## 今日のテーマ：スポーツ（스포츠）
- スポーツ好きのソナ先生として、最新試合結果・選手情報を熱く語る
- 実際の選手名・チーム名・スコアを具体的に使う
- 会話例：「어떤 스포츠 좋아해요？」「오늘 경기 봤어요？」
- 「大谷翔平すごかった！」など実況者目線で話す`,

  kpop: `\n\n## 今日のテーマ：K-pop（K팝）
- K-popファンのソナ先生として、推しへの愛を熱く語る
- グループ名・メンバー名・最新曲・カムバック情報を具体的に使う
- 会話例：「좋아하는 아이돌이 있어요？」「최근에 나온 노래 들었어요？」
- 「このMVが神だった！」など熱狂的ファン目線で話す`,

  cooking: `\n\n## 今日のテーマ：料理（요리）
- 韓国料理大好きなソナ先生として、グルメ目線で熱く語る
- 具体的なメニュー名・食材・食べ方・お店スタイルを使う
- 会話例：「한국 음식 좋아해요？」「제일 좋아하는 음식이 뭐예요？」
- 最新トレンドのメニューや話題のレシピを自然に話題に出す`,

  travel: `\n\n## 今日のテーマ：旅行（여행）
- 韓国旅行の達人ソナ先生として、おすすめスポットを熱く紹介
- 具体的な地名・観光地・グルメ・カフェ・ショップ名を使う
- 会話例：「한국에 가고 싶어요？」「어느 지역에 가보고 싶어요？」
- 「ここのカフェが最高だった！」など実体験っぽく話す`,
};

function buildSystemPrompt(theme) {
  if (!theme) return BASE_SYSTEM;
  return BASE_SYSTEM + (THEME_SYSTEM_EXTRAS[theme.id] || "");
}

/* ─── 韓国語テキスト（単語タップ対応）コンポーネント ─── */
/* 問題1修正: [가-힣]+パターンで全ハングル文字を自動検出しspan化 */
/* 問題2修正: 全行を処理し空行(\n\n)があっても全文表示 */
function KoreanText({ text, words, onWordClick }) {
  const parts = text.split(/([가-힣]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/[가-힣]/.test(part)) {
          const wordData = (words || []).find(w => w.word === part);
          return (
            <span
              key={i}
              style={{
                borderBottom: '2px dotted #e85d6b',
                color: '#c94455',
                cursor: 'pointer',
                borderRadius: 2,
                padding: '0 1px',
                display: 'inline',
              }}
              onClick={e => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                onWordClick({
                  word: part,
                  reading: wordData?.reading ?? null,
                  meaning: wordData?.meaning ?? null,
                  x: rect.left,
                  y: rect.bottom,
                  needsTranslation: !wordData,
                });
              }}
            >
              {part}
            </span>
          );
        }
        return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
      })}
    </>
  );
}

/* ─── テキスト処理 ─── */
function extractJA(t) {
  const m = t.match(/\[JA\]([\s\S]*?)\[\/JA\]/);
  return m ? m[1].trim() : null;
}
function extractKorean(t) {
  return t.replace(/\[JA\][\s\S]*?\[\/JA\]\n?/g, "")
           .replace(/\[VOCAB\][\s\S]*?\[\/VOCAB\]\n?/g, "")
           .replace(/\[WORDS\][\s\S]*?\[\/WORDS\]\n?/g, "")
           .trim();
}
function extractWordData(t) {
  const m = t.match(/\[WORDS\]([\s\S]*?)\[\/WORDS\]/);
  if (!m) return [];
  try {
    const raw = m[1].trim();
    const json = JSON.parse(raw);
    if (!Array.isArray(json.words)) return [];
    return json.words.filter(w => w && w.word && w.reading !== undefined && w.meaning !== undefined);
  } catch { return []; }
}
function extractVocabSuggestions(t) {
  const m = t.match(/\[VOCAB\]([\s\S]*?)\[\/VOCAB\]/);
  if (!m) return [];
  return m[1].trim().split('\n')
    .map(line => {
      const [word, meaning] = line.split('｜').map(s => s.trim());
      return word && meaning ? { word, meaning } : null;
    })
    .filter(Boolean);
}
function extractMistake(t) {
  const m = t.match(/✏️\s*チェック[：:]\s*[\r\n]+入力[：:]\s*([^\r\n]+)[\r\n]+修正[：:]\s*([^\r\n]+)[\r\n]+解説[：:]\s*([^\r\n]+)/);
  if (!m) return null;
  return { input: m[1].trim(), correction: m[2].trim(), explanation: m[3].trim() };
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

/* ─── 連続記録（ストリーク） ─── */
const todayStr  = () => new Date().toISOString().split("T")[0];
const yesterStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};
function loadStreakData() {
  try { return JSON.parse(localStorage.getItem("korean_streak") || "{}"); }
  catch { return {}; }
}
function saveStreakData(data) {
  localStorage.setItem("korean_streak", JSON.stringify(data));
}

/* ─── 実績システム ─── */
const ACHIEVEMENTS = [
  { id: "first_convo",  emoji: "🌱", name: "はじめの一歩",   desc: "初めて会話した",               cond: s => s.totalMessages >= 1 },
  { id: "msg_10",       emoji: "💬", name: "おしゃべり上手",  desc: "10回メッセージを送った",         cond: s => s.totalMessages >= 10 },
  { id: "msg_50",       emoji: "🗣️",  name: "会話マスター",    desc: "50回メッセージを送った",         cond: s => s.totalMessages >= 50 },
  { id: "msg_100",      emoji: "🎖️",  name: "ベテラン練習生",  desc: "100回メッセージを送った",        cond: s => s.totalMessages >= 100 },
  { id: "streak_3",     emoji: "🔥", name: "3日連続！",        desc: "3日連続で練習した",              cond: s => s.streak >= 3 },
  { id: "streak_7",     emoji: "🌟", name: "1週間継続！",      desc: "7日連続で練習した",              cond: s => s.streak >= 7 },
  { id: "streak_30",    emoji: "🏆", name: "継続の達人",       desc: "30日連続で練習した",             cond: s => s.streak >= 30 },
  { id: "vocab_5",      emoji: "📚", name: "単語好き",         desc: "単語メモを5個以上追加した",      cond: s => s.vocabCount >= 5 },
  { id: "vocab_20",     emoji: "📖", name: "単語コレクター",   desc: "単語メモを20個以上追加した",     cond: s => s.vocabCount >= 20 },
  { id: "mistake_5",    emoji: "📒", name: "失敗から学ぶ",     desc: "まちがいノートが5件たまった",    cond: s => (s.totalMistakes || 0) >= 5 },
  { id: "perfect_5",    emoji: "✅", name: "パーフェクター",   desc: "完璧！を5回もらった",            cond: s => (s.totalPerfect  || 0) >= 5 },
  { id: "all_themes",   emoji: "🌍", name: "全テーマ制覇！",   desc: "全6テーマで会話した",            cond: s => (s.themesUsed || []).length >= 6 },
  { id: "theme_kpop",   emoji: "🎵", name: "K-popファン",      desc: "K-popテーマで会話した",          cond: s => (s.themesUsed || []).includes("kpop") },
  { id: "theme_game",   emoji: "🎮", name: "ゲーマー",         desc: "ゲームテーマで会話した",         cond: s => (s.themesUsed || []).includes("game") },
  { id: "night_owl",    emoji: "🦉", name: "夜ふかし勉強家",   desc: "深夜（0〜4時）に練習した",       cond: s => s.hasNightSession },
];

/* ─── 今日のミッション ─── */
const MISSIONS = [
  { id: "m0", emoji: "❓", text: "疑問文を1回使ってみよう！",     hint: "~어요? や ~나요? で終わる文を入力",    check: t => /어요\?|예요\?|나요\?|까요\?/.test(t) },
  { id: "m1", emoji: "👋", text: "挨拶してみよう！",               hint: "안녕하세요 や 반갑습니다 を使おう",      check: t => /안녕|반갑/.test(t) },
  { id: "m2", emoji: "🙋", text: "自己紹介してみよう！",           hint: "저는 〜이에요 / 예요 で自己紹介",        check: t => /저는/.test(t) },
  { id: "m3", emoji: "😊", text: "気持ちを韓国語で伝えよう！",    hint: "좋아요・행복해요・피곤해요 などを使おう", check: t => /좋아요|슬퍼요|행복해요|피곤해요|힘들어요|기뻐요/.test(t) },
  { id: "m4", emoji: "🔢", text: "数字を使って話そう！",           hint: "일・이・삼 や 하나・둘・셋 を含む文",    check: t => /일|이|삼|사|오|육|칠|팔|구|십|하나|둘|셋|넷|다섯/.test(t) },
  { id: "m5", emoji: "🙏", text: "감사합니다 を使おう！",          hint: "お礼の표현を練習しよう",                check: t => /감사/.test(t) },
  { id: "m6", emoji: "🤔", text: "모르겠어요 を使ってみよう！",    hint: "わからない時の表現を練習",              check: t => /모르겠/.test(t) },
];

/* ─── フレーズ集 ─── */
const PHRASES = [
  { cat: "挨拶・基本", items: [
    { ko: "안녕하세요", ja: "こんにちは" },
    { ko: "감사합니다", ja: "ありがとうございます" },
    { ko: "죄송합니다", ja: "すみません" },
    { ko: "괜찮아요", ja: "大丈夫です" },
    { ko: "잠깐만요", ja: "ちょっと待ってください" },
    { ko: "잘 부탁드려요", ja: "よろしくお願いします" },
  ]},
  { cat: "自己表現", items: [
    { ko: "저는 일본 사람이에요", ja: "私は日本人です" },
    { ko: "한국어를 공부해요", ja: "韓国語を勉強しています" },
    { ko: "좋아요！", ja: "いいですね！" },
    { ko: "재미있어요", ja: "楽しいです" },
    { ko: "어려워요", ja: "難しいです" },
    { ko: "열심히 할게요", ja: "頑張ります" },
  ]},
  { cat: "疑問・確認", items: [
    { ko: "이게 뭐예요？", ja: "これは何ですか？" },
    { ko: "어디에 있어요？", ja: "どこにありますか？" },
    { ko: "얼마예요？", ja: "いくらですか？" },
    { ko: "맞아요？", ja: "合ってますか？" },
    { ko: "다시 말해 주세요", ja: "もう一度言ってください" },
    { ko: "천천히 말해 주세요", ja: "ゆっくり話してください" },
  ]},
  { cat: "感情・反応", items: [
    { ko: "대박！", ja: "すごい！" },
    { ko: "진짜요？", ja: "本当ですか？" },
    { ko: "너무 좋아요！", ja: "とても好きです！" },
    { ko: "힘들어요", ja: "つらいです" },
    { ko: "배고파요", ja: "お腹が空きました" },
    { ko: "모르겠어요", ja: "わかりません" },
  ]},
];

/* ─── 会話リセット用 初期メッセージ ─── */
const INIT_MSG = [{
  role: "assistant",
  content: "안녕하세요！ 저는 소나 선생님이에요 🌸",
  ja: "はじめまして！ソナ先生です。\nテーマを選んで「시작！」ボタンで会話を始めましょう！",
  showJA: true,
  isSystem: true,
}];

function loadAchievStats() {
  try { return JSON.parse(localStorage.getItem("korean_achiev_stats") || "{}"); }
  catch { return {}; }
}
function saveAchievStats(s) { localStorage.setItem("korean_achiev_stats", JSON.stringify(s)); }
function loadUnlockedAchievs() {
  try { return JSON.parse(localStorage.getItem("korean_achievements") || "[]"); }
  catch { return []; }
}
function saveUnlockedAchievs(ids) { localStorage.setItem("korean_achievements", JSON.stringify(ids)); }

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

  /* ストリーク & 学習履歴 */
  const [streak,          setStreak]         = useState(() => loadStreakData().streak || 0);
  const [todayDone,       setTodayDone]      = useState(() => loadStreakData().lastDate === todayStr());
  const [practiceHistory, setPracticeHistory] = useState(() => loadStreakData().history || []);
  const [sideTab,         setSideTab]        = useState("vocab"); // "vocab" | "history" | "phrases"
  const sessionStarted    = useRef(false);

  /* 単語メモ（localStorage 永続） */
  const [vocab,      setVocab]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("korean_vocab") || "[]"); }
    catch { return []; }
  });
  const [newWord,    setNewWord]    = useState("");
  const [newMeaning, setNewMeaning] = useState("");

  /* まちがいノート（sessionStorage 一時保持） */
  const [mistakes, setMistakes] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("korean_mistakes") || "[]"); }
    catch { return []; }
  });

  /* オープニングアニメーション */
  const [openingState, setOpeningState] = useState("in"); // "in"|"hold"|"out"|"done"

  /* 実績 */
  const [unlockedAchievs, setUnlockedAchievs] = useState(() => loadUnlockedAchievs());
  const [newAchievement,  setNewAchievement]  = useState(null);
  const [showAchievModal, setShowAchievModal] = useState(false);
  const achievQueueRef = useRef([]);

  /* プロフィール・アプリ説明モーダル */
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInfoModal,    setShowInfoModal]    = useState(false);

  /* ① フラッシュカードクイズ */
  const [fc, setFc] = useState({ active: false, deck: [], idx: 0, flipped: false, correct: 0, wrong: 0 });

  /* ② AI単語提案 */
  const [vocabSugs, setVocabSugs] = useState([]); // [{ word, meaning }]

  /* 単語タップポップアップ */
  const [wordPopup, setWordPopup] = useState(null); // null | { word, reading, meaning, x, y }

  /* ③ 今日のミッション */
  const todayMission = useMemo(() => {
    const dy = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
    return MISSIONS[dy % MISSIONS.length];
  }, []);
  const [missionDone,    setMissionDone]    = useState(() => localStorage.getItem(`mission_${todayStr()}`) === "done");
  const [missionVisible, setMissionVisible] = useState(true);

  /* ── スマホ対応 ── */
  const [isMobile,      setIsMobile]      = useState(() => window.innerWidth <= 768);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [mobilePanelTab,setMobilePanelTab]= useState(null); // null | "vocab" | "mistakes" | "phrases"

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

  /* ③ ミッション達成チェック（ユーザーメッセージ更新時） */
  useEffect(() => {
    if (missionDone) return;
    const last = [...messages].reverse().find(m => m.role === "user");
    if (last && todayMission.check(last.content)) {
      setMissionDone(true);
      localStorage.setItem(`mission_${todayStr()}`, "done");
    }
  }, [messages, missionDone, todayMission]);

  /* オープニングアニメーション タイマー */
  useEffect(() => {
    const t1 = setTimeout(() => setOpeningState("hold"), 600);
    const t2 = setTimeout(() => setOpeningState("out"),  2400);
    const t3 = setTimeout(() => setOpeningState("done"), 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  /* スマホ判定（リサイズ対応） */
  useEffect(() => {
    const check = () => {
      const m = window.innerWidth <= 768;
      setIsMobile(m);
      if (!m) { setMenuOpen(false); setMobilePanelTab(null); }
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* 日本語訳トグル */
  const toggleJA = useCallback((idx) => {
    setMessages(prev => prev.map((m, i) => i === idx ? { ...m, showJA: !m.showJA } : m));
  }, []);

  /* 実績チェック & アンロック */
  const checkAndUnlock = useCallback((extraStats = {}) => {
    const sd          = loadStreakData();
    const base        = loadAchievStats();
    const vocabCount  = JSON.parse(localStorage.getItem("korean_vocab") || "[]").length;
    const fullStats   = { ...base, streak: sd.streak || 0, vocabCount, ...extraStats };
    const alreadyUnlocked = loadUnlockedAchievs();

    const newlyUnlocked = ACHIEVEMENTS.filter(
      a => !alreadyUnlocked.includes(a.id) && a.cond(fullStats)
    );
    if (newlyUnlocked.length === 0) return;

    const updated = [...alreadyUnlocked, ...newlyUnlocked.map(a => a.id)];
    saveUnlockedAchievs(updated);
    setUnlockedAchievs(updated);

    /* トースト通知をキューで順番に表示 */
    achievQueueRef.current.push(...newlyUnlocked);
    if (achievQueueRef.current.length === newlyUnlocked.length) {
      const showNext = () => {
        const next = achievQueueRef.current.shift();
        if (!next) return;
        setNewAchievement(next);
        setTimeout(() => { setNewAchievement(null); setTimeout(showNext, 400); }, 3200);
      };
      showNext();
    }
  }, []);

  /* 単語メモ操作 */
  const addVocab = () => {
    if (!newWord.trim()) return;
    const updated = [...vocab, { word: newWord.trim(), meaning: newMeaning.trim() }];
    setVocab(updated);
    setNewWord(""); setNewMeaning("");
    checkAndUnlock({ vocabCount: updated.length });
  };
  const deleteVocab = (i) => setVocab(prev => prev.filter((_, idx) => idx !== i));

  /* 単語ポップアップから単語帳に追加 */
  const addWordFromPopup = useCallback((wordData) => {
    setVocab(prev => {
      if (prev.some(v => v.word === wordData.word)) {
        setWordPopup(null);
        return prev;
      }
      const updated = [...prev, { word: wordData.word, meaning: wordData.meaning }];
      checkAndUnlock({ vocabCount: updated.length });
      return updated;
    });
    setWordPopup(null);
  }, [checkAndUnlock]);

  /* 問題3修正: 未翻訳単語をGeminiで翻訳取得 */
  const fetchWordTranslation = useCallback(async (word) => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      const data = await res.json();
      setWordPopup(prev =>
        prev && prev.word === word
          ? { ...prev, reading: data.reading || '', meaning: data.meaning || '翻訳を取得できませんでした', needsTranslation: false }
          : prev
      );
    } catch {
      setWordPopup(prev =>
        prev && prev.word === word
          ? { ...prev, meaning: '翻訳を取得できませんでした', needsTranslation: false }
          : prev
      );
    }
  }, []);

  const copyMistakes = useCallback(() => {
    if (mistakes.length === 0) return;
    const text = "📒 まちがいノート\n\n" +
      mistakes.map(m =>
        `${m.date}\n入力: ${m.input}\n修正: ${m.correction}\n解説: ${m.explanation}`
      ).join("\n\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [mistakes]);

  /* ④ 会話リセット */
  const resetConversation = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setStarted(false);
    setTheme(null);
    setMessages(INIT_MSG);
    setInput("");
    setLoading(false);
    setRetryInfo(null);
    setVocabSugs([]);
    sessionStarted.current = false;
  }, []);

  /* ① フラッシュカード開始 */
  const startFlashcard = useCallback(() => {
    if (vocab.length === 0) return;
    const shuffled = [...vocab].sort(() => Math.random() - 0.5);
    setFc({ active: true, deck: shuffled, idx: 0, flipped: false, correct: 0, wrong: 0 });
  }, [vocab]);

  /* ① フラッシュカード 正誤処理 */
  const handleFlashcardResult = useCallback((isCorrect) => {
    setFc(prev => ({
      ...prev,
      idx:     prev.idx + 1,
      flipped: false,
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong:   prev.wrong   + (isCorrect ? 0 : 1),
    }));
  }, []);

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

          const ja      = extractJA(data.text);
          const korean  = extractKorean(data.text);
          const words   = extractWordData(data.text);
          setMessages(prev => [...prev, { role: "assistant", content: korean, ja, showJA: false, words }]);

          /* ② AI単語提案を更新 */
          const sugs = extractVocabSuggestions(data.text);
          if (sugs.length > 0) setVocabSugs(sugs);

          /* まちがいノートに記録 */
          const mistake = extractMistake(data.text);
          if (mistake) {
            const entry = {
              date: new Date().toISOString().split("T")[0],
              input: mistake.input,
              correction: mistake.correction,
              explanation: mistake.explanation,
            };
            setMistakes(prev => {
              const updated = [...prev, entry];
              try { sessionStorage.setItem("korean_mistakes", JSON.stringify(updated)); } catch {}
              return updated;
            });
          }

          /* 実績 stats 更新 & チェック */
          {
            const st       = loadAchievStats();
            const hour     = new Date().getHours();
            const nowTheme = (currentTheme || theme)?.id;
            const newStats = {
              ...st,
              totalMessages: (st.totalMessages || 0) + 1,
              totalPerfect:  (st.totalPerfect  || 0) + (data.text.includes("✅ 完璧です！") ? 1 : 0),
              totalMistakes: (st.totalMistakes || 0) + (mistake ? 1 : 0),
              themesUsed:    nowTheme && !(st.themesUsed || []).includes(nowTheme)
                               ? [...(st.themesUsed || []), nowTheme]
                               : (st.themesUsed || []),
              hasNightSession: st.hasNightSession || (hour >= 0 && hour < 4),
            };
            saveAchievStats(newStats);
            checkAndUnlock(newStats);
          }

          if (autoSpeak && korean) {
            setIsSpeaking(true);
            speakKorean(korean, () => setIsSpeaking(false));
          }

          /* ── ストリーク & 履歴の更新 ── */
          {
            const today = todayStr();
            const sd    = loadStreakData();
            let updated = { ...sd };

            if (!sessionStarted.current) {
              sessionStarted.current = true;
              if (sd.lastDate !== today) {
                const newStreak = sd.lastDate === yesterStr()
                  ? (sd.streak || 0) + 1
                  : 1;
                const newEntry = {
                  date:       today,
                  theme:      (currentTheme || theme)?.id    || "free",
                  themeLabel: (currentTheme || theme)?.label || "自由",
                  themeEmoji: (currentTheme || theme)?.emoji || "💬",
                  msgCount:   1,
                };
                updated = {
                  streak:  newStreak,
                  lastDate: today,
                  history: [newEntry, ...(sd.history || []).slice(0, 29)],
                };
                setStreak(newStreak);
                setTodayDone(true);
                setPracticeHistory(updated.history);
              } else {
                // 同じ日・初回カウント
                const hist = [...(sd.history || [])];
                if (hist.length > 0 && hist[0].date === today) {
                  hist[0] = { ...hist[0], msgCount: (hist[0].msgCount || 0) + 1 };
                  updated = { ...sd, history: hist };
                  setPracticeHistory(hist);
                }
              }
            } else {
              // 同セッション内のメッセージ数を加算
              const hist = [...(sd.history || [])];
              if (hist.length > 0 && hist[0].date === today) {
                hist[0] = { ...hist[0], msgCount: (hist[0].msgCount || 0) + 1 };
                updated = { ...sd, history: hist };
                setPracticeHistory(hist);
              }
            }
            saveStreakData(updated);
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
    <div style={{ ...c.app, paddingBottom: isMobile ? 56 : 0 }}
         onClick={() => wordPopup && setWordPopup(null)}>

      {/* ══ ヘッダー ══ */}
      <div style={c.header}>
        <div style={c.hLeft}>
          {/* ソナ先生アバターボタン → プロフィール（PC のみ） */}
          {!isMobile && (
            <button style={c.headerAvatarBtn} onClick={() => setShowProfileModal(true)}
                    title="소나 선생님のプロフィール">
              <img src="/sona.png" alt="소나 선생님" style={c.headerAvatarImg} draggable={false}/>
            </button>
          )}
          <div>
            <div style={c.hTitle}>소나톡</div>
            {!isMobile && <div style={c.hSub}>ハングル検定5級 会話練習</div>}
          </div>
        </div>
        <div style={c.hRight}>
          {isMobile ? (
            /* スマホ: ハンバーガーボタン */
            <button style={c.hamburgerBtn} onClick={() => setMenuOpen(v => !v)}>
              {menuOpen ? "✕" : "☰"}
            </button>
          ) : (
            /* PC: 通常アイコン */
            <>
              {ttsOk && (
                <button style={c.iconBtn} onClick={() => setAutoSpeak(v => !v)}
                        title={autoSpeak ? "自動読み上げON" : "自動読み上げOFF"}>
                  {autoSpeak ? "🔊" : "🔇"}
                </button>
              )}
              <button style={{ ...c.iconBtn, position: "relative" }}
                      onClick={() => setShowAchievModal(true)} title="実績">
                🏆
                <span style={{ ...c.achievCountBadge }}>
                  {unlockedAchievs.length}/{ACHIEVEMENTS.length}
                </span>
              </button>
              <button style={c.iconBtn} onClick={() => setShowInfoModal(true)} title="アプリについて">
                ℹ️
              </button>
              {/* ストリーク表示 */}
              <div
                style={{ ...c.streakChip, ...(streak >= 7 ? c.streakChipHot : streak > 0 ? c.streakChipWarm : c.streakChipCold) }}
                title={todayDone ? `${streak}日連続練習中！` : "今日練習してストリークを守ろう"}
              >
                <span style={{ fontSize: 14 }}>{streak > 0 ? "🔥" : "🌱"}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{streak}</span>
                <span style={{ fontSize: 10, opacity: 0.85 }}>日</span>
              </div>
              <div style={c.badge}>5급</div>
              <button
                style={c.verBtn}
                onClick={() => { setShowChangelog(true); localStorage.setItem("seen_version", CURRENT_VERSION); }}
                title="アップデート履歴"
              >
                v{CURRENT_VERSION}
                {isNewVersion && <span style={c.newDot}/>}
              </button>
            </>
          )}
        </div>

        {/* ハンバーガードロップダウン（スマホのみ） */}
        {isMobile && menuOpen && (
          <div style={c.hamburgerMenu}>
            {ttsOk && (
              <button style={c.hamburgerItem}
                      onClick={() => { setAutoSpeak(v => !v); setMenuOpen(false); }}>
                {autoSpeak ? "🔊" : "🔇"}　自動読み上げ {autoSpeak ? "ON" : "OFF"}
              </button>
            )}
            <button style={c.hamburgerItem}
                    onClick={() => { setShowAchievModal(true); setMenuOpen(false); }}>
              🏆　実績 ({unlockedAchievs.length}/{ACHIEVEMENTS.length})
            </button>
            <button style={c.hamburgerItem}
                    onClick={() => { setShowInfoModal(true); setMenuOpen(false); }}>
              ℹ️　アプリについて
            </button>
            <div style={{ ...c.hamburgerItem, cursor: "default" }}>
              {streak > 0 ? "🔥" : "🌱"}　連続 {streak}日
              {todayDone ? "　✅ 今日完了！" : ""}
            </div>
            <button style={c.hamburgerItem}
                    onClick={() => {
                      setShowChangelog(true);
                      localStorage.setItem("seen_version", CURRENT_VERSION);
                      setMenuOpen(false);
                    }}>
              📋　v{CURRENT_VERSION}{isNewVersion ? " 🆕 新バージョン！" : ""}
            </button>
          </div>
        )}
      </div>

      <div style={c.body}>
        {/* ══ チャット列 ══ */}
        <div style={c.chatCol}>

          {/* ── アバターパネル（上部中央 / スマホはコンパクト横並び） ── */}
          <div style={{ ...c.avatarPanel, ...(isMobile ? c.avatarPanelMobile : {}) }}>
            {isMobile ? (
              /* スマホ: コンパクト横並び */
              <>
                <div style={{ ...c.avatarWrap, width: 52, height: 52, cursor: "pointer", flexShrink: 0 }}
                     onClick={() => setShowProfileModal(true)}>
                  <img src={isSpeaking ? "/sona-talking.gif" : "/sona.png"}
                       alt="소나 선생님" style={c.avatarImg} draggable={false}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#333", cursor: "pointer", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                       onClick={() => setShowProfileModal(true)}>소나 선생님</div>
                  <div style={{ ...c.avatarStatus, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {isSpeaking ? "🗣 話し中…"
                     : loading  ? "💭 考え中…"
                     : theme    ? `${theme.emoji} ${theme.label}`
                     :             "✨ 待機中"}
                  </div>
                </div>
                {started && (
                  <button style={{ ...c.resetBtn, padding: "4px 10px", fontSize: 11, flexShrink: 0 }}
                          onClick={resetConversation} title="リセット">🔄</button>
                )}
              </>
            ) : (
              /* PC: 通常縦並び */
              <>
                <div style={{ ...c.avatarWrap, cursor: "pointer" }}
                     onClick={() => setShowProfileModal(true)} title="프로필 보기">
                  <img
                    src={isSpeaking ? "/sona-talking.gif" : "/sona.png"}
                    alt="소나 선생님"
                    style={c.avatarImg}
                    draggable={false}
                  />
                </div>
                <div style={{ ...c.avatarName, cursor: "pointer" }}
                     onClick={() => setShowProfileModal(true)}>소나 선생님</div>
                <div style={c.avatarStatus}>
                  {isSpeaking ? "🗣 話し中…"
                   : loading  ? "💭 考え中…"
                   : theme    ? `${theme.emoji} ${theme.label}（${theme.ko}）`
                   :             "✨ 待機中"}
                </div>
                {/* ④ 会話リセットボタン */}
                {started && (
                  <button style={c.resetBtn} onClick={resetConversation} title="会話をリセット">
                    🔄 リセット
                  </button>
                )}
              </>
            )}
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

          {/* ③ 今日のミッション バナー */}
          {started && missionVisible && (
            <div style={{ ...c.missionBanner, ...(missionDone ? c.missionBannerDone : {}) }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>
                {missionDone ? "✅" : todayMission.emoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700,
                              color: missionDone ? "#27ae60" : "#e85d6b" }}>
                  {missionDone ? "ミッション達成！🎉" : "今日のミッション"}
                </div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.35, marginTop: 1 }}>
                  {missionDone
                    ? `「${todayMission.text}」クリア！すばらしい！`
                    : todayMission.text}
                </div>
                {!missionDone && (
                  <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>
                    💡 {todayMission.hint}
                  </div>
                )}
              </div>
              <button style={c.missionClose} onClick={() => setMissionVisible(false)}>✕</button>
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
                      <KoreanText
                        text={m.content}
                        words={m.words || []}
                        onWordClick={(w) => {
                          setWordPopup(w);
                          if (w.needsTranslation) fetchWordTranslation(w.word);
                        }}
                      />
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

        {/* ══ サイドバー（PC のみ） ══ */}
        {!isMobile && <div style={c.side}>
          {/* タブ切り替え */}
          <div style={c.sideTabs}>
            <button
              style={{ ...c.sideTabBtn, ...(sideTab === "vocab" ? c.sideTabBtnOn : {}) }}
              onClick={() => setSideTab("vocab")}
            >📝 ノート</button>
            <button
              style={{ ...c.sideTabBtn, ...(sideTab === "history" ? c.sideTabBtnOn : {}) }}
              onClick={() => setSideTab("history")}
            >📅 記録</button>
            <button
              style={{ ...c.sideTabBtn, ...(sideTab === "phrases" ? c.sideTabBtnOn : {}) }}
              onClick={() => setSideTab("phrases")}
            >💬 フレーズ</button>
          </div>

          {sideTab === "vocab" ? (
            /* ── 単語メモ ＋ まちがいノート ── */
            <div style={c.vocabTabBody}>
              {/* 単語メモセクション */}
              <div style={c.sideSectionWrap}>
                <div style={c.sideSectionHdr}>
                  <div style={c.sideTitle}>📝 単語メモ</div>
                  {vocab.length >= 1 && (
                    <button style={c.fcStartBtn} onClick={startFlashcard} title="フラッシュカードで練習">
                      🎴 クイズ
                    </button>
                  )}
                </div>
                {/* ② AI単語提案 */}
                {vocabSugs.length > 0 && (
                  <div style={c.sugBox}>
                    <div style={c.sugTitle}>💡 追加候補</div>
                    {vocabSugs.map((s, i) => (
                      <div key={i} style={c.sugItem}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 11, color: "#333" }}>{s.word}</span>
                          <span style={{ fontSize: 10, color: "#999", marginLeft: 4 }}>{s.meaning}</span>
                        </div>
                        <button
                          style={c.sugAddBtn}
                          onClick={() => {
                            const updated = [...vocab, { word: s.word, meaning: s.meaning }];
                            setVocab(updated);
                            setVocabSugs(prev => prev.filter((_, j) => j !== i));
                            checkAndUnlock({ vocabCount: updated.length });
                          }}
                        >＋</button>
                      </div>
                    ))}
                  </div>
                )}
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
                <div style={c.sideSectionList}>
                  {vocab.length === 0
                    ? <div style={c.sideEmpty}>覚えたい単語を追加しましょう</div>
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

              {/* まちがいノートセクション */}
              <div style={{ ...c.sideSectionWrap, borderTop: "2px solid #f0d9d9", paddingTop: 8, marginTop: 4 }}>
                <div style={c.sideSectionHdr}>
                  <div style={c.sideTitle}>📒 まちがいノート</div>
                  {mistakes.length > 0 && (
                    <button style={c.copyBtn} onClick={copyMistakes}>コピー</button>
                  )}
                </div>
                <div style={c.sideSectionList}>
                  {mistakes.length === 0
                    ? <div style={c.sideEmpty}>ミスが検出されると自動記録されます</div>
                    : mistakes.map((m, i) => (
                        <div key={i} style={c.mistakeItem}>
                          <div style={{ fontSize: 9, color: "#bbb", marginBottom: 2 }}>{m.date}</div>
                          <div style={{ fontSize: 11, color: "#e85d6b", fontWeight: 700, lineHeight: 1.3, wordBreak: "break-all" }}>
                            {m.input}
                          </div>
                          <div style={{ fontSize: 10, color: "#27ae60", fontWeight: 600, lineHeight: 1.3, wordBreak: "break-all" }}>
                            → {m.correction}
                          </div>
                          <div style={{ fontSize: 9, color: "#888", lineHeight: 1.4, marginTop: 2 }}>
                            {m.explanation}
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          ) : sideTab === "phrases" ? (
            /* ── フレーズ集 ── */
            <div style={c.sideScrollBody}>
              <div style={{ fontSize: 10, color: "#bbb", marginBottom: 4, textAlign: "center" }}>
                タップでテキストボックスに入力
              </div>
              {PHRASES.map(cat => (
                <div key={cat.cat} style={{ marginBottom: 6 }}>
                  <div style={c.phraseCatTitle}>{cat.cat}</div>
                  {cat.items.map((p, i) => (
                    <button
                      key={i}
                      style={c.phraseItem}
                      onClick={() => { setInput(p.ko); inputRef.current?.focus(); }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#e85d6b" }}>{p.ko}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>{p.ja}</div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            /* ── 学習履歴（ストリーク詳細） ── */
            <div style={c.sideScrollBody}>
              {/* ストリーク大表示 */}
              <div style={c.streakBig}>
                <div style={{ fontSize: 36, lineHeight: 1 }}>{streak > 0 ? "🔥" : "🌱"}</div>
                <div style={{ fontWeight: 900, fontSize: 28, color: streak >= 7 ? "#e85d6b" : "#555", lineHeight: 1 }}>
                  {streak}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>日連続練習</div>
                {todayDone
                  ? <div style={c.streakDoneTag}>✅ 今日完了！</div>
                  : <div style={c.streakTodoTag}>⚡ 今日まだです</div>
                }
              </div>

              {/* 週間カレンダー */}
              <div style={c.weekRow}>
                {Array.from({ length: 7 }, (_, k) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (6 - k));
                  const ds = d.toISOString().split("T")[0];
                  const done = practiceHistory.some(h => h.date === ds);
                  const isToday = ds === todayStr();
                  return (
                    <div key={k} style={{ ...c.weekDay, ...(isToday ? c.weekDayToday : {}) }}>
                      <div style={{ fontSize: 14 }}>{done ? "🔥" : "○"}</div>
                      <div style={{ fontSize: 8, color: isToday ? "#e85d6b" : "#bbb" }}>
                        {["日","月","火","水","木","金","土"][d.getDay()]}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 履歴リスト */}
              <div style={c.sideTitle}>📋 最近の練習</div>
              {practiceHistory.length === 0
                ? <div style={c.sideEmpty}>会話を始めると記録されます</div>
                : practiceHistory.slice(0, 10).map((h, i) => (
                    <div key={i} style={c.histItem}>
                      <span style={{ fontSize: 16 }}>{h.themeEmoji || "💬"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>
                          {h.themeLabel || "自由会話"}
                        </div>
                        <div style={{ fontSize: 9, color: "#aaa" }}>{h.date}</div>
                      </div>
                      <div style={c.histMsgCount}>{h.msgCount || 0}<br/><span style={{fontSize:7}}>回</span></div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>}
      </div>

      {/* ══ スマホ用 サイドパネル（タブタップで表示） ══ */}
      {isMobile && mobilePanelTab && (
        <div style={c.mobileSidePanel}>
          <div style={c.mobilePanelHeader}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {mobilePanelTab === "vocab"    ? "📝 単語メモ"
               : mobilePanelTab === "mistakes" ? "📒 まちがいノート"
               :                                 "💬 フレーズ集"}
            </span>
            <button
              style={{ background: "rgba(255,255,255,.25)", border: "none", color: "#fff",
                       borderRadius: "50%", width: 28, height: 28, fontSize: 13,
                       cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setMobilePanelTab(null)}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px",
                        display: "flex", flexDirection: "column", gap: 8 }}>

            {mobilePanelTab === "vocab" ? (
              /* ── 単語メモ ── */
              <>
                {/* AI単語提案 */}
                {vocabSugs.length > 0 && (
                  <div style={c.sugBox}>
                    <div style={c.sugTitle}>💡 追加候補</div>
                    {vocabSugs.map((s, i) => (
                      <div key={i} style={c.sugItem}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: "#333" }}>{s.word}</span>
                          <span style={{ fontSize: 11, color: "#999", marginLeft: 4 }}>{s.meaning}</span>
                        </div>
                        <button style={c.sugAddBtn} onClick={() => {
                          const updated = [...vocab, { word: s.word, meaning: s.meaning }];
                          setVocab(updated);
                          setVocabSugs(prev => prev.filter((_, j) => j !== i));
                          checkAndUnlock({ vocabCount: updated.length });
                        }}>＋</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* フラッシュカード起動 */}
                {vocab.length >= 1 && (
                  <button style={{ ...c.fcStartBtn, width: "100%", padding: "8px 0", fontSize: 13 }}
                          onClick={() => { startFlashcard(); setMobilePanelTab(null); }}>
                    🎴 フラッシュカードクイズ
                  </button>
                )}
                {/* 追加フォーム */}
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
                {/* 単語リスト */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {vocab.length === 0
                    ? <div style={c.sideEmpty}>覚えたい単語を追加しましょう</div>
                    : vocab.map((v, i) => (
                        <div key={i} style={c.vocabItem}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>{v.word}</div>
                            {v.meaning && <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{v.meaning}</div>}
                          </div>
                          <button style={c.vocabDelBtn} onClick={() => deleteVocab(i)}>×</button>
                        </div>
                      ))
                  }
                </div>
              </>
            ) : mobilePanelTab === "mistakes" ? (
              /* ── まちがいノート ── */
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#888" }}>{mistakes.length}件</span>
                  {mistakes.length > 0 && (
                    <button style={c.copyBtn} onClick={copyMistakes}>コピー</button>
                  )}
                </div>
                {mistakes.length === 0
                  ? <div style={c.sideEmpty}>ミスが検出されると自動記録されます</div>
                  : mistakes.map((m, i) => (
                      <div key={i} style={c.mistakeItem}>
                        <div style={{ fontSize: 10, color: "#bbb", marginBottom: 2 }}>{m.date}</div>
                        <div style={{ fontSize: 12, color: "#e85d6b", fontWeight: 700, lineHeight: 1.3, wordBreak: "break-all" }}>
                          {m.input}
                        </div>
                        <div style={{ fontSize: 11, color: "#27ae60", fontWeight: 600, lineHeight: 1.3, wordBreak: "break-all" }}>
                          → {m.correction}
                        </div>
                        <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4, marginTop: 2 }}>
                          {m.explanation}
                        </div>
                      </div>
                    ))
                }
              </>
            ) : (
              /* ── フレーズ集 ── */
              <>
                <div style={{ fontSize: 11, color: "#bbb", textAlign: "center" }}>
                  タップでテキストボックスに入力
                </div>
                {PHRASES.map(cat => (
                  <div key={cat.cat}>
                    <div style={c.phraseCatTitle}>{cat.cat}</div>
                    {cat.items.map((p, i) => (
                      <button key={i} style={c.phraseItem}
                              onClick={() => {
                                setInput(p.ko);
                                setMobilePanelTab(null);
                                setTimeout(() => inputRef.current?.focus(), 100);
                              }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#e85d6b" }}>{p.ko}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{p.ja}</div>
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ スマホ用 ボトムタブバー ══ */}
      {isMobile && (
        <div style={c.mobileTabBar}>
          {[
            { id: "vocab",    label: "📝 単語" },
            { id: "mistakes", label: "📒 ミス" },
            { id: "phrases",  label: "💬 フレーズ" },
          ].map(tab => (
            <button
              key={tab.id}
              style={{ ...c.mobileTabBtn, ...(mobilePanelTab === tab.id ? c.mobileTabBtnOn : {}) }}
              onClick={() => setMobilePanelTab(p => p === tab.id ? null : tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ══ ① フラッシュカードモーダル ══ */}
      {fc.active && (
        <div style={c.overlay}>
          {fc.idx >= fc.deck.length ? (
            /* 結果画面 */
            <div style={c.fcModal}>
              <div style={c.modalHeader}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>🎴 クイズ 結果</span>
                <button style={c.closeBtn} onClick={() => setFc(p => ({ ...p, active: false }))}>✕</button>
              </div>
              <div style={{ padding: "24px 16px", textAlign: "center", display: "flex",
                            flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 52 }}>
                  {fc.correct === fc.deck.length ? "🏆" : fc.correct > fc.wrong ? "🌟" : "📚"}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#e85d6b" }}>
                  {fc.correct} / {fc.deck.length} 正解！
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#888" }}>
                  <span>✅ 正解 {fc.correct}</span>
                  <span>❌ 不正解 {fc.wrong}</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={c.fcRetryBtn} onClick={startFlashcard}>🔄 もう一度</button>
                  <button style={{ ...c.fcRetryBtn, background: "#888" }}
                          onClick={() => setFc(p => ({ ...p, active: false }))}>閉じる</button>
                </div>
              </div>
            </div>
          ) : (
            /* カード画面 */
            <div style={c.fcModal}>
              <div style={c.modalHeader}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  🎴 フラッシュカード　{fc.idx + 1}/{fc.deck.length}
                </span>
                <button style={c.closeBtn} onClick={() => setFc(p => ({ ...p, active: false }))}>✕</button>
              </div>
              <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column",
                            alignItems: "center", gap: 14 }}>
                {/* 進捗バー */}
                <div style={{ width: "100%", background: "#f0d9d9", borderRadius: 6,
                              height: 6, overflow: "hidden" }}>
                  <div style={{ background: "#e85d6b", height: "100%", borderRadius: 6,
                                width: `${(fc.idx / fc.deck.length) * 100}%`,
                                transition: "width .3s ease" }}/>
                </div>
                {/* カード本体（タップで裏返し） */}
                <div style={c.fcCard}
                     onClick={() => setFc(p => ({ ...p, flipped: !p.flipped }))}>
                  {fc.flipped ? (
                    <div style={{ display: "flex", flexDirection: "column",
                                  alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 10, color: "#bbb" }}>意味</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#27ae60" }}>
                        {fc.deck[fc.idx].meaning}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column",
                                  alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 10, color: "#bbb" }}>韓国語</div>
                      <div style={{ fontSize: 30, fontWeight: 900, color: "#e85d6b" }}>
                        {fc.deck[fc.idx].word}
                      </div>
                      <div style={{ fontSize: 10, color: "#ccc", marginTop: 2 }}>
                        タップして意味を確認
                      </div>
                    </div>
                  )}
                </div>
                {/* 正誤ボタン（裏返し後のみ表示） */}
                {fc.flipped ? (
                  <div style={{ display: "flex", gap: 10, width: "100%" }}>
                    <button style={c.fcWrongBtn}
                            onClick={() => handleFlashcardResult(false)}>❌ 不正解</button>
                    <button style={c.fcCorrectBtn}
                            onClick={() => handleFlashcardResult(true)}>✅ 正解！</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "#bbb" }}>
                    ✅ {fc.correct}　❌ {fc.wrong}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ オープニングアニメーション ══ */}
      {openingState !== "done" && (
        <div style={{
          ...c.openingOverlay,
          animation: openingState === "in"   ? "openingIn 0.6s ease-out forwards"
                   : openingState === "out"  ? "openingOut 0.7s ease-in forwards"
                   : "none",
          opacity:   openingState === "hold" ? 1 : undefined,
        }}>
          {/* 桜パーティクル */}
          {["10%","25%","40%","55%","70%","85%"].map((left, i) => (
            <div key={i} style={{ ...c.sakura, left, animationDelay: `${i * 0.3}s` }}>🌸</div>
          ))}
          <div style={c.openingCard}>
            <div style={{ fontSize: 44, lineHeight: 1, animation: "popIn 0.5s 0.3s both" }}>🇰🇷</div>
            <div style={c.openingTitle}>소나톡</div>
            <div style={c.openingSubtitle}>ハングル検定5級 会話練習</div>
            <div style={c.openingAvatarWrap}>
              <img src="/sona.png" alt="소나 선생님" style={c.openingAvatarImg} draggable={false}/>
            </div>
            <div style={c.openingName}>소나 선생님</div>
            <div style={c.openingMsg}>안녕하세요！ 오늘도 같이 공부해요～ 🌸</div>
            <div style={c.openingHint}>はじめましょう！</div>
          </div>
        </div>
      )}

      {/* ══ 実績トースト通知 ══ */}
      {newAchievement && (
        <div style={c.achievToast}>
          <div style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>{newAchievement.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#e85d6b", fontWeight: 700, marginBottom: 1 }}>
              🏆 実績解除！
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{newAchievement.name}</div>
            <div style={{ fontSize: 10, color: "#888" }}>{newAchievement.desc}</div>
          </div>
        </div>
      )}

      {/* ══ 実績モーダル ══ */}
      {showAchievModal && (
        <div style={c.overlay} onClick={() => setShowAchievModal(false)}>
          <div style={c.modal} onClick={e => e.stopPropagation()}>
            <div style={c.modalHeader}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>🏆 実績</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, opacity: 0.85 }}>
                  {unlockedAchievs.length} / {ACHIEVEMENTS.length} 解除
                </span>
                <button style={c.closeBtn} onClick={() => setShowAchievModal(false)}>✕</button>
              </div>
            </div>
            {/* 進捗バー */}
            <div style={{ padding: "8px 16px 0", background: "#fff0f2" }}>
              <div style={{ background: "#f0d9d9", borderRadius: 6, height: 8, overflow: "hidden" }}>
                <div style={{
                  background: "linear-gradient(90deg, #e85d6b, #ff8c98)",
                  height: "100%", borderRadius: 6,
                  width: `${(unlockedAchievs.length / ACHIEVEMENTS.length) * 100}%`,
                  transition: "width 0.5s ease",
                }}/>
              </div>
            </div>
            <div style={{ ...c.modalBody, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ACHIEVEMENTS.map(a => {
                const isUnlocked = unlockedAchievs.includes(a.id);
                return (
                  <div key={a.id} style={{ ...c.achievItem, ...(isUnlocked ? c.achievItemOn : {}) }}>
                    <div style={{ fontSize: 26, lineHeight: 1, filter: isUnlocked ? "none" : "grayscale(1)", opacity: isUnlocked ? 1 : 0.35 }}>
                      {isUnlocked ? a.emoji : "🔒"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isUnlocked ? "#333" : "#ccc" }}>
                        {a.name}
                      </div>
                      <div style={{ fontSize: 9, color: isUnlocked ? "#888" : "#ddd", marginTop: 1, lineHeight: 1.3 }}>
                        {a.desc}
                      </div>
                    </div>
                    {isUnlocked && <div style={c.achievCheck}>✓</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ プロフィールモーダル ══ */}
      {showProfileModal && (
        <div style={c.overlay} onClick={() => setShowProfileModal(false)}>
          <div style={{ ...c.modal, width: "min(92vw,360px)" }} onClick={e => e.stopPropagation()}>
            {/* ヘッダー：アバター大きく */}
            <div style={c.profileHeader}>
              <button style={c.profileCloseBtn} onClick={() => setShowProfileModal(false)}>✕</button>
              <div style={c.profileAvatarWrap}>
                <img src="/sona.png" alt="소나 선생님" style={c.profileAvatarImg} draggable={false}/>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginTop: 6 }}>소나 선생님</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>ソナ先生</div>
              <div style={c.profileTagRow}>
                <span style={c.profileTag}>🌸 26歳</span>
                <span style={c.profileTag}>📍 ソウル・弘大</span>
                <span style={c.profileTag}>💼 韓国語講師</span>
              </div>
            </div>

            {/* ボディ */}
            <div style={c.profileBody}>
              {/* 好きなこと */}
              <div style={c.profileCard}>
                <div style={c.profileCardTitle}>💕 好きなこと</div>
                {[
                  { e: "🎮", l: "ゲーム",     v: "ブルーアーカイブ（推しはアスナ）、原神" },
                  { e: "🎌", l: "アニメ",     v: "鬼滅の刃、呪術廻戦、進撃の巨人" },
                  { e: "⚾", l: "スポーツ",   v: "MLB観戦（大谷翔平の大ファン！）、Kリーグ、バスケ" },
                  { e: "🎵", l: "音楽",       v: "K-pop全般（BTS・BLACKPINK・NewJeans）" },
                  { e: "🍜", l: "食べ物",     v: "チーズタッカルビ、マラタン、抹茶スイーツ" },
                  { e: "✈️", l: "旅行",       v: "日本大好き！京都・大阪によく行きます" },
                ].map(({ e, l, v }) => (
                  <div key={l} style={c.profileLikeRow}>
                    <span style={{ fontSize: 16, flexShrink: 0, width: 22 }}>{e}</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#e85d6b" }}>{l}：</span>
                      <span style={{ fontSize: 11, color: "#444" }}>{v}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 口癖 */}
              <div style={{ ...c.profileCard, background: "#fff0f2" }}>
                <div style={c.profileCardTitle}>💬 口癖</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {["대박！（テバク！）", "진짜요？（チンチャヨ？）"].map(p => (
                    <span key={p} style={c.profileBubble}>{p}</span>
                  ))}
                </div>
              </div>

              {/* 一言 */}
              <div style={c.profileQuote}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>🌸</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.75 }}>
                  「韓国語は楽しく話すのが一番！<br/>一緒に上手になりましょう 😊」
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ アプリ説明モーダル ══ */}
      {showInfoModal && (
        <div style={c.overlay} onClick={() => setShowInfoModal(false)}>
          <div style={c.modal} onClick={e => e.stopPropagation()}>
            <div style={c.modalHeader}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>ℹ️ 소나톡 について</span>
              <button style={c.closeBtn} onClick={() => setShowInfoModal(false)}>✕</button>
            </div>
            <div style={{ overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh" }}>

              {/* このアプリは？ */}
              <div style={c.infoSection}>
                <div style={c.infoSectionTitle}>📱 このアプリは？</div>
                <p style={c.infoText}>
                  소나톡（ソナトク）は、AI技術を活用した韓国語会話練習アプリです。ハングル検定5級合格を目指す初心者向けに設計されています。
                </p>
              </div>

              {/* 使用技術 */}
              <div style={c.infoSection}>
                <div style={c.infoSectionTitle}>🛠 使用しているAI・技術</div>
                {[
                  ["会話AI",     "Google Gemini API"],
                  ["最新情報検索", "Tavily Search API"],
                  ["音声読み上げ", "Web Speech API（ブラウザ標準）"],
                  ["音声入力",   "Web Speech API（Chrome推奨）"],
                  ["ホスティング", "Vercel"],
                ].map(([k, v]) => (
                  <div key={k} style={c.infoRow}>
                    <span style={c.infoKey}>・{k}：</span>
                    <span style={c.infoVal}>{v}</span>
                  </div>
                ))}
              </div>

              {/* できること */}
              <div style={c.infoSection}>
                <div style={c.infoSectionTitle}>✅ できること</div>
                {[
                  "AIソナ先生との韓国語会話練習",
                  "テーマ別会話（ゲーム・アニメ・スポーツ等）",
                  "最新情報を元にした自然な会話",
                  "文法ミスの自動チェック・解説",
                  "単語メモ・まちがいノートの自動記録",
                  "音声入力・読み上げ対応",
                ].map(f => (
                  <div key={f} style={c.infoFeature}>✅ {f}</div>
                ))}
              </div>

              {/* 注意事項 */}
              <div style={c.infoWarnSection}>
                <div style={{ ...c.infoSectionTitle, color: "#92400e" }}>⚠️ 注意事項</div>
                {[
                  "本アプリはAIが生成する会話を使用しています",
                  "AIの回答は100%正確ではない場合があります",
                  "学習の参考としてご利用ください",
                  "入力した会話内容はAI処理のために送信されます",
                  "個人情報は入力しないようにご注意ください",
                ].map(n => (
                  <div key={n} style={{ ...c.infoRow, color: "#78350f" }}>・{n}</div>
                ))}
              </div>

              {/* フッター */}
              <div style={{ textAlign: "center", color: "#ccc", fontSize: 10, paddingBottom: 2 }}>
                v{CURRENT_VERSION} · 開発：usu-maker
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* ══ 単語タップ ポップアップ ══ */}
      {wordPopup && (() => {
        const POPUP_W = 220;
        const POPUP_H = 148;
        const left = Math.max(8, Math.min(wordPopup.x, window.innerWidth - POPUP_W - 8));
        const top  = wordPopup.y + POPUP_H > window.innerHeight - 8
          ? wordPopup.y - POPUP_H - 8
          : wordPopup.y + 8;
        const alreadyAdded = vocab.some(v => v.word === wordPopup.word);
        return (
          <div
            style={{
              position: 'fixed', left, top, zIndex: 3000,
              background: 'linear-gradient(140deg, #fff5f7 0%, #ffffff 100%)',
              border: '1.5px solid #f5c0c8',
              borderRadius: 16,
              boxShadow: '0 6px 28px rgba(232,93,107,.25), 0 2px 8px rgba(0,0,0,.08)',
              padding: '14px 14px 12px',
              width: POPUP_W,
              userSelect: 'none',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              style={{
                position: 'absolute', top: 8, right: 8,
                background: '#f5c0c8', border: 'none', color: '#e85d6b',
                borderRadius: '50%', width: 22, height: 22, fontSize: 11,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, lineHeight: 1,
              }}
              onClick={() => setWordPopup(null)}
            >✕</button>

            {/* 単語 */}
            <div style={{ fontSize: 22, fontWeight: 900, color: '#e85d6b', lineHeight: 1.2, marginBottom: 3, paddingRight: 24 }}>
              {wordPopup.word}
            </div>
            {/* 読み方 */}
            <div style={{ fontSize: 12, color: '#b08080', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, background: '#fce4e8', color: '#e85d6b', borderRadius: 6, padding: '1px 5px', fontWeight: 700 }}>読み</span>
              {wordPopup.needsTranslation ? <span style={{ color: '#ccc', fontStyle: 'italic' }}>読み込み中...</span> : (wordPopup.reading || '—')}
            </div>
            {/* 意味 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, background: '#f0e8ff', color: '#7b5ea7', borderRadius: 6, padding: '1px 5px', fontWeight: 700 }}>意味</span>
              {wordPopup.needsTranslation ? <span style={{ color: '#ccc', fontStyle: 'italic', fontWeight: 400 }}>翻訳を読み込み中...</span> : (wordPopup.meaning || '—')}
            </div>

            {/* 単語帳追加ボタン */}
            <button
              style={{
                width: '100%',
                background: wordPopup.needsTranslation
                  ? 'linear-gradient(90deg, #ddd, #eee)'
                  : alreadyAdded
                    ? 'linear-gradient(90deg, #c8e6c9, #a5d6a7)'
                    : 'linear-gradient(90deg, #e85d6b, #ff8c98)',
                color: wordPopup.needsTranslation ? '#aaa' : '#fff',
                border: 'none', borderRadius: 10,
                padding: '8px 0', fontSize: 12, fontWeight: 700,
                cursor: (alreadyAdded || wordPopup.needsTranslation) ? 'default' : 'pointer',
                boxShadow: (alreadyAdded || wordPopup.needsTranslation) ? 'none' : '0 2px 8px rgba(232,93,107,.3)',
                transition: 'all .2s',
                fontFamily: 'inherit',
              }}
              onClick={() => !alreadyAdded && !wordPopup.needsTranslation && addWordFromPopup(wordPopup)}
            >
              {wordPopup.needsTranslation ? '⏳ 読み込み中...' : alreadyAdded ? '✅ 単語帳に登録済み' : '＋ 単語帳に追加'}
            </button>
          </div>
        );
      })()}

      {/* ══ CSS アニメーション ══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+JP:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes bounce {
          0%,80%,100% { transform: translateY(0); }
          40%          { transform: translateY(-6px); }
        }
        @keyframes openingIn {
          0%   { opacity: 0; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes openingOut {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.96); }
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          70%  { transform: scale(1.15) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes slideUp {
          0%   { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes sakuraFall {
          0%   { transform: translateY(-30px) rotate(0deg);  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }
        @keyframes toastSlide {
          0%   { opacity: 0; transform: translateX(110%); }
          15%  { opacity: 1; transform: translateX(0); }
          80%  { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(110%); }
        }
        @keyframes achievPop {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1);   opacity: 1; }
        }

        /* ── スマホ向け追加スタイル ── */
        @media (max-width: 768px) {
          * { -webkit-tap-highlight-color: transparent; }
          button { touch-action: manipulation; }
          textarea { font-size: 16px !important; }  /* iOS ズーム防止 */
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
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0, position: "relative", zIndex: 100 },
  hLeft:      { display: "flex", alignItems: "center", gap: 10 },
  hRight:     { display: "flex", alignItems: "center", gap: 8 },
  hTitle:     { fontSize: 16, fontWeight: 700 },
  hSub:       { fontSize: 10, opacity: 0.85 },
  iconBtn:    { background: "rgba(255,255,255,.2)", border: "none", borderRadius: 18,
                padding: "3px 9px", fontSize: 15, cursor: "pointer", color: "#fff" },
  /* ヘッダーアバターボタン */
  headerAvatarBtn: {
    width: 38, height: 38, borderRadius: "50%", border: "2px solid rgba(255,255,255,.7)",
    overflow: "hidden", cursor: "pointer", padding: 0, background: "none", flexShrink: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,.2)", transition: "transform .15s",
  },
  headerAvatarImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" },
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
                color: "#888", fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap' },
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
  /* Streak chip (header) */
  streakChip:     { display: "flex", alignItems: "center", gap: 3,
                    borderRadius: 14, padding: "3px 9px", cursor: "default" },
  streakChipCold: { background: "rgba(255,255,255,.15)", color: "#fff" },
  streakChipWarm: { background: "rgba(255,200,100,.35)", color: "#fff" },
  streakChipHot:  { background: "rgba(255,120,60,.45)",  color: "#fff" },
  /* Sidebar tabs */
  sideTabs:    { display: "flex", gap: 4, marginBottom: 8, flexShrink: 0, width: "100%" },
  sideTabBtn:  { flex: 1, background: "#f5e9e9", border: "none", borderRadius: 8,
                 padding: "5px 0", fontSize: 11, cursor: "pointer",
                 color: "#bbb", fontWeight: 600, fontFamily: "inherit" },
  sideTabBtnOn:{ background: "#e85d6b", color: "#fff" },
  /* Streak big display */
  streakBig:   { display: "flex", flexDirection: "column", alignItems: "center",
                 gap: 3, padding: "10px 6px 8px", background: "#fff0f2",
                 borderRadius: 12, border: "1px solid #f0d9d9", marginBottom: 6, flexShrink: 0 },
  streakDoneTag:  { fontSize: 10, color: "#27ae60", fontWeight: 700,
                    background: "#eafaf1", borderRadius: 8, padding: "2px 8px", marginTop: 2 },
  streakTodoTag:  { fontSize: 10, color: "#e85d6b", fontWeight: 700,
                    background: "#fff0f2", borderRadius: 8, padding: "2px 8px", marginTop: 2 },
  /* Week calendar */
  weekRow:    { display: "flex", justifyContent: "space-between",
                padding: "6px 4px", background: "#fff", borderRadius: 10,
                border: "1px solid #f0d9d9", marginBottom: 8, flexShrink: 0 },
  weekDay:    { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flex: 1 },
  weekDayToday:{ background: "#fff0f2", borderRadius: 6 },
  /* History list item */
  histItem:   { background: "#fff", border: "1px solid #f0d9d9", borderRadius: 8,
                padding: "5px 7px", display: "flex", alignItems: "center", gap: 5 },
  histMsgCount:{ fontSize: 11, fontWeight: 700, color: "#e85d6b",
                 textAlign: "center", lineHeight: 1.1 },
  /* Sidebar */
  side:           { width: 195, borderLeft: "1px solid #f0d9d9", background: "#fffaf8",
                    padding: 10, overflow: "hidden", display: "flex", flexDirection: "column",
                    gap: 0, flexShrink: 0 },
  sideTitle:      { fontSize: 12, fontWeight: 700, color: "#e85d6b",
                    borderBottom: "1px solid #f0d9d9", paddingBottom: 4, marginBottom: 5, flexShrink: 0 },
  sideEmpty:      { fontSize: 11, color: "#ccc", lineHeight: 1.6, textAlign: "center", marginTop: 6 },
  /* 単語タブ全体ラッパー */
  vocabTabBody:   { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" },
  sideSectionWrap:{ flex: 1, display: "flex", flexDirection: "column", minHeight: 110,
                    overflow: "hidden" },
  sideSectionHdr: { display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderBottom: "1px solid #f0d9d9", paddingBottom: 4, marginBottom: 5, flexShrink: 0 },
  sideSectionList:{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
                    gap: 5, paddingRight: 2 },
  /* 記録タブスクロールラッパー */
  sideScrollBody: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
                    gap: 7, paddingTop: 2 },
  /* まちがいノート */
  mistakeItem:    { background: "#fff", border: "1px solid #f5dde0", borderRadius: 8,
                    padding: "6px 7px", flexShrink: 0 },
  copyBtn:        { background: "#fff", border: "1px solid #e85d6b", color: "#e85d6b",
                    borderRadius: 6, padding: "2px 7px", fontSize: 9, cursor: "pointer",
                    fontWeight: 700, fontFamily: "inherit", flexShrink: 0 },
  /* 単語フォーム */
  vocabForm:  { display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, marginBottom: 5 },
  vocabInput: { border: "1px solid #f0d9d9", borderRadius: 7, padding: "5px 7px",
                fontSize: 11, fontFamily: "inherit", outline: "none", background: "#fff", width: "100%" },
  vocabAddBtn:{ background: "#e85d6b", color: "#fff", border: "none", borderRadius: 7,
                padding: "5px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" },
  vocabItem:  { background: "#fff", border: "1px solid #f0d9d9", borderRadius: 8,
                padding: "5px 7px", display: "flex", alignItems: "flex-start", gap: 4, flexShrink: 0 },
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
  /* ── オープニングアニメーション ── */
  openingOverlay: {
    position: "fixed", inset: 0, zIndex: 2000,
    background: "linear-gradient(160deg, #ff7b8e 0%, #e85d6b 40%, #c94455 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  openingCard: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    animation: "slideUp 0.6s 0.2s both",
    textAlign: "center", padding: "0 20px",
  },
  openingTitle: {
    fontSize: 32, fontWeight: 900, color: "#fff",
    letterSpacing: 2, textShadow: "0 2px 12px rgba(0,0,0,.25)",
    animation: "slideUp 0.5s 0.4s both",
  },
  openingSubtitle: {
    fontSize: 13, color: "rgba(255,255,255,.85)", fontWeight: 600,
    animation: "slideUp 0.5s 0.55s both",
  },
  openingAvatarWrap: {
    width: 110, height: 110, borderRadius: "50%", overflow: "hidden",
    border: "4px solid rgba(255,255,255,.8)",
    boxShadow: "0 6px 28px rgba(0,0,0,.25)",
    animation: "popIn 0.6s 0.2s both",
    marginTop: 8,
  },
  openingAvatarImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" },
  openingName: {
    fontSize: 15, fontWeight: 700, color: "#fff",
    animation: "slideUp 0.5s 0.7s both",
  },
  openingMsg: {
    fontSize: 14, color: "rgba(255,255,255,.9)", lineHeight: 1.5,
    animation: "slideUp 0.5s 0.85s both",
  },
  openingHint: {
    fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 4,
    animation: "slideUp 0.5s 1.0s both",
  },
  sakura: {
    position: "absolute", top: -40, fontSize: 18,
    animation: "sakuraFall 3s linear infinite",
    pointerEvents: "none", userSelect: "none",
  },
  /* ── 実績トースト ── */
  achievToast: {
    position: "fixed", bottom: 80, right: 16, zIndex: 1500,
    background: "#fff", borderRadius: 14,
    boxShadow: "0 4px 24px rgba(232,93,107,.3)",
    border: "1.5px solid #fce4e8",
    padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
    maxWidth: 260, animation: "toastSlide 3.6s ease both",
  },
  /* ── 実績モーダルアイテム ── */
  achievItem: {
    background: "#fafafa", border: "1px solid #f0d9d9", borderRadius: 10,
    padding: "8px 10px", display: "flex", alignItems: "center", gap: 8,
    transition: "all .2s",
  },
  achievItemOn: {
    background: "#fff0f2", border: "1px solid #f5c6cc",
    boxShadow: "0 1px 6px rgba(232,93,107,.12)",
  },
  achievCheck: {
    color: "#27ae60", fontWeight: 700, fontSize: 13, flexShrink: 0,
  },
  /* ── 実績カウントバッジ（ヘッダー） ── */
  achievCountBadge: {
    position: "absolute", top: -4, right: -4,
    background: "#ffdd57", color: "#a0620a",
    borderRadius: 8, fontSize: 8, fontWeight: 700,
    padding: "1px 4px", lineHeight: 1.4,
    border: "1.5px solid #e85d6b",
    pointerEvents: "none",
  },

  /* ══ プロフィールモーダル ══ */
  profileHeader: {
    background: "linear-gradient(160deg, #ff7b8e 0%, #e85d6b 100%)",
    padding: "22px 16px 18px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    position: "relative", flexShrink: 0,
  },
  profileCloseBtn: {
    position: "absolute", top: 10, right: 10,
    background: "rgba(255,255,255,.2)", border: "none", color: "#fff",
    borderRadius: "50%", width: 28, height: 28, fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  profileAvatarWrap: {
    width: 86, height: 86, borderRadius: "50%", overflow: "hidden",
    border: "3px solid rgba(255,255,255,.8)",
    boxShadow: "0 4px 18px rgba(0,0,0,.25)", flexShrink: 0,
  },
  profileAvatarImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" },
  profileTagRow:  { display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", marginTop: 8 },
  profileTag:     { background: "rgba(255,255,255,.22)", color: "#fff", borderRadius: 20,
                    padding: "3px 10px", fontSize: 10, fontWeight: 600 },
  profileBody:    { overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column",
                    gap: 11, maxHeight: "55vh" },
  profileCard:    { background: "#fff", border: "1px solid #f0d9d9", borderRadius: 12, padding: "11px 13px" },
  profileCardTitle:{ fontSize: 11, fontWeight: 700, color: "#e85d6b", marginBottom: 8 },
  profileLikeRow: { display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7, lineHeight: 1.4 },
  profileBubble:  { background: "#e85d6b", color: "#fff", borderRadius: 20, padding: "4px 12px",
                    fontSize: 12, fontWeight: 700 },
  profileQuote:   { background: "linear-gradient(135deg,#fff0f2,#fff8f6)", borderRadius: 12,
                    padding: "14px 16px", border: "1px solid #f0d9d9",
                    textAlign: "center", lineHeight: 1 },

  /* ══ アプリ説明モーダル ══ */
  infoSection:      { background: "#fdf6f0", border: "1px solid #f0d9d9", borderRadius: 11, padding: "11px 13px" },
  infoWarnSection:  { background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 11, padding: "11px 13px" },
  infoSectionTitle: { fontSize: 12, fontWeight: 700, color: "#e85d6b", marginBottom: 8 },
  infoText:         { fontSize: 12, color: "#555", lineHeight: 1.7, margin: 0 },
  infoRow:          { display: "flex", flexWrap: "wrap", gap: 2, fontSize: 11, color: "#555",
                      lineHeight: 1.6, marginBottom: 2 },
  infoKey:          { fontWeight: 700, color: "#888", flexShrink: 0 },
  infoVal:          { color: "#444" },
  infoFeature:      { fontSize: 12, color: "#444", lineHeight: 1.7 },

  /* ④ 会話リセットボタン */
  resetBtn: {
    background: "rgba(232,93,107,.12)", border: "1px solid #f5c6cc",
    color: "#e85d6b", borderRadius: 16, padding: "3px 12px",
    fontSize: 11, cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
  },

  /* ③ 今日のミッション バナー */
  missionBanner: {
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "8px 12px", background: "#fff8f0",
    borderTop: "1px solid #fde8cc", borderBottom: "1px solid #fde8cc",
    flexShrink: 0,
  },
  missionBannerDone: {
    background: "#f0fff8", borderTop: "1px solid #b2f0d4",
    borderBottom: "1px solid #b2f0d4",
  },
  missionClose: {
    background: "none", border: "none", color: "#ccc",
    cursor: "pointer", fontSize: 13, padding: 0, flexShrink: 0,
    lineHeight: 1, marginTop: 1,
  },

  /* ① フラッシュカードモーダル */
  fcModal: {
    background: "#fff", borderRadius: 16, width: "min(92vw,380px)",
    maxHeight: "80vh", display: "flex", flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,.2)", overflow: "hidden",
  },
  fcCard: {
    width: "100%", minHeight: 140,
    background: "linear-gradient(135deg,#fff0f2,#fff8f6)",
    border: "2px solid #f0d9d9", borderRadius: 16,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", userSelect: "none", padding: "20px 16px",
    transition: "transform .1s",
  },
  fcCorrectBtn: {
    flex: 1, background: "#27ae60", color: "#fff", border: "none",
    borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
  fcWrongBtn: {
    flex: 1, background: "#e85d6b", color: "#fff", border: "none",
    borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
  fcRetryBtn: {
    background: "#e85d6b", color: "#fff", border: "none",
    borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },

  /* ① フラッシュカード起動ボタン（サイドバー） */
  fcStartBtn: {
    background: "#fff0f2", border: "1px solid #f5c6cc", color: "#e85d6b",
    borderRadius: 8, padding: "2px 7px", fontSize: 10, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
  },

  /* ② AI単語提案ボックス */
  sugBox: {
    background: "#fff8f0", border: "1px solid #fde8cc", borderRadius: 8,
    padding: "6px 8px", marginBottom: 5, flexShrink: 0,
  },
  sugTitle: {
    fontSize: 10, fontWeight: 700, color: "#f59e0b", marginBottom: 4,
  },
  sugItem: {
    display: "flex", alignItems: "center", gap: 4, marginBottom: 3,
  },
  sugAddBtn: {
    background: "#e85d6b", color: "#fff", border: "none", borderRadius: 6,
    padding: "1px 6px", fontSize: 12, cursor: "pointer", fontWeight: 700,
    flexShrink: 0, fontFamily: "inherit", lineHeight: 1.5,
  },

  /* ⑤ フレーズ集 */
  phraseCatTitle: {
    fontSize: 10, fontWeight: 700, color: "#e85d6b",
    borderBottom: "1px solid #f0d9d9", paddingBottom: 3, marginBottom: 4,
  },
  phraseItem: {
    display: "block", width: "100%", textAlign: "left",
    background: "#fff", border: "1px solid #f0d9d9", borderRadius: 8,
    padding: "5px 8px", marginBottom: 3, cursor: "pointer",
    fontFamily: "inherit", lineHeight: 1.4,
  },

  /* ══ スマホ対応スタイル ══ */

  /* アバターパネル: スマホは横並びコンパクト */
  avatarPanelMobile: {
    flexDirection: "row",
    padding: "8px 12px",
    gap: 10,
    alignItems: "center",
  },

  /* ハンバーガーボタン */
  hamburgerBtn: {
    background: "rgba(255,255,255,.2)", border: "none", color: "#fff",
    borderRadius: 8, padding: "5px 13px", fontSize: 22, cursor: "pointer",
    lineHeight: 1, fontFamily: "inherit",
  },

  /* ハンバーガードロップダウン */
  hamburgerMenu: {
    position: "absolute", top: "100%", left: 0, right: 0,
    background: "#d94e5c",
    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
    display: "flex", flexDirection: "column",
    zIndex: 500,
  },
  hamburgerItem: {
    background: "none", border: "none",
    borderBottom: "1px solid rgba(255,255,255,.15)",
    color: "#fff", padding: "14px 18px",
    fontSize: 14, cursor: "pointer",
    fontFamily: "inherit", textAlign: "left", width: "100%",
  },

  /* ボトムタブバー */
  mobileTabBar: {
    position: "fixed", bottom: 0, left: 0, right: 0, height: 56,
    background: "#fff", borderTop: "2px solid #f0d9d9",
    display: "flex", alignItems: "stretch",
    zIndex: 200, boxShadow: "0 -2px 12px rgba(0,0,0,.08)",
  },
  mobileTabBtn: {
    flex: 1, background: "none", border: "none",
    color: "#bbb", fontSize: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", display: "flex", alignItems: "center",
    justifyContent: "center", padding: "0 4px", transition: "all .15s",
  },
  mobileTabBtnOn: {
    color: "#e85d6b", background: "#fff0f2",
    borderTop: "2px solid #e85d6b",
  },

  /* モバイル サイドパネル（下から出るシート） */
  mobileSidePanel: {
    position: "fixed", bottom: 56, left: 0, right: 0,
    height: "65vh", background: "#fff",
    borderRadius: "18px 18px 0 0",
    boxShadow: "0 -6px 28px rgba(0,0,0,.18)",
    zIndex: 199, display: "flex", flexDirection: "column",
    overflow: "hidden",
  },
  mobilePanelHeader: {
    background: "#e85d6b", color: "#fff",
    padding: "13px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexShrink: 0,
  },
};
