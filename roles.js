<!-- roles.js -->
<script>
(function () {
  const SUPABASE_URL  = window.SUPABASE_URL  || "https://advihqhjjlxumgdlbwui.supabase.co";
  const SUPABASE_KEY  = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdmlocWhqamx4dW1nZGxid3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMTg0MzIsImV4cCI6MjA3NjU5NDQzMn0.kVlaPQg2_o9DGJYv22Dgca7veok4drF6kgLPy2wPBeY";

  const hasClient = !!(window.sb && typeof window.sb.from === "function");
  const sb = hasClient ? window.sb : (window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true } })
      : null);

  if (!sb) { console.warn("roles.js: Supabase client missing"); return; }

  const page = (location.pathname || "").split("/").pop() || "";
  const isSignin  = page.toLowerCase() === "signin.html";
  const isOnboard = page.toLowerCase() === "onboard.html";

  function hide(el){ el.style.display = "none"; }

  function applyGuards(role) {
    window.currentRole = role || "staff";
    document.documentElement.setAttribute("data-role", window.currentRole);

    // Explicit admin-only markers
    document.querySelectorAll(".admin-only, [data-role~='admin']").forEach(el => {
      if (window.currentRole !== "admin") hide(el);
    });

    // Auto-guard destructive controls
    if (window.currentRole !== "admin") {
      document.querySelectorAll(".btnDel, #deleteSelected, .danger, [data-action='delete'], [data-action='remove']")
        .forEach(el => hide(el));
    }

    // Manager-only markers
    document.querySelectorAll("[data-role~='manager']").forEach(el => {
      if (window.currentRole === "staff") hide(el);
    });
  }

  window.can = function(action) {
    const role = window.currentRole || "staff";
    switch (action) {
      case "delete:any": return role === "admin";
      case "update:any": return role === "admin" || role === "manager";
      case "insert:any":
      case "read:any":   return role === "admin" || role === "manager" || role === "staff";
      default:           return false;
    }
  };

  (async function init() {
    // Require auth everywhere except signin
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      if (!isSignin) {
        try { sessionStorage.setItem("postSignInRedirect", location.pathname + location.search + location.hash); } catch {}
        location.replace("signin.html");
      }
      return;
    }

    // Does this user belong to any org?
    const { data: rows, error: roleErr } = await sb
      .from("org_users")
      .select("role")
      .eq("user_id", user.id);

    if (!roleErr && (!rows || rows.length === 0)) {
      // Not onboarded yet — send to create company (unless already there)
      if (!isOnboard) {
        try { sessionStorage.setItem("postSignInRedirect", location.pathname + location.search + location.hash); } catch {}
        location.replace("onboard.html");
        return;
      }
      // On the onboarding page, allow access without guards
      applyGuards("staff");
      return;
    }

    // Pick highest privilege role
    const ranks = { admin:3, manager:2, staff:1 };
    const role = (rows||[]).sort((a,b)=>ranks[b.role]-ranks[a.role])[0]?.role || "staff";
    applyGuards(role);

    // If we’re on signin.html but already signed in → go to dashboard
    if (isSignin) {
      let go = null;
      try { go = sessionStorage.getItem("postSignInRedirect"); sessionStorage.removeItem("postSignInRedirect"); } catch {}
      location.replace(go || "index.html");
    }
  })();
})();
</script>
