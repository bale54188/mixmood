import { useEffect, useId, useRef } from "react";
import type { Recommendation } from "./engine";

export function RecipeDialog({
  item,
  onDismiss,
}: {
  item: Recommendation;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (dialog.open) dialog.close();
    };
  }, []);
  const recipe = item.recipe;
  return (
    <dialog
      ref={ref}
      className="recipe-dialog"
      aria-labelledby={title}
      onClose={(event) => {
        if (!event.currentTarget.open) onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) ref.current?.close();
      }}
    >
      <div className="dialog-content">
        <button
          className="dialog-close"
          aria-label="关闭配方"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
        <span className="section-kicker">THE CLASSIC COLLECTION</span>
        <h2 id={title}>{recipe.name}</h2>
        <p className="recipe-english">{recipe.name_en}</p>
        <div className="detail-meta">
          <span>{recipe.difficulty}</span>
          <span>约 {recipe.minutes} 分钟</span>
          <span>1 杯份</span>
        </div>
        <p className="detail-notice">
          {recipe.estimate_note}{" "}
          材料匹配不判断数量，也不检查工具或装饰是否齐备。
        </p>
        <h3>材料与用量</h3>
        <ul className="quantity-list">
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id}>
              <div>
                <strong>{ingredient.name}</strong>
                {ingredient.optional && (
                  <span className="optional-label">可选</span>
                )}
                <b>
                  {ingredient.amount === null
                    ? ingredient.unit
                    : `${ingredient.amount} ${ingredient.unit}`}
                </b>
              </div>
              {ingredient.amount_note && (
                <small>{ingredient.amount_note}</small>
              )}
            </li>
          ))}
        </ul>
        <h3>制作步骤</h3>
        <ol className="recipe-steps">
          {recipe.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        <h3>装饰</h3>
        <p className="detail-text">{recipe.garnish}</p>
        <div className="recipe-source">
          <strong>配方参考</strong>
          <a href={recipe.source.url} target="_blank" rel="noreferrer">
            {recipe.source.publisher} · {recipe.name_en} ↗
          </a>
          <span>核对日期：{recipe.source.checked_on}</span>
          {recipe.source.notes && <p>{recipe.source.notes}</p>}
          {recipe.source.supplement && (
            <a href={recipe.source.supplement} target="_blank" rel="noreferrer">
              补充操作参考（Smirnoff）↗
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}
