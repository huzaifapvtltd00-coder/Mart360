import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Use POST." });

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === authorization) return json(401, { error: "Sign in again, then retry." });

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return json(500, { error: "Supabase owner-action credentials are unavailable." });
  }

  const userClient = createClient(projectUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) return json(401, { error: "Your session expired. Sign in again." });

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { action?: string; workspaceId?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "A valid action is required." });
  }

  if (body.action === "delete-store") {
    const workspaceId = String(body.workspaceId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
      return json(400, { error: "The store ID is invalid." });
    }
    const { data, error } = await adminClient
      .from("mart360_workspaces")
      .delete()
      .eq("id", workspaceId)
      .eq("owner_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return json(400, { error: error.message });
    if (!data) return json(404, { error: "This store was not found under your account." });
    return json(200, { deleted: true, type: "store" });
  }

  if (body.action === "delete-account") {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) return json(400, { error: error.message });
    return json(200, { deleted: true, type: "account" });
  }

  return json(400, { error: "Choose a supported owner action." });
});
