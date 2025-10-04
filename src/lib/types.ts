export type Operation = "+" | "-" | "×" | "÷";

export type GenerationConfig = {
  grade: number;
  operations: Operation[];
  count: number;
  mcq_count?: number;      // mới
  word_count?: number;     // mới
  min_value: number;
  max_value: number;
  include_word_problems: boolean;
  include_distractors: boolean;
  seed?: number;
  language: "vi" | "en";
};

export type Problem = {
  id: number;
  text: string;
  answer: string;
  distractors?: string[];
  kind: "arithmetic" | "word";
  difficulty?: number;
  source?: string | null;
};

export type Mode = "easy_to_hard" | "balanced" | "hard_to_easy";

export type AssemblePayload = {
  pool: Problem[];
  total_count: number;
  mcq_count: number;
  word_count: number;
  mode: Mode;
};

export type Evaluation = {
  avg_difficulty: number;
  buckets: Partial<Record<"easy" | "medium" | "hard", number>>;
  by_kind: Partial<Record<"arithmetic" | "word", number>>;
  by_op: Partial<Record<Operation, number>>;
  notes: string[];
};
