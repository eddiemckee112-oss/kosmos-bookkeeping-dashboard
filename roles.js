<script>
/* roles.js — replace your existing file with this content */
(async () => {
  const sb = supabase.createClient(CONFIG.url, CONFIG.anon);

  // get session/user
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    if (!location.pathname.endsWith('signin.html')) location.href = 'signin.html';
    return;
  }

  // find user's org + role
  const { data: rows, error } = await sb
    .from('org_users')
    .select('org_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (!rows || !rows.length) {
    // no org yet → onboard
    if (!location.pathname.endsWith('onboard.html')) location.href = 'onboard.html';
    return;
  }

  const { org_id, role } = rows[0] || {};
  localStorage.setItem('org_id', org_id);
  localStorage.setItem('role', role || 'staff');
  localStorage.setItem('uid', user.id);

  // If on signin/onboard but already has org, go to dashboard
  if (location.pathname.endsWith('signin.html') || location.pathname.endsWith('onboard.html')) {
    location.href = 'index.html';
  }
})();
</script>
