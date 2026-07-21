import { supabaseAdmin } from "@/integrations/supabase/client.server";
import JSZip from "jszip";

export async function handleDownload(request: Request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/download\/([0-9a-fA-F-]+)$/);
  if (!match) return new Response("Not found", { status: 404 });
  const backupId = match[1];

  const token = url.searchParams.get("token");
  if (!token) return new Response("Unauthorized: Missing token", { status: 401 });

  // Verify Auth using the provided JWT
  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user) {
    return new Response("Unauthorized: Invalid token", { status: 401 });
  }
  const user = authData.user;

  // Verify backup belongs to user
  const { data: backup, error: backupErr } = await supabaseAdmin
    .from("backups")
    .select("id, stores(shop_domain)")
    .eq("id", backupId)
    .eq("user_id", user.id)
    .single();

  if (backupErr || !backup || !backup.stores) {
    return new Response("Backup not found or unauthorized", { status: 404 });
  }

  const store = backup.stores as { shop_domain: string };
  const domain = store.shop_domain.split(".")[0];
  const filename = `${domain}-backup-${new Date().toISOString().split("T")[0]}.recovery`;

  // List all files in the recovery_packages bucket
  const { data: files, error: listErr } = await supabaseAdmin.storage
    .from("recovery_packages")
    .list(backupId);

  if (listErr || !files || files.length === 0) {
    return new Response("Package unavailable", { status: 404 });
  }

  const zip = new JSZip();

  // Download each file from Supabase and add to the ZIP
  for (const file of files) {
    if (file.name === ".emptyFolderPlaceholder") continue; // Supabase artifact
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from("recovery_packages")
      .download(`${backupId}/${file.name}`);

    if (dlErr || !fileData) {
      console.error(`Failed to download ${file.name} for backup ${backupId}`, dlErr);
      continue;
    }
    const arrayBuffer = await fileData.arrayBuffer();
    zip.file(file.name, arrayBuffer);
  }

  // Generate the zip binary
  const zipBuffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new Response(Buffer.from(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": zipBuffer.byteLength.toString(),
    },
  });
}
