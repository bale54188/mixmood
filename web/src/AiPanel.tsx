import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { checkAi, parseMood } from "./ai";
import type { AiPreferences } from "./ai";

export function AiPanel({
  resetToken,
  active,
  onSuccess,
}: {
  resetToken: number;
  active: AiPreferences | null;
  onSuccess: (preferences: AiPreferences) => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<
    "checking" | "ready" | "unconfigured" | "unreachable"
  >("checking");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const inputId = useId();
  useEffect(() => {
    const controller = new AbortController();
    setStatus("checking");
    checkAi(controller.signal)
      .then((configured) => {
        if (!controller.signal.aborted)
          setStatus(configured ? "ready" : "unconfigured");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unreachable");
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    request.current?.abort();
    sequence.current++;
    setLoading(false);
    setError("");
    return () => {
      request.current?.abort();
      sequence.current++;
    };
  }, [resetToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || status !== "ready" || !text.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    const id = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const preferences = await parseMood(text.trim(), controller.signal);
      if (id === sequence.current && !controller.signal.aborted)
        onSuccess(preferences);
    } catch (error) {
      if (id === sequence.current && !controller.signal.aborted)
        setError(
          error instanceof Error && error.name !== "TimeoutError"
            ? error.message
            : "AI 请求超时，请重试。",
        );
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }
  return (
    <section className="ai-panel" aria-labelledby={`${inputId}-title`}>
      <div className="ai-panel-heading">
        <div>
          <span className="section-kicker">PUT YOUR MOOD INTO WORDS</span>
          <h2 id={`${inputId}-title`}>描述一下今晚的心情</h2>
        </div>
        <span className="ai-label">AI 口味理解</span>
      </div>
      <form onSubmit={submit} aria-busy={loading}>
        <label className="sr-only" htmlFor={inputId}>
          今晚的心情与口味
        </label>
        <textarea
          id={inputId}
          value={text}
          maxLength={600}
          rows={2}
          placeholder="想喝一杯酸甜清爽、制作简单的饮品……"
          onChange={(event) => setText(event.target.value)}
          disabled={loading}
        />
        <div className="ai-form-bottom">
          <p>
            只描述口味和心情，请勿填写个人信息；文字会发送至你配置的 AI 服务。
          </p>
          <button
            type="submit"
            className="ai-submit"
            disabled={status !== "ready" || loading || !text.trim()}
          >
            {loading ? "正在理解你的心情…" : "帮我找一杯"}
          </button>
        </div>
      </form>
      <div className="ai-status" role="status">
        {status === "checking" && "正在检查 AI 服务…"}
        {status === "unconfigured" &&
          "AI 尚未配置。心情选择和我的酒柜仍可正常使用。"}
        {status === "unreachable" &&
          "AI 服务未连接。请启动本地服务端；心情选择和我的酒柜仍可使用。"}
        {status === "ready" &&
          !loading &&
          !active &&
          "只理解偏好，用量与推荐由配方数据和 MoonBit 决定。"}
        {loading && "正在解析口味与难度，完成后由 MoonBit 结合酒柜计算推荐。"}
        {status !== "checking" && !loading && (
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            重新检查连接
          </button>
        )}
      </div>
      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}
      {active && (
        <p className="ai-success" data-testid="ai-preferences">
          已理解：{active.description}。推荐由 MoonBit
          计算；点击心情选项可切回。
        </p>
      )}
    </section>
  );
}
