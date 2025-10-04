// lib/api.ts
import { GenerationConfig, Problem, Evaluation, AssemblePayload } from "./types";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://web-production-a7c6c.up.railway.app";

export async function generateProblems(cfg: GenerationConfig): Promise<Problem[]> {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportPDF(cfg: GenerationConfig, kind: "questions" | "answers") {
  const res = await fetch(`${BASE}/api/export/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = kind === "questions" ? "worksheet_questions.pdf" : "worksheet_answers.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function uploadQuestions(file: File): Promise<Problem[]> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function assembleExam(payload: AssemblePayload): Promise<Problem[]> {
  const r = await fetch(`${BASE}/api/assemble`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function evaluateExam(problems: Problem[]): Promise<Evaluation> {
  const r = await fetch(`${BASE}/api/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(problems),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
