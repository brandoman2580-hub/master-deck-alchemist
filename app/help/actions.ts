"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import process from "node:process";
import { createClient } from "@/utils/supabase/server";
import type { FeedbackFormState } from "@/lib/help/feedback";
import {
  submitFeedback,
  type FeedbackMail,
  type FeedbackPorts,
} from "@/lib/help/submit-feedback";

const BUCKET = "feedback-screenshots";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Authenticated feedback ticket.
 * Env: `RESEND_API_KEY`, `FEEDBACK_FROM` (verified sender), `FEEDBACK_TO`,
 * `SUPABASE_SERVICE_ROLE_KEY` for the private screenshot bucket.
 * The signed screenshot URL is emailed to `FEEDBACK_TO` and is not returned here.
 */
export async function sendFeedback(
  prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  if (!formData) return prevState;
  const file = formData.get("screenshot");
  const screenshot =
    file instanceof File && file.size > 0
      ? new Uint8Array(await file.arrayBuffer())
      : null;

  try {
    return await submitFeedback(
      {
        category: String(formData.get("category") ?? ""),
        message: String(formData.get("message") ?? ""),
        includeDiagnostics: formData.get("includeDiagnostics") === "on",
        route: String(formData.get("route") ?? ""),
        deckFormat: String(formData.get("deckFormat") ?? ""),
        deckIdHash: String(formData.get("deckIdHash") ?? ""),
        screenshot,
      },
      await createFeedbackPorts(),
    );
  } catch (error) {
    console.error("Feedback submit failed.", error);
    return { success: false, error: "The report could not be sent. Try again." };
  }
}

async function createFeedbackPorts(): Promise<FeedbackPorts> {
  const supabase = await createClient();
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const service =
    serviceUrl && serviceKey
      ? createServiceClient(serviceUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  return {
    screenshotStorageReady: service !== null,
    buildId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 64) ?? null,
    async getUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null };
    },
    async countRecent(userId) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("feedback_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async insert(row) {
      const { data, error } = await supabase
        .from("feedback_reports")
        .insert({
          user_id: row.userId,
          category: row.category,
          message: row.message,
          include_diagnostics: row.includeDiagnostics,
          route: row.route,
          build_id: row.buildId,
          deck_format: row.deckFormat,
          deck_id_hash: row.deckIdHash,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: data.id as string };
    },
    async upload(path, file) {
      if (!service) throw new Error("Screenshot storage is not configured.");
      const { error } = await service.storage.from(BUCKET).upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: false,
      });
      if (error) throw new Error(error.message);
    },
    async attachScreenshot(id, path) {
      if (!service) throw new Error("Screenshot storage is not configured.");
      const { error } = await service
        .from("feedback_reports")
        .update({ screenshot_path: path })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    async deleteReport(id) {
      if (!service) throw new Error("Screenshot storage is not configured.");
      const { error } = await service.from("feedback_reports").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async signScreenshot(path) {
      if (!service) return null;
      const { data, error } = await service.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_SECONDS);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    async notify(mail) {
      await sendNotification(mail);
    },
  };
}

async function sendNotification(mail: FeedbackMail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO;
  const from = process.env.FEEDBACK_FROM;
  if (!apiKey || !to || !from) {
    throw new Error("Feedback email env is not configured.");
  }
  const resendModule = await import("resend");
  const resend = new resendModule.Resend(apiKey);
  const lines = [
    `Ticket ${mail.ticketId}`,
    `Category: ${mail.category}`,
    `From: ${mail.fromEmail ?? "unknown"}`,
    "",
    mail.message,
    "",
    mail.route ? `Route: ${mail.route}` : "Route: omitted",
    mail.buildId ? `Build: ${mail.buildId}` : "Build: omitted",
    mail.deckFormat ? `Format: ${mail.deckFormat}` : "Format: omitted",
    mail.deckIdHash ? `Deck hash: ${mail.deckIdHash}` : "Deck hash: omitted",
    mail.screenshotUrl
      ? `Screenshot (expires in 7 days): ${mail.screenshotUrl}`
      : "Screenshot: none",
  ];
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `Feedback ${mail.ticketId}`,
    text: lines.join("\n"),
  });
  if (error) throw new Error(error.message);
}
