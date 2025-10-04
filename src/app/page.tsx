"use client";

import { useState, type ReactNode } from "react";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  Loader2, Sparkles, BookOpen, UploadCloud, Settings2, Puzzle,
  BarChart3, ListChecks, BrainCircuit, Download, Target, TrendingUp,
  Star, Award, Play,
} from "lucide-react";

import {
  generateProblems,
  exportPDF,
  uploadQuestions,
  assembleExam,
  evaluateExam,
} from "@/lib/api";

import type {
  GenerationConfig,
  Problem,
  Operation,
  Evaluation,
  Mode,
} from "@/lib/types";


const schema = z.object({
  grade: z.coerce.number().min(1).max(5),
  operations: z.array(z.enum(["+", "-", "×", "÷"])).min(1),
  count: z.coerce.number().min(5).max(200),
  min_value: z.coerce.number().min(0),
  max_value: z.coerce.number().min(1),
  include_word_problems: z.coerce.boolean(),
  include_distractors: z.coerce.boolean(),
  seed: z.coerce.number().optional(),
  language: z.enum(["vi", "en"]),
  mcq_count: z.coerce.number().min(0).optional(),
  word_count: z.coerce.number().min(0).optional(),
})
.refine(v => (v.word_count ?? 0) <= v.count, {
  path: ["word_count"],
  message: "Số câu lời văn phải ≤ Tổng số câu",
})
.refine(v => (v.mcq_count ?? 0) <= v.count - (v.word_count ?? 0), {
  path: ["mcq_count"],
  message: "Số câu trắc nghiệm phải ≤ Tổng số câu trừ lời văn",
});

type FormValues = z.infer<typeof schema>;

export default function Home() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pool, setPool] = useState<Problem[]>([]);
  const [poolEval, setPoolEval] = useState<Evaluation | null>(null);
  const [examEval, setExamEval] = useState<Evaluation | null>(null);
  const [tot, setTot] = useState(20);
  const [mcq, setMcq] = useState(10);
  const [word, setWord] = useState(0);
  const [mode, setMode] = useState<Mode>("easy_to_hard");


  type FormValues = z.infer<typeof schema>;
  const resolver = zodResolver(schema) as unknown as Resolver<FormValues>; 

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver,           
    defaultValues: {
      grade: 2,
      operations: ["+", "-"],
      count: 20,
      min_value: 0,
      max_value: 100,
      include_word_problems: false,
      include_distractors: true,
      seed: 42,
      language: "vi",
      mcq_count: 10,
      word_count: 0,
    },
  });


  const selectedOps = watch("operations");
  const cfg = watch();

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      setLoading(true);
      const data = await generateProblems(values as unknown as GenerationConfig);
      setProblems(data);
      setExamEval(await evaluateExam(data));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const diffBadge = (v?: number) => {
    if (v == null) return null;
    let label: "Easy" | "Medium" | "Hard" = "Easy";
    let gradient = "from-emerald-400 to-emerald-600";
    let glow = "shadow-emerald-200";
    if (v >= 0.67) {
      label = "Hard";
      gradient = "from-red-400 to-rose-600";
      glow = "shadow-rose-200";
    } else if (v >= 0.34) {
      label = "Medium";
      gradient = "from-amber-400 to-orange-600";
      glow = "shadow-amber-200";
    }
    return (
      <motion.span 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r ${gradient} text-white shadow-lg ${glow} backdrop-blur-sm`}
      >
        <Star className="size-3" />
        {label} • {v.toFixed(2)}
      </motion.span>
    );
  };

  const statCard = (icon: ReactNode, label: string, value: string, gradient: string) => (
    <motion.div 
      whileHover={{ scale: 1.02, y: -2 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-xl`}
    >
      <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
      <div className="relative z-10 flex items-center gap-3">
        <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium opacity-90">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
      <div className="absolute -bottom-2 -right-2 opacity-10">
        {icon}
      </div>
    </motion.div>
  );

  const statPill = (icon: ReactNode, label: string, value: string) => (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-sm">
      {icon}
      <span className="font-medium">{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );

  const copyQuestion = async (p: Problem) => {
    try {
      await navigator.clipboard.writeText(`${p.id}. ${p.text}`);
    } catch {}
  };

  const totalBuckets = (examEval?.buckets?.easy ?? 0) + (examEval?.buckets?.medium ?? 0) + (examEval?.buckets?.hard ?? 0);
  const pct = (n: number) => totalBuckets === 0 ? 0 : Math.round((n / totalBuckets) * 100);

  const [downloading, setDownloading] = useState<"none" | "questions" | "answers">("none");

  async function handleExport(kind: "questions" | "answers") {
    if (downloading !== "none") return;            // chặn bấm liên tiếp
    setDownloading(kind);
    try {
      await exportPDF(cfg as unknown as GenerationConfig, kind);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setDownloading("none");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -100, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -150, 0], y: [0, 100, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-3/4 right-1/3 w-96 h-96 bg-gradient-to-r from-pink-400/20 to-orange-400/20 rounded-full blur-3xl"
        />
      </div>

      {/* HERO Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>
        <div className="relative container mx-auto max-w-7xl px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-1 shadow-2xl"
            >
              <div className="rounded-full bg-white p-3">
                <Sparkles className="size-6 text-blue-600" />
              </div>
              <span className="pr-4 text-white font-semibold">AI Math Worksheet Generator</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 bg-clip-text text-transparent leading-tight">
              Tạo Bài Tập Toán
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Tiện Ích và Nhanh Chóng
              </span>
            </h1>
            
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Sinh tự động bài tập Toán tiểu học với AI, hỗ trợ upload ngân hàng câu hỏi, 
              ráp đề theo độ khó và xuất PDF chuyên nghiệp.
            </p>

            {/* Hero stats */}
            {problems.length > 0 && examEval && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap justify-center gap-4 mt-8"
              >
                {statCard(<BookOpen className="size-6" />, "Câu hỏi", String(problems.length), "from-blue-500 to-cyan-500")}
                {statCard(<Target className="size-6" />, "Độ khó TB", examEval.avg_difficulty.toFixed(2), "from-purple-500 to-pink-500")}
                {statCard(<Award className="size-6" />, "Phân bố", `${examEval.buckets?.easy ?? 0}/${examEval.buckets?.medium ?? 0}/${examEval.buckets?.hard ?? 0}`, "from-orange-500 to-red-500")}
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* MAIN Content */}
      <section className="relative">
        <div className="container mx-auto max-w-7xl px-6 grid xl:grid-cols-5 gap-8 -mt-10">
          
          {/* Left Sidebar - Controls */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Generation Config */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
                    <Settings2 className="size-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Cấu hình thông minh</h3>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Khối lớp</span>
                      <select className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-blue-400 transition-all" {...register("grade")}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>Lớp {n}</option>
                        ))}
                      </select>
                    </motion.label>

                    <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Ngôn ngữ</span>
                      <select className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-blue-400 transition-all" {...register("language")}>
                        <option value="vi">🇻🇳 Tiếng Việt</option>
                        <option value="en">🇺🇸 English</option>
                      </select>
                    </motion.label>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Tổng câu</span>
                      <input
                        type="number"
                        min={5}
                        max={200}
                        className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-purple-400 transition-all"
                        {...register("count", { valueAsNumber: true })}
                      />
                    </motion.label>
                    
                    <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Trắc nghiệm</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-green-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-green-400 transition-all"
                        {...register("mcq_count", { valueAsNumber: true })}
                      />
                    </motion.label>

                    <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Tự luận</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-pink-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-pink-400 transition-all"
                        {...register("word_count", { valueAsNumber: true })}
                      />
                    </motion.label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Giá trị nhỏ nhất</span>
                      <input 
                        type="number" 
                        className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-cyan-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-cyan-400 transition-all" 
                        {...register("min_value", { valueAsNumber: true })} 
                      />
                    </motion.label>
                    <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Giá trị lớn nhất</span>
                      <input 
                        type="number" 
                        className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-cyan-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-cyan-400 transition-all" 
                        {...register("max_value", { valueAsNumber: true })} 
                      />
                    </motion.label>
                  </div>

                  {/* Operations */}
                  <div className="space-y-3">
                    <span className="text-sm font-semibold text-slate-700">Phép toán</span>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                      {["+", "-", "×", "÷"].map((op) => {
                        const isSelected = selectedOps.includes(op as Operation);
                        return (
                          <motion.button
                            key={op}
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              const next = isSelected
                                ? selectedOps.filter((x) => x !== (op as Operation))
                                : [...selectedOps, op as Operation];
                              setValue("operations", next, { shouldValidate: true });
                            }}
                            className={`relative overflow-hidden rounded-2xl mt-5 px-7 md:px-8 py-3.5 text-xl font-bold tracking-wide text-center transition-all duration-300 ${
                              isSelected 
                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-xl shadow-blue-200 border-0" 
                                : "bg-white/60 backdrop-blur-sm border border-slate-200 text-slate-700 hover:bg-white/80 shadow-lg"
                            }`}
                          >
                            <span className="relative z-10">{op}</span>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-2xl"
                              />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-4">
                    <motion.label 
                      whileHover={{ scale: 1.01 }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 cursor-pointer group"
                    >
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-lg border-2 border-emerald-300 text-emerald-600 focus:ring-emerald-400 transition-all" 
                        {...register("include_word_problems")} 
                      />
                      <span className="font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">Bài toán có lời văn (AI)</span>
                    </motion.label>

                    <motion.label 
                      whileHover={{ scale: 1.01 }}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 cursor-pointer group"
                    >
                      <input 
                        type="checkbox" 
                        defaultChecked 
                        className="w-5 h-5 rounded-lg border-2 border-purple-300 text-purple-600 focus:ring-purple-400 transition-all" 
                        {...register("include_distractors")} 
                      />
                      <span className="font-medium text-slate-700 group-hover:text-purple-700 transition-colors">Sinh lựa chọn nhiễu (MCQ)</span>
                    </motion.label>
                  </div>

                  <motion.label whileHover={{ scale: 1.02 }} className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">Seed (tùy chọn)</span>
                    <input 
                      type="number" 
                      placeholder="42" 
                      className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-indigo-50 px-4 py-3 shadow-inner focus:ring-2 focus:ring-indigo-400 transition-all" 
                      {...register("seed", { valueAsNumber: true })} 
                    />
                  </motion.label>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -12px rgba(59, 130, 246, 0.5)" }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 min-w-0 relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white font-bold shadow-xl transition-all duration-300 group"
                      type="submit" 
                      disabled={loading}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-purple-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                      <span className="relative flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <Loader2 className="size-5 animate-spin" />
                            Đang sinh...
                          </>
                        ) : (
                          <>
                            <Play className="size-5" />
                            Generate
                          </>
                        )}
                      </span>
                    </motion.button>
                    
                    <motion.button
                      whileHover={downloading === "none" ? { scale: 1.05 } : {}}
                      whileTap={downloading === "none" ? { scale: 0.95 } : {}}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-4 text-white shadow-xl hover:shadow-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                      disabled={downloading !== "none"}
                      aria-disabled={downloading !== "none"}
                      aria-busy={downloading === "questions"}
                      onClick={() => handleExport("questions")}
                    >
                      {downloading === "questions"
                        ? <Loader2 className="size-5 animate-spin" />
                        : <Download className="size-5" />}
                      {downloading === "questions" ? "Đang xuất..." : "Câu hỏi"}
                    </motion.button>

                    {/* Nút: Đáp án */}
                    <motion.button
                      whileHover={downloading === "none" ? { scale: 1.05 } : {}}
                      whileTap={downloading === "none" ? { scale: 0.95 } : {}}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 px-4 py-4 text-white shadow-xl hover:shadow-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                      disabled={downloading !== "none"}
                      aria-disabled={downloading !== "none"}
                      aria-busy={downloading === "answers"}
                      onClick={() => handleExport("answers")}
                    >
                      {downloading === "answers"
                        ? <Loader2 className="size-5 animate-spin" />
                        : <Download className="size-5" />}
                      {downloading === "answers" ? "Đang xuất..." : "Đáp án"}
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>

            {/* Upload Section */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative mb-5 backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-lg">
                    <UploadCloud className="size-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Ngân hàng GV</h3>
                </div>

                {/* Upload area */}
                <motion.label whileHover={{ scale: 1.01, y: -2 }} className="block cursor-pointer group/upload">
                  <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-8 text-center transition-all group-hover/upload:border-blue-400 group-hover/upload:from-blue-50 group-hover/upload:to-purple-50">
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-3">
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
                        <UploadCloud className="size-8 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">Tải lên ngân hàng câu hỏi</div>
                        <div className="text-sm text-slate-500">Hỗ trợ .txt, .csv, .pdf, .docx</div>
                      </div>
                    </motion.div>
                    <input
                      className="hidden"
                      type="file"
                      accept=".txt,.csv,.pdf,.doc,.docx,.xlsx,.xls"
                      onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          setLoading(true);
                          const _pool = await uploadQuestions(f);
                          setPool(_pool);
                          const eva = await evaluateExam(_pool);
                          setPoolEval(eva);
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : String(err);
                          alert(msg);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    />
                  </div>
                </motion.label>

                {/* Stats pool */}
                {poolEval && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {statPill(<BookOpen className="size-4" />, "Số câu", String(pool.length))}
                    {statPill(<BarChart3 className="size-4" />, "Độ khó TB", poolEval.avg_difficulty.toFixed(2))}
                  </div>
                )}

                {/* Assemble controls */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <label className="col-span-1">
                    <span className="text-sm font-medium text-slate-700">Tổng số câu</span>
                    <input 
                      className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-blue-50 px-3 py-2 shadow-inner focus:ring-2 focus:ring-blue-400 transition-all" 
                      type="number" 
                      value={tot} 
                      onChange={(e) => setTot(Number(e.target.value))} 
                    />
                  </label>
                  <label className="col-span-1">
                    <span className="text-sm font-medium text-slate-700">Trắc nghiệm</span>
                    <input 
                      className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-green-50 px-3 py-2 shadow-inner focus:ring-2 focus:ring-green-400 transition-all" 
                      type="number" 
                      value={mcq} 
                      onChange={(e) => setMcq(Number(e.target.value))} 
                    />
                  </label>
                  <label className="col-span-1">
                    <span className="text-sm font-medium text-slate-700">Tự luận</span>
                    <input 
                      className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-pink-50 px-3 py-2 shadow-inner focus:ring-2 focus:ring-pink-400 transition-all" 
                      type="number" 
                      value={word} 
                      onChange={(e) => setWord(Number(e.target.value))} 
                    />
                  </label>
                  <label className="col-span-1">
                    <span className="text-sm font-medium text-slate-700">Độ khó</span>
                    <select 
                      className="w-full rounded-xl border-0 bg-gradient-to-r from-slate-50 to-indigo-50 px-3 py-2 shadow-inner focus:ring-2 focus:ring-indigo-400 transition-all" 
                      value={mode} 
                      onChange={(e) => setMode(e.target.value as Mode)}
                    >
                      <option value="easy_to_hard">Dễ → Khó</option>
                      <option value="balanced">Cân bằng</option>
                      <option value="hard_to_easy">Khó → Dễ</option>
                    </select>
                  </label>
                </div>

                <div className="mt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white font-medium shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2"
                    type="button"
                    onClick={async () => {
                      if (pool.length === 0) return alert("Hãy upload ngân hàng trước.");
                      try {
                        setLoading(true);
                        const exam = await assembleExam({
                          pool,
                          total_count: tot,
                          mcq_count: mcq,
                          word_count: word,
                          mode,
                        });
                        setProblems(exam);
                        setExamEval(await evaluateExam(exam));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        alert(msg);
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <Puzzle className="size-4" />
                    Ráp đề từ ngân hàng
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Preview & Evaluation */}
          <div className="xl:col-span-3 space-y-6">
            {/* Preview Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
                    <ListChecks className="size-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Xem trước câu hỏi</h3>
                </div>

                <div className="space-y-4">
                  {problems.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 flex items-start justify-between gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{p.id}. {p.text}</div>

                        {/* MCQ block */}
                        {p.kind === "arithmetic" && p.distractors && p.distractors.length >= 3 && (
                          <div className="text-sm mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <span className="rounded-lg bg-white/70 px-2 py-1 border border-slate-200">A) {p.distractors[0]}</span>
                            <span className="rounded-lg bg-white/70 px-2 py-1 border border-slate-200">B) {p.answer}</span>
                            <span className="rounded-lg bg-white/70 px-2 py-1 border border-slate-200">C) {p.distractors[1]}</span>
                            <span className="rounded-lg bg-white/70 px-2 py-1 border border-slate-200">D) {p.distractors[2]}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {diffBadge(p.difficulty)}
                        <button
                          onClick={() => copyQuestion(p)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white/80 border border-slate-200 hover:bg-white shadow-sm transition"
                          title="Sao chép câu hỏi"
                        >
                          Sao chép
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {problems.length === 0 && (
                    <div className="text-slate-500 text-sm">
                      Chưa có dữ liệu — hãy Generate hoặc Upload & Ráp đề.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Evaluation Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative backdrop-blur-xl bg-white/80 border border-white/50 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-lg">
                    <BrainCircuit className="size-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Đánh giá đề</h3>
                </div>

                {examEval ? (
                  <div className="space-y-6">
                    {/* KPI row */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="rounded-2xl border p-4 bg-white/70">
                        <div className="text-sm text-slate-500 mb-1">Độ khó trung bình</div>
                        <div className="text-2xl font-bold">{examEval.avg_difficulty.toFixed(2)}</div>
                        <div className="mt-2 text-sm text-slate-600 flex items-center gap-2">
                          <TrendingUp className="size-4 text-purple-600" />
                          E:{examEval.buckets?.easy ?? 0} • M:{examEval.buckets?.medium ?? 0} • H:{examEval.buckets?.hard ?? 0}
                        </div>
                      </div>

                      <div className="rounded-2xl border p-4 bg-white/70">
                        <div className="text-sm text-slate-500 mb-1">Theo loại</div>
                        <div className="text-sm">Số học: <b>{examEval.by_kind?.arithmetic ?? 0}</b></div>
                        <div className="text-sm">Lời văn: <b>{examEval.by_kind?.word ?? 0}</b></div>
                      </div>

                      <div className="rounded-2xl border p-4 bg-white/70">
                        <div className="text-sm text-slate-500 mb-1">Theo phép toán</div>
                        <div className="text-sm flex flex-wrap gap-2">
                          {(["+","-","×","÷"] as Operation[]).map(op => (
                            <span key={op} className="rounded-lg bg-slate-100 px-2 py-1 border border-slate-200">
                              {op}: <b>{examEval.by_op?.[op] ?? 0}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Distribution bar */}
                    <div>
                      <div className="text-sm text-slate-500 mb-2">Phân bố độ khó</div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct(examEval.buckets?.easy ?? 0)}%` }}
                          transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        />
                        <motion.div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct(examEval.buckets?.medium ?? 0)}%` }}
                          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.05 }}
                          style={{ marginTop: -12 }}
                        />
                        <motion.div
                          className="h-full bg-gradient-to-r from-rose-400 to-rose-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct(examEval.buckets?.hard ?? 0)}%` }}
                          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
                          style={{ marginTop: -12 }}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Dễ {pct(examEval.buckets?.easy ?? 0)}%</span>
                        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> Trung bình {pct(examEval.buckets?.medium ?? 0)}%</span>
                        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Khó {pct(examEval.buckets?.hard ?? 0)}%</span>
                      </div>
                    </div>

                    {/* Notes */}
                    {examEval.notes?.length > 0 && (
                      <div className="rounded-2xl border p-4 bg-white/70">
                        <div className="text-sm text-slate-500 mb-2">Ghi chú</div>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                          {examEval.notes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">Chưa có dữ liệu đánh giá.</div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}


