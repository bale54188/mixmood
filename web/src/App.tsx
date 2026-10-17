import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Cocktail } from "./Cocktail";
import { getRecommendations, ingredients } from "./engine";

const moods = [
  {
    id: "fresh",
    name: "清爽放松",
    note: "给自己放个小假",
    tags: ["fresh", "citrus"],
    icon: "leaf",
  },
  {
    id: "sweet",
    name: "甜蜜果香",
    note: "今天想要一点甜",
    tags: ["sweet", "fruity"],
    icon: "heart",
  },
  {
    id: "bitter",
    name: "成熟微苦",
    note: "慢慢品，刚刚好",
    tags: ["bitter"],
    icon: "moon",
  },
  {
    id: "tropical",
    name: "热带度假",
    note: "一秒切换海岛模式",
    tags: ["tropical", "fruity"],
    icon: "sun",
  },
  {
    id: "party",
    name: "派对狂欢",
    note: "快乐，现在开场",
    tags: ["bubbly", "sweet"],
    icon: "spark",
  },
  {
    id: "new",
    name: "来点新鲜的",
    note: "让灵感自由发挥",
    tags: [],
    icon: "shuffle",
  },
];
const tagNames: Record<string, string> = {
  fresh: "清新",
  citrus: "柑橘",
  bubbly: "气泡",
  sweet: "甜润",
  fruity: "果香",
  tropical: "热带",
  bitter: "微苦",
};

function Icon({ kind, className = "" }: { kind: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    leaf: (
      <>
        <path d="M19 4C8 3 3 10 6 16s14 4 13-12Z" />
        <path d="M4 21 15 10M8 16v-5m4 2h5" />
      </>
    ),
    heart: <path d="M12 20 4 12C-2 5 7 0 12 7c5-7 14-2 8 5Z" />,
    moon: (
      <>
        <path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z" />
        <path d="M18 3v5m-2.5-2.5h5" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
        <path d="M21 1v4m-2-2h4" />
      </>
    ),
    shuffle: (
      <>
        <path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4" />
      </>
    ),
    glass: (
      <>
        <path d="m3 4 9 11 9-11ZM12 15v7m-5 0h10M6 8h12" />
      </>
    ),
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    github: (
      <>
        <path d="M9 20c-5 1-5-3-7-3m14 6v-4c0-1-.4-2-1-2 4-.5 7-2 7-7 0-2-.6-3-2-4 0-1 0-3-1-4-2 0-4 2-4 2a14 14 0 0 0-7 0S6 2 4 2c-1 1-1 3-1 4-1 1-2 2-2 4 0 5 3 6.5 7 7-.6 0-1 1-1 2v4" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind] ?? paths.spark}
    </svg>
  );
}

export default function App() {
  const [moodId, setMoodId] = useState("fresh");
  const [owned, setOwned] = useState(["rum", "lime", "soda"]);
  const [showIngredients, setShowIngredients] = useState(false);
  const demoRef = useRef<HTMLElement>(null);
  const mood = moods.find((item) => item.id === moodId)!;
  const result = useMemo(() => {
    try {
      return {
        recommendations: getRecommendations(owned, mood.tags),
        error: "",
      };
    } catch (error) {
      return {
        recommendations: [],
        error: error instanceof Error ? error.message : "推荐暂时不可用",
      };
    }
  }, [owned, mood]);

  function openIngredients() {
    setShowIngredients(true);
    demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="MixMood 首页">
          <span className="brand-mark">
            <Icon kind="glass" />
          </span>
          <span>
            Mix<span className="brand-light">Mood</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="主导航">
          <a href="#moods" className="nav-active">
            心情特调
          </a>
          <button onClick={openIngredients}>我的材料</button>
        </nav>
        <a
          className="source-link"
          href="https://github.com/bale54188/mixmood"
          target="_blank"
          rel="noreferrer"
        >
          <Icon kind="github" />
          <span>开源共创</span>
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main>
        <section className="hero" id="moods" aria-labelledby="hero-title">
          <div className="hero-content">
            <div className="eyebrow">
              <span /> A LITTLE MOOD. A LITTLE MAGIC.
            </div>
            <h1 id="hero-title">
              今晚是什么心情<span>？</span>
            </h1>
            <p className="hero-subtitle">
              把心情交给我们，
              <br className="mobile-break" />
              把今晚留给你喜欢的一杯。
            </p>
            <div className="mood-grid" aria-label="选择今晚的心情">
              {moods.map((item) => (
                <button
                  key={item.id}
                  className={`mood-button ${item.id === moodId ? "selected" : ""}`}
                  aria-pressed={item.id === moodId}
                  onClick={() => setMoodId(item.id)}
                >
                  <span className={`mood-icon ${item.id}`}>
                    <Icon kind={item.icon} />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.note}</small>
                  </span>
                  <span className="mood-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button className="inventory-entry" onClick={openIngredients}>
              <Icon kind="glass" />
              <span>看看我的材料能调什么</span>
              <Icon kind="arrow" />
            </button>
          </div>
          <div className="hero-visual">
            <div className="visual-grain" />
            <div className="visual-top">
              <span>THE MOOD COLLECTION</span>
              <span>01 / 03</span>
            </div>
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="floating-note note-top">
              a sip of
              <br />
              <em>something good.</em>
            </span>
            <Cocktail hero />
            <div className="floating-label">
              <span className="label-dot" />
              今晚，轻盈一点。<span>✧</span>
            </div>
            <div className="visual-bottom">
              <span>
                Your mood.
                <br />
                <em>Your cocktail.</em>
              </span>
              <span className="visual-star" aria-hidden="true">
                ✳
              </span>
            </div>
          </div>
        </section>

        <section
          className="recommendation-section"
          ref={demoRef}
          id="recommendations"
          aria-labelledby="recommendation-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">A SIP THAT FEELS LIKE YOU</span>
              <h2 id="recommendation-title">
                为你的心情，调一杯<span>✧</span>
              </h2>
              <p>此刻的灵感：{mood.name}。从这些小小的可能开始。</p>
            </div>
            <span className="example-badge">M1 技术演示 · 3 款示例</span>
          </div>
          <div className="inventory-bar">
            <span>
              <span className="tiny-dot" />
              已选 {owned.length} 种材料
            </span>
            <button
              aria-expanded={showIngredients}
              aria-controls="ingredient-picker"
              onClick={() => setShowIngredients((value) => !value)}
            >
              {showIngredients ? "收起材料" : "调整我的材料"}{" "}
              <span aria-hidden="true">{showIngredients ? "−" : "+"}</span>
            </button>
          </div>
          {showIngredients && (
            <fieldset id="ingredient-picker" className="ingredient-picker">
              <legend>选择你手边的材料</legend>
              <p>
                勾选后即时更新推荐；当前仅检查材料是否拥有，不检查剩余用量。
              </p>
              <div>
                {ingredients.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={owned.includes(item.id)}
                      onChange={() =>
                        setOwned((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                    />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {result.error ? (
            <p role="alert" className="error-message">
              推荐引擎调用失败：{result.error}
            </p>
          ) : (
            <div
              className="recipe-grid"
              data-testid="recommendations"
              aria-live="polite"
              aria-atomic="true"
            >
              {result.recommendations.map((item, index) => (
                <article
                  className="recipe-card"
                  key={item.recipe.id}
                  data-recipe-id={item.recipe.id}
                >
                  <div className={`recipe-image ${item.recipe.id}`}>
                    <span className="recipe-number">0{index + 1}</span>
                    <span className="recipe-example">示例灵感</span>
                    <Cocktail
                      variant={
                        item.recipe.id === "sunset-punch"
                          ? "sunset"
                          : item.recipe.id === "amber-hour"
                            ? "amber"
                            : "mint"
                      }
                    />
                    <span className="image-caption">
                      MIXED WITH A LITTLE MOOD
                    </span>
                  </div>
                  <div className="recipe-body">
                    <div className="recipe-title-row">
                      <h3>{item.recipe.name}</h3>
                      <span
                        className={`availability ${item.can_make ? "ready" : ""}`}
                      >
                        {item.can_make
                          ? "材料已齐"
                          : `还差 ${item.missing.length} 种`}
                      </span>
                    </div>
                    <p className="recipe-description">
                      {item.recipe.description}
                    </p>
                    <div className="recipe-tags">
                      {item.recipe.tags.map((tag) => (
                        <span
                          key={tag}
                          className={
                            item.matched_tags.includes(tag) ? "matched" : ""
                          }
                        >
                          {tagNames[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                    <div className="missing-line">
                      {item.can_make
                        ? "所需材料均已选中"
                        : `还需要：${item.missing.map((ingredient) => ingredient.name).join("、")}`}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="fixture-note">
            示例配方仅用于验证技术链路，未经真实配方核对，不作为调制指导。
          </p>
        </section>
        <aside className="closing-note">
          <span aria-hidden="true">✧</span>
          <p>
            不必等到特别的日子。
            <br />
            <strong>今晚的你，就值得一杯特别的。</strong>
          </p>
          <span aria-hidden="true">✧</span>
        </aside>
      </main>
      <footer>
        <div className="footer-brand">
          MixMood<span>.</span>
          <small>Your mood. Your cocktail.</small>
        </div>
        <span>
          Made with MoonBit <span className="footer-heart">♡</span> 为每一种心情
        </span>
        <a
          href="https://github.com/bale54188/mixmood"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </footer>
    </div>
  );
}
