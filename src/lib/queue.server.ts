import type { SupabaseClient } from "@supabase/supabase-js";

export interface JobPayload {
  [key: string]: any;
}

export interface Job {
  id: string;
  queue_name: string;
  job_type: string;
  payload: JobPayload;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  attempts: number;
  max_attempts: number;
}

export async function enqueueJob(
  admin: SupabaseClient,
  jobType: string,
  payload: JobPayload,
  options?: { queueName?: string; priority?: number; runAt?: Date },
) {
  const { data, error } = await admin
    .from("jobs")
    .insert({
      job_type: jobType,
      payload,
      queue_name: options?.queueName ?? "default",
      priority: options?.priority ?? 0,
      run_at: options?.runAt?.toISOString() ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Enqueue failed: ${error.message}`);
  return data.id;
}

export async function logJobEvent(
  admin: SupabaseClient,
  jobId: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
  meta?: any,
) {
  await admin.from("job_logs").insert({ job_id: jobId, message, level, meta });
}

// In a real long-running worker (e.g. Node.js daemon), this would loop.
// In Vercel, we call this endpoint periodically or trigger via cron to process the next job.
export async function processNextJob(
  admin: SupabaseClient,
  handlers: Record<string, (job: Job, admin: SupabaseClient) => Promise<void>>,
  queueName = "default",
) {
  const workerId = `worker-${Math.random().toString(36).substr(2, 9)}`;

  // Lock a job (Postgres CTE isn't easily doable via Supabase Data API without RPC,
  // so we use a simple update where lock is null).
  // For production, use an RPC function `lock_next_job`.
  // As a workaround using REST:

  const { data: candidates, error: findErr } = await admin
    .from("jobs")
    .select("id")
    .eq("status", "queued")
    .eq("queue_name", queueName)
    .lte("run_at", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("run_at", { ascending: true })
    .limit(1);

  if (findErr || !candidates || candidates.length === 0) return null;

  const jobToLock = candidates[0].id;

  const { data: lockedJob, error: lockErr } = await admin
    .from("jobs")
    .update({
      status: "running",
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobToLock)
    .eq("status", "queued") // Optimistic concurrency check
    .select()
    .single();

  if (lockErr || !lockedJob) return null; // Another worker grabbed it

  const job = lockedJob as Job;
  const handler = handlers[job.job_type];

  if (!handler) {
    await admin
      .from("jobs")
      .update({
        status: "failed",
        last_error: `No handler found for job_type: ${job.job_type}`,
      })
      .eq("id", job.id);
    return job.id;
  }

  try {
    await logJobEvent(admin, job.id, "Job started");
    await handler(job, admin);
    await admin
      .from("jobs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", job.id);
    await logJobEvent(admin, job.id, "Job completed successfully");
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    await logJobEvent(admin, job.id, `Job failed: ${errorMsg}`, "error");

    const attempts = job.attempts + 1;
    if (attempts >= job.max_attempts) {
      await admin
        .from("jobs")
        .update({
          status: "failed",
          attempts,
          last_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } else {
      // Exponential backoff (e.g. 5s, 25s, 125s)
      const backoffMs = Math.pow(5, attempts) * 1000;
      await admin
        .from("jobs")
        .update({
          status: "queued",
          attempts,
          last_error: errorMsg,
          locked_by: null,
          locked_at: null,
          run_at: new Date(Date.now() + backoffMs).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  return job.id;
}
