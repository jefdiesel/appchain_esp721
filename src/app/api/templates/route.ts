import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { canUploadTemplate } from "@/lib/credits";
import { TEMPLATE_DEFINITIONS } from "@/lib/templates";

// GET - list all available templates (system + user's custom)
export async function GET() {
  const { userId } = await auth();

  // System templates (available to all)
  const systemTemplates = Object.entries(TEMPLATE_DEFINITIONS).map(([id, t]) => ({
    id,
    name: t.name,
    type: t.type,
    version: t.version,
    fields: t.fields,
    isSystem: true,
  }));

  // User's custom templates (if logged in)
  let customTemplates: Array<{
    id: string;
    name: string;
    type: string;
    version: string;
    fields: string[];
    isSystem: boolean;
    txHash?: string;
  }> = [];

  if (userId) {
    const { data } = await supabaseAdmin
      .from("custom_templates")
      .select("id, name, type, version, fields, tx_hash")
      .eq("clerk_id", userId)
      .order("created_at", { ascending: false });

    if (data) {
      customTemplates = data.map((t) => ({
        id: `custom-${t.id}`,
        name: t.name,
        type: t.type || "custom",
        version: t.version || "1.0",
        fields: t.fields || [],
        isSystem: false,
        txHash: t.tx_hash,
      }));
    }
  }

  return NextResponse.json({
    templates: [...systemTemplates, ...customTemplates],
  });
}

// POST - upload a custom template (paid users only)
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user can upload templates
  const canUpload = await canUploadTemplate(userId);
  if (!canUpload.allowed) {
    return NextResponse.json(
      { error: canUpload.reason || "Custom templates require a paid plan" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, css, html, fields, type } = body;

  // Validate required fields
  if (!name || !html) {
    return NextResponse.json(
      { error: "Name and HTML are required" },
      { status: 400 }
    );
  }

  // Validate HTML has required placeholders
  const requiredFields = fields || [];
  const missingFields = requiredFields.filter(
    (field: string) => !html.includes(`{{${field}}}`)
  );

  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: `HTML missing placeholders: ${missingFields.join(", ")}` },
      { status: 400 }
    );
  }

  // Store the template
  const { data, error } = await supabaseAdmin
    .from("custom_templates")
    .insert({
      clerk_id: userId,
      name,
      type: type || "custom",
      css: css || "",
      html,
      fields: fields || [],
      version: "1.0",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save template:", error);
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    templateId: `custom-${data.id}`,
    message: "Template saved. You can now inscribe it to make it permanent.",
  });
}

// PATCH - update tx_hash after template is inscribed
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { templateId, txHash } = body;

  if (!templateId || !txHash) {
    return NextResponse.json(
      { error: "templateId and txHash are required" },
      { status: 400 }
    );
  }

  // Extract numeric ID from custom-{id} format
  const numericId = templateId.replace("custom-", "");

  const { error } = await supabaseAdmin
    .from("custom_templates")
    .update({ tx_hash: txHash })
    .eq("id", numericId)
    .eq("clerk_id", userId);

  if (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
