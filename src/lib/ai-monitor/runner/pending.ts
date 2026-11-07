// src/lib/ai-monitor/runner/pending.ts
//
// "This slot's answer is on its way." Pure, so the checkup runner (tested with
// fakes) can recognise it without importing anything server-only.
//
// ChatGPT and Gemini are answered through DataForSEO's LLM Scraper standard
// queue (./llm-scraper.ts): the first pass posts the task and the ask port
// throws this. The runner then leaves the slot unwritten and the checkup
// RUNNING; when the shared drain collects the task, a resume job runs the
// checkup again and the slot is answered from the stored result.

export class AnswerPending extends Error {
  readonly slotKey: string;
  readonly taskId: string;

  constructor(slotKey: string, taskId: string) {
    super(`answer pending: ${slotKey} (task ${taskId})`);
    this.name = "AnswerPending";
    this.slotKey = slotKey;
    this.taskId = taskId;
  }
}

export function isAnswerPending(err: unknown): err is AnswerPending {
  return err instanceof AnswerPending || (err instanceof Error && err.name === "AnswerPending");
}
