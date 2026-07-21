import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
  } else {
    console.log("Users:");
    data.users.forEach((u) => console.log(u.email));
  }
}

run();
