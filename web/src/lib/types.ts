export type Verdict = "مخالف" | "ناقص" | "سليم" | "لا مادة ذات صلة";

export interface Citation {
  law_id?: string;
  law_name: string;
  decree_no?: string | null;
  article_no: number;
  article_text: string;
  book: string | null;
  chapter: string | null;
}

export interface LawInfo {
  law_id: string;
  law_name: string;
  decree_no: string;
  article_count: number;
  domains?: string[];
}

export interface RoutingRow {
  law_id: string;
  law_name: string;
  similarity: number;
  weight: number;
  article_count: number;
}

export interface Clause {
  clause_id: string;
  heading: string;
  text: string;
  verdict: Verdict;
  reasoning: string;
  confidence: number;
  needs_review: boolean;
  citations: Citation[];
  considered: { law_name: string; article_no: number }[];
  suggested_text: string | null;
  revision_status?: "accepted" | "rejected" | "pending" | null;
  seconds: number;
}

export interface ReviewItem {
  analysis_id: string;
  filename: string;
  created_at: string;
  approved: boolean;
  clause_id: string;
  heading: string;
  verdict: Verdict;
  confidence: number;
  needs_review: boolean;
  reasoning: string;
}

export interface MissingItem {
  key: string;
  label: string;
  required: boolean;
  basis?: string;
}

export interface Score {
  overall: number | null;
  grade: string;
  note: string;
  coverage?: { evaluated: number; total: number };
  compliance: {
    score: number;
    weight: number;
    counts: Record<Verdict, number>;
    penalty: number;
  };
  completeness: {
    score: number;
    weight: number;
    required_present: string;
    recommended_present: string;
    missing: MissingItem[];
    present: MissingItem[];
  };
  basis: string;
}

export interface Report {
  analysis_id: string;
  contract_id: string;
  filename: string;
  laws: LawInfo[];
  article_count: number;
  routing?: RoutingRow[];
  clause_count: number;
  summary: Record<Verdict, number>;
  score: Score;
  clauses: Clause[];
  guard_log: { clause_id: string; entries: string[] }[];
  top_k: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  client_id?: string | null;
  client_name?: string | null;
  fee?: number | null;
  contract_type?: string | null;
  suggested_type?: string | null;
}

export interface AnalysisRow {
  id: string;
  contract_id: string;
  score: number | null;
  status: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  filename: string;
  clause_count: number;
  client_id?: string | null;
  client_name?: string | null;
}

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string;
  contract_count?: number;
}

export interface ClientAnalysisRow {
  id: string;
  contract_id: string;
  score: number | null;
  status: string;
  created_at: string;
  approved_by: string | null;
  filename: string;
  clause_count: number;
  fee?: number | null;
}

export interface Office {
  id: string;
  office_name?: string | null;
  lawyer_name?: string | null;
  license_no?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo?: string | null;
}

export interface PricingRow {
  contract_type: string;
  price: number;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  client_id: string | null;
  analysis_id: string | null;
  amount: number;
  status: string;
  created_at: string;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  filename?: string | null;
}

export interface Deadline {
  id: string;
  title: string;
  due_date: string;
  client_id: string | null;
  analysis_id: string | null;
  note: string | null;
  done: number;
  created_at: string;
  client_name?: string | null;
}

export interface Consultation {
  id: string;
  question: string;
  answer: string;
  articles: { article_no: number; law_name?: string }[];
  created_at: string;
}

export interface SearchHit {
  analysis_id: string;
  filename: string;
  clause_id: string;
  heading: string;
  verdict: Verdict;
  text: string;
  law_name: string | null;
  article_no: number | null;
}

export interface SavedClause {
  id: string;
  heading: string | null;
  text: string;
  verdict: string | null;
  law_name: string | null;
  article_no: number | null;
  source_analysis_id: string | null;
  source_filename: string | null;
  note: string | null;
  created_at: string;
}

export interface RevenueSummary {
  invoiced_total: number;
  paid_total: number;
  outstanding_total: number;
  invoice_count: number;
  fees_total: number;
  fees_count: number;
  by_client: { client_name: string; total: number; count: number }[];
}

export interface LawArticle {
  article_no: number;
  law_id: string;
  law_name: string;
  book: string | null;
  chapter: string | null;
  text: string;
  rrf: number;
  cosine: number;
  lex_rank?: number | null;
  dense_rank?: number | null;
}

// لقطة تقدّم التحليل — تُقرأ بالسبر الدوريّ (بديل البثّ SSE الذي يكسره النفق).
export type AnalysisProgress = {
  stage: string; // queued | parsed | retrieved | clause | done | error
  clause_count: number | null;
  clauses: Clause[];
  report: Report | null;
  error: string | null;
};

export const VERDICTS: Verdict[] = [
  "مخالف",
  "ناقص",
  "سليم",
  "لا مادة ذات صلة",
];

export const VERDICT_STYLE: Record<
  Verdict,
  { fg: string; bg: string; label: string }
> = {
  مخالف: {
    fg: "var(--color-violation)",
    bg: "var(--color-violation-bg)",
    label: "مخالف",
  },
  ناقص: {
    fg: "var(--color-deficient)",
    bg: "var(--color-deficient-bg)",
    label: "ناقص",
  },
  سليم: {
    fg: "var(--color-compliant)",
    bg: "var(--color-compliant-bg)",
    label: "سليم",
  },
  "لا مادة ذات صلة": {
    fg: "var(--color-neutral)",
    bg: "var(--color-neutral-bg)",
    label: "لا مادة ذات صلة",
  },
};
