<!-- roles.js -->
<script>
/*
  roles.js
  - Redirects to signin.html if not authenticated
  - Loads current user's role from org_users (admin/manager/staff)
  - Sets window.currentRole and window.can(action)
  - Hides admin-only UI automatically

  Usage:
  1) Include after supabase-js on any protected page:
     <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
     <script src="roles.js"></script>

  2) (Next step) Mark elements as admin-only:
     <button class="admin-only">Delete</button>
*/
(function () {
  // ---- Config: reuse an existing client if available
  const SUPABASE_URL  = window.SUPABASE_URL  || "https://advihqhjjlxumgdlbwui.supabase.co";
  const SUPABASE_KEY  = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmlocWhqamx4dW1nZGxid3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMTg0MzIsImV4cCI6MjA3NjU5NDQzMn0.kVlaPQg2_o9DGJYv22Dgca7veok4drF6kgLPy2wPBeY";

  const hasClient = !!(window.sb && typeof window.sb.from === "function");
  const sb = hasClient ? window.sb : (window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true } })
      : null);

  if (!sb) {
    console.warn("roles.js: Supabase client not found. Load @supabase/supabase-js before roles.js");
    return;
  }

  const page = String(location.pathname || "");
  const isSignin = /signin\.html$/i.test(page);

  // Small helper to hide an element
  function hide(el) { el.style.display = "none"; }

  // Apply role-based UI guards
  function applyGuards(role) {
    // Save role globally
    window.currentRole = role || "staff";
    document.documentElement.setAttribute("data-role", window.currentRole);

    // Admin-only elements (explicit markers)
    document.querySelectorAll(".admin-only, [data-role~='admin']").forEach(el => {
      if (window.currentRole !== "admin") hide(el);
    });

    // Common destructive buttons — auto-guard even if not marked
    if (window.currentRole !== "admin") {
      document.querySelectorAll(
        ".btnDel, #deleteSelected, .danger, [data-action='delete'], [data-action='remove']"
      ).forEach(el => hide(el));
    }

    // Optional: manager-only markers
    document.querySelectorAll("[data-role~='manager']").forEach(el => {
      if (window.currentRole === "staff") hide(el);
    });
  }

  // Permission helper you can use in your code
  window.can = function(action) {
    const role = window.currentRole || "staff";
    switch (action) {
      case "delete:any":
        return role === "admin";                     // matches receipts RLS (admin-only delete)
      case "update:any":
        return role === "admin" || role === "manager";
      case "insert:any":
      case "read:any":
        return role === "admin" || role === "manager" || role === "staff";
      default:
        return false;
    }
  };

  // Main: get session → redirect if needed → fetch role → guard UI
  (async function init() {
    // 1) Require auth for all pages except signin
    const { data: { user }, error } = await sb.auth.getUser();
    if (!user) {
      if (!isSignin) {
        // No session → redirect to sign-in page
        const to = "signin.html";
        try { sessionStorage.setItem("postSignInRedirect", location.pathname + location.search + location.hash); } catch {}
        location.replace(to);
      }
      return;
    }

    // 2) Fetch role for this user
    // org_users has one row per (org,user); if multiple, we prioritize admin > manager > staff
    const { data: rows, error: roleErr } = await sb
      .from("org_users")
      .select("role")
      .eq("user_id", user.id);

    let role = "staff";
    if (!roleErr && Array.isArray(rows) && rows.length) {
      // pick the highest privilege if user belongs to multiple orgs
      const ranks = { admin: 3, manager: 2, staff: 1 };
      role = rows.sort((a, b) => (ranks[b.role] - ranks[a.role]))[0].role || "staff";
    }

    applyGuards(role);

    // 3) After sign-in redirect (optional)
    if (isSignin) {
      let go = null;
      try { go = sessionStorage.getItem("postSignInRedirect"); sessionStorage.removeItem("postSignInRedirect"); } catch {}
      if (go) location.replace(go);
      else location.replace("index.html");
    }
  })();
})();
</script>
