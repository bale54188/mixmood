import { useState } from "react";
import { ingredients } from "./engine";
import type { Inventory, InventoryState } from "./engine";

interface Props {
  owned: string[];
  state: InventoryState;
  warning: string;
  unknown: string[];
  onChange: (inventory: Inventory) => void;
}
export function Cabinet({ owned, state, warning, unknown, onChange }: Props) {
  const [query, setQuery] = useState("");
  // UI search only. MoonBit canonicalizes aliases for recipe matching.
  const key = query.trim().toLowerCase();
  const found = ingredients.filter((item) =>
    [item.name, item.name_en, ...item.aliases].some((value) =>
      value.toLowerCase().includes(key),
    ),
  );
  function toggle(id: string) {
    onChange({
      status: "set",
      owned: owned.includes(id)
        ? owned.filter((value) => value !== id)
        : [...owned, id],
    });
  }
  return (
    <fieldset className="ingredient-picker cabinet" id="ingredient-picker">
      <legend>我的酒柜</legend>
      <p className="cabinet-intro">
        只勾选你确实拥有的材料。按配方核对必需配料（含已列明的冰）；仅判断有无，不检查剩余数量，装饰不参与匹配。
      </p>
      {warning && (
        <p className="storage-warning" role="status">
          {warning}
        </p>
      )}
      {unknown.length > 0 && (
        <p className="storage-warning" role="status">
          未识别的记录未参与匹配：{unknown.join("、")}。请重新选择对应材料。
        </p>
      )}
      <div className="owned-materials" aria-label="已拥有的材料">
        <strong>已拥有 · {owned.length}</strong>
        {owned.length === 0 ? (
          <span>
            {state === "unset"
              ? "还没有录入，不代表你没有材料。"
              : state === "empty"
                ? "你已确认酒柜为空。"
                : "没有可用于匹配的已识别材料，请重新选择。"}
          </span>
        ) : (
          owned.map((id) => {
            const ingredient = ingredients.find((item) => item.id === id)!;
            return (
              <button
                type="button"
                key={id}
                onClick={() => toggle(id)}
                aria-label={`删除${ingredient.name}`}
              >
                {ingredient.name}
                <span aria-hidden="true">×</span>
              </button>
            );
          })
        )}
      </div>
      <label className="material-search">
        搜索材料
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="试试青柠、lime、金酒…"
        />
      </label>
      <div className="material-options">
        {found.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              aria-label={item.name}
              checked={owned.includes(item.id)}
              onChange={() => toggle(item.id)}
            />
            <span>
              {item.name}
              <small>{item.name_en}</small>
            </span>
          </label>
        ))}
      </div>
      {found.length === 0 && (
        <p>没有找到该材料。试试中文名或英文名；没有列出的材料暂不参与推荐。</p>
      )}
      <div className="cabinet-actions">
        {owned.length === 0 && state === "unset" && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => onChange({ status: "set", owned: [] })}
          >
            我已确认没有材料
          </button>
        )}
        <button
          type="button"
          className="text-button"
          onClick={() => onChange({ status: "unset", owned: [] })}
        >
          重置为未录入
        </button>
        <span>更改自动保存在当前浏览器</span>
      </div>
    </fieldset>
  );
}
