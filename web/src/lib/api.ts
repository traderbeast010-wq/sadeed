import type {
  AnalysisRow,
  Client,
  ClientAnalysisRow,
  Consultation,
  Deadline,
  Invoice,
  LawArticle,
  Office,
  PricingRow,
  Report,
  ReviewItem,
  RevenueSummary,
  SavedClause,
  SearchHit,
  StreamEvent,
} from "./types";
import fallbackDemos from "./fallback-demos.json";

export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/**
 * تحاليل محفوظة — خطة B للعرض. لو انقطع الخادم أثناء العرض، تعرض الواجهة
 * التحليل المحفوظ بدل رسالة الخطأ، فلا يتجمّد العرض أمام اللجنة. تُبنى من
 * تحاليل حقيقية عبر سكربت (لا بيانات مخترعة).
 */
const DEMOS = fallbackDemos as unknown as Record<string, Report>;

export function demoList(): { id: string; label: string }[] {
  return Object.values(DEMOS).map((d) => ({
    id: d.analysis_id,
    label: (d as Report & { _demo_label?: string })._demo_label ?? d.filename,
  }));
}

export function getDemo(id: string): Report | null {
  return DEMOS[id] ?? null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `تعذّر الاتصال بالخادم (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* الاستجابة ليست JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function health() {
  return json<{
    status: string;
    laws: { law_name: string; decree_no: string; article_count: number }[];
    law_count: number;
    article_count: number;
    top_k: number;
  }>(await fetch(`${API}/health`, { cache: "no-store" }));
}

export async function uploadContract(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return json<{
    contract_id: string;
    filename: string;
    chars: number;
    clause_count: number;
    status: string;
  }>(await fetch(`${API}/contracts/upload`, { method: "POST", body: fd }));
}

export async function startAnalysis(contractId: string) {
  return json<{ analysis_id: string; status: string }>(
    await fetch(`${API}/contracts/${contractId}/analyze`, { method: "POST" }),
  );
}

export async function getAnalysis(id: string) {
  // تحليل عرض محفوظ؟ أعِده مباشرةً بلا خادم.
  const demo = getDemo(id);
  if (demo) return demo;
  return json<Report>(
    await fetch(`${API}/analyses/${id}`, { cache: "no-store" }),
  );
}

export async function listAnalyses() {
  const r = await json<{ analyses: AnalysisRow[] }>(
    await fetch(`${API}/analyses`, { cache: "no-store" }),
  );
  return r.analyses;
}

export async function approve(id: string, approvedBy: string) {
  return json<{ approved_by: string; approved_at: string }>(
    await fetch(`${API}/analyses/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved_by: approvedBy }),
    }),
  );
}

export async function suggestRewrite(id: string, clauseId: string) {
  return json<{ clause_id: string; suggested_text: string }>(
    await fetch(`${API}/analyses/${id}/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clause_id: clauseId }),
    }),
  );
}

export async function setRevision(
  id: string,
  clauseId: string,
  status: "accepted" | "rejected" | "pending",
) {
  return json<{ clause_id: string; status: string }>(
    await fetch(`${API}/analyses/${id}/revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clause_id: clauseId, status }),
    }),
  );
}

export async function reviewQueue() {
  const r = await json<{ items: ReviewItem[] }>(
    await fetch(`${API}/review/queue`, { cache: "no-store" }),
  );
  return r.items;
}

// ── العملاء (B3) ────────────────────────────────────────────────────────
export interface ClientPayload {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export async function listClients() {
  const r = await json<{ clients: Client[] }>(
    await fetch(`${API}/clients`, { cache: "no-store" }),
  );
  return r.clients;
}

export async function getClient(id: string) {
  return json<Client & { analyses: ClientAnalysisRow[] }>(
    await fetch(`${API}/clients/${id}`, { cache: "no-store" }),
  );
}

export async function createClient(body: ClientPayload) {
  return json<Client>(
    await fetch(`${API}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function updateClient(id: string, body: ClientPayload) {
  return json<Client>(
    await fetch(`${API}/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteClient(id: string) {
  return json<{ deleted: string }>(
    await fetch(`${API}/clients/${id}`, { method: "DELETE" }),
  );
}

export async function assignContractClient(
  contractId: string,
  clientId: string | null,
) {
  return json<{ contract_id: string; client_id: string | null }>(
    await fetch(`${API}/contracts/${contractId}/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    }),
  );
}

// ── متابعة المهل (B4) ────────────────────────────────────────────────────
export interface DeadlinePayload {
  title: string;
  due_date: string;
  client_id?: string | null;
  analysis_id?: string | null;
  note?: string | null;
}

export async function listDeadlines() {
  const r = await json<{ items: Deadline[] }>(
    await fetch(`${API}/deadlines`, { cache: "no-store" }),
  );
  return r.items;
}

export async function createDeadline(body: DeadlinePayload) {
  return json<{ id: string }>(
    await fetch(`${API}/deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function setDeadlineDone(id: string, done: boolean) {
  return json<{ id: string; done: boolean }>(
    await fetch(`${API}/deadlines/${id}/done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }),
  );
}

export async function deleteDeadline(id: string) {
  return json<{ deleted: string }>(
    await fetch(`${API}/deadlines/${id}`, { method: "DELETE" }),
  );
}

// ── سجلّ الاستشارات (B8) ─────────────────────────────────────────────────
export async function listConsultations() {
  const r = await json<{ items: Consultation[] }>(
    await fetch(`${API}/consultations`, { cache: "no-store" }),
  );
  return r.items;
}

export async function saveConsultation(
  question: string,
  answer: string,
  articles: { article_no: number; law_name?: string }[],
) {
  return json<{ id: string }>(
    await fetch(`${API}/consultations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, articles }),
    }),
  );
}

export async function deleteConsultation(id: string) {
  return json<{ deleted: string }>(
    await fetch(`${API}/consultations/${id}`, { method: "DELETE" }),
  );
}

// ── المصادقة (A2) ────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  username: string;
  name: string;
}

export async function authState() {
  return json<{ has_users: boolean }>(
    await fetch(`${API}/auth/state`, { cache: "no-store" }),
  );
}

export async function signup(username: string, name: string, password: string) {
  return json<{ token: string; user: AuthUser }>(
    await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, name, password }),
    }),
  );
}

export async function login(username: string, password: string) {
  return json<{ token: string; user: AuthUser }>(
    await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  );
}

export async function logout(token: string) {
  await fetch(`${API}/auth/logout?token=${encodeURIComponent(token)}`, {
    method: "POST",
  }).catch(() => {});
}

// ── البحث والمكتبة (B6) ──────────────────────────────────────────────────
export async function searchClauses(q: string) {
  const r = await json<{ query: string; results: SearchHit[] }>(
    await fetch(`${API}/search/clauses?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
    }),
  );
  return r.results;
}

export async function listLibrary() {
  const r = await json<{ items: SavedClause[] }>(
    await fetch(`${API}/library`, { cache: "no-store" }),
  );
  return r.items;
}

export interface SaveClausePayload {
  heading?: string | null;
  text: string;
  verdict?: string | null;
  law_name?: string | null;
  article_no?: number | null;
  source_analysis_id?: string | null;
  source_filename?: string | null;
  note?: string | null;
}

export async function saveClauseToLibrary(body: SaveClausePayload) {
  return json<{ id: string }>(
    await fetch(`${API}/library`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteFromLibrary(id: string) {
  return json<{ deleted: string }>(
    await fetch(`${API}/library/${id}`, { method: "DELETE" }),
  );
}

// ── هوية المكتب (B5) ────────────────────────────────────────────────────
export async function getOffice() {
  return json<Office>(await fetch(`${API}/office`, { cache: "no-store" }));
}

export async function saveOffice(body: Partial<Office>) {
  return json<Office>(
    await fetch(`${API}/office`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

// ── الأسعار والأتعاب والفواتير (B2) ──────────────────────────────────────
export async function getPricing() {
  const r = await json<{ items: PricingRow[] }>(
    await fetch(`${API}/pricing`, { cache: "no-store" }),
  );
  return r.items;
}

export async function savePricing(items: PricingRow[]) {
  const r = await json<{ items: PricingRow[] }>(
    await fetch(`${API}/pricing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }),
  );
  return r.items;
}

export async function setFee(id: string, contractType: string, fee: number) {
  return json<{ analysis_id: string; contract_type: string; fee: number }>(
    await fetch(`${API}/analyses/${id}/fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_type: contractType, fee }),
    }),
  );
}

export async function listInvoices() {
  const r = await json<{ invoices: Invoice[] }>(
    await fetch(`${API}/invoices`, { cache: "no-store" }),
  );
  return r.invoices;
}

export async function getInvoice(id: string) {
  return json<Invoice>(
    await fetch(`${API}/invoices/${id}`, { cache: "no-store" }),
  );
}

export async function createInvoice(analysisId: string, amount?: number) {
  return json<Invoice>(
    await fetch(`${API}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis_id: analysisId, amount }),
    }),
  );
}

export async function setInvoiceStatus(id: string, status: "issued" | "paid") {
  return json<{ id: string; status: string }>(
    await fetch(`${API}/invoices/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}

export async function getRevenue() {
  return json<RevenueSummary>(
    await fetch(`${API}/revenue`, { cache: "no-store" }),
  );
}

export async function searchLaw(q: string, k = 5) {
  return json<{
    query: string;
    count: number;
    ms: number;
    results: LawArticle[];
  }>(
    await fetch(
      `${API}/law/search?q=${encodeURIComponent(q)}&k=${k}`,
      { cache: "no-store" },
    ),
  );
}

/**
 * يفتح مجرى SSE لتحليل جارٍ.
 * البثّ بندًا بندًا هو ما يحوّل انتظار الدقيقتين من عيب إلى عرض:
 * المستخدم يرى النظام يشتغل بدل شاشة تحميل صامتة.
 */
export function streamAnalysis(
  analysisId: string,
  onEvent: (e: StreamEvent) => void,
  onError?: (msg: string) => void,
) {
  const es = new EventSource(`${API}/analyses/${analysisId}/stream`);
  es.onmessage = (m) => {
    try {
      const evt = JSON.parse(m.data) as StreamEvent;
      onEvent(evt);
      if (evt.stage === "done" || evt.stage === "error") es.close();
    } catch {
      /* حدث غير صالح — نتجاهله */
    }
  };
  es.onerror = () => {
    es.close();
    onError?.("انقطع الاتصال بالخادم أثناء التحليل.");
  };
  return () => es.close();
}
