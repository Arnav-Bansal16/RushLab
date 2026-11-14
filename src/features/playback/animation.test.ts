import { afterEach, expect, it, vi } from "vitest";
import { startPlaybackAnimation } from "./animation";

afterEach(() => vi.unstubAllGlobals());

it("does not skip frames across background time and releases its browser callbacks", () => {
  const document = new EventTarget() as EventTarget & { visibilityState: string };
  document.visibilityState = "visible";
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.stubGlobal("document", document);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  const tick = (time: number) => {
    const [id, callback] = [...callbacks][0];
    callbacks.delete(id);
    callback(time);
  };
  const advance = vi.fn();
  const remove = vi.spyOn(document, "removeEventListener");
  const stop = startPlaybackAnimation(advance);
  tick(1000);
  tick(1100);
  expect(advance.mock.calls).toEqual([[0.1]]);

  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  tick(50000);
  expect(advance).toHaveBeenCalledTimes(1);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  tick(90000);
  tick(90100);
  expect(advance.mock.calls).toEqual([[0.1], [0.1]]);

  // Browsers can suspend rAF entirely while hidden, with no hidden ticks.
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  tick(200000);
  expect(advance).toHaveBeenCalledTimes(2);
  stop();
  expect(callbacks.size).toBe(0);
  expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
});
