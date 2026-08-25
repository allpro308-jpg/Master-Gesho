/**
 * supabase/functions/scheduled-themes/index.ts
 * Cron edge function: activate scheduled themes and restore previous on expiry.
 * Schedule: every day at 00:05 UTC (configure in Supabase Dashboard > Edge Functions > Schedules)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const now = new Date().toISOString();
  const results: string[] = [];

  try {
    // ── 1. Activate themes whose start_at has arrived and are not yet active ─
    const { data: toActivate } = await supabase
      .from('app_themes')
      .select('id, name, prev_active_id')
      .eq('status', 'published')
      .eq('is_active', false)
      .lte('start_at', now)
      .or('end_at.is.null,end_at.gt.' + now);

    for (const theme of toActivate || []) {
      // Find current active theme to remember it
      const { data: currentActive } = await supabase
        .from('app_themes')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      // Deactivate all others
      await supabase.from('app_themes').update({ is_active: false }).neq('id', theme.id);

      // Activate this theme, storing the previous active id
      await supabase.from('app_themes').update({
        is_active: true,
        prev_active_id: currentActive?.id ?? null,
      }).eq('id', theme.id);

      // Log to audit
      await supabase.from('admin_audit_logs').insert({
        action: 'scheduled_theme_activated',
        resource_type: 'theme',
        resource_id: theme.id,
        description: `تفعيل ثيم مجدوَل تلقائياً: ${theme.name}`,
      });

      results.push(`Activated theme: ${theme.name}`);
    }

    // ── 2. Expire themes whose end_at has passed ─────────────────────────────
    const { data: toExpire } = await supabase
      .from('app_themes')
      .select('id, name, prev_active_id')
      .eq('is_active', true)
      .not('end_at', 'is', null)
      .lte('end_at', now);

    for (const theme of toExpire || []) {
      // Deactivate expired theme
      await supabase.from('app_themes').update({ is_active: false }).eq('id', theme.id);

      // Restore previous active theme if exists
      if (theme.prev_active_id) {
        const { data: prev } = await supabase
          .from('app_themes')
          .select('id, name')
          .eq('id', theme.prev_active_id)
          .maybeSingle();

        if (prev) {
          await supabase.from('app_themes').update({ is_active: true }).eq('id', prev.id);
          results.push(`Restored theme: ${prev.name}`);
        }
      }

      // Log to audit
      await supabase.from('admin_audit_logs').insert({
        action: 'scheduled_theme_expired',
        resource_type: 'theme',
        resource_id: theme.id,
        description: `انتهاء صلاحية الثيم المجدوَل: ${theme.name}`,
      });

      results.push(`Expired theme: ${theme.name}`);
    }

    return new Response(
      JSON.stringify({ success: true, processed: results, timestamp: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('scheduled-themes error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
