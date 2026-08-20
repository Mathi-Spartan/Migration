import { createClient } from "@supabase/supabase-js";

export function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );
}

export function calcReplacement(certEnd, orderExpiry) {
  const end = new Date(certEnd + "T00:00:00Z");
  const exp = new Date(orderExpiry + "T00:00:00Z");
  const diffDays = Math.floor((exp - end) / 86400000);
  let years = 1;
  if (diffDays > 730) years = 3;
  else if (diffDays > 365) years = 2;
  return { diffDays, years };
}
