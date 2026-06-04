import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  ServiceTicket,
  ServiceTicketCard,
  ServiceTicketFile,
  ServiceTicketMessageWithAuthor,
} from "@/lib/types";

export const SERVICE_BUCKET = "service-files";

function publicUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): string | null {
  if (!path) return null;
  return supabase.storage.from(SERVICE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Alle Service-Tickets als Board-Karten (mit Kunde, Zählern, Cover-URL). */
export async function getServiceTickets(): Promise<ServiceTicketCard[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_tickets")
    .select(
      "*, customer:customers(id, first_name, last_name, company), comments:service_ticket_messages(count), files:service_ticket_files(count)",
    )
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getServiceTickets:", error.message);
    return [];
  }
  return (data ?? []).map((t) => {
    const row = t as unknown as ServiceTicket & {
      customer: ServiceTicketCard["customer"];
      comments: { count: number }[];
      files: { count: number }[];
    };
    return {
      ...row,
      comment_count: row.comments?.[0]?.count ?? 0,
      file_count: row.files?.[0]?.count ?? 0,
      cover_url: publicUrl(supabase, row.cover_path),
    } as ServiceTicketCard;
  });
}

export async function getServiceTicket(id: string): Promise<
  | (ServiceTicket & {
      customer: ServiceTicketCard["customer"];
      messages: ServiceTicketMessageWithAuthor[];
      files: (ServiceTicketFile & { url: string | null })[];
      cover_url: string | null;
    })
  | null
> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_tickets")
    .select("*, customer:customers(id, first_name, last_name, company)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const [{ data: messages }, { data: files }] = await Promise.all([
    supabase
      .from("service_ticket_messages")
      .select("*, author:employees(name)")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("service_ticket_files")
      .select("*")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const ticket = data as unknown as ServiceTicket & {
    customer: ServiceTicketCard["customer"];
  };
  return {
    ...ticket,
    messages: (messages ?? []) as unknown as ServiceTicketMessageWithAuthor[],
    files: (files ?? []).map((f) => ({
      ...(f as ServiceTicketFile),
      url: publicUrl(supabase, (f as ServiceTicketFile).storage_path),
    })),
    cover_url: publicUrl(supabase, ticket.cover_path),
  };
}
