/**
 * supabase/functions/notify-pending-tool/index.ts
 * Called when a new tool is submitted with status 'pending'.
 * Sends an internal notification row to all admin users.
 * Can be triggered by a DB webhook/trigger or called directly.
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

  try {
    const body = await req.json().catch(() => ({}));
    const toolId: string = body.tool_id || body.record?.id || '';
    const toolName: string = body.tool_name || body.record?.name || 'أداة جديدة';
    const submitterId: string = body.submitted_by || body.record?.submitted_by || '';

    if (!toolId) {
      return new Response(
        JSON.stringify({ error: 'tool_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    // Fetch all admin user IDs
    const { data: admins, error: adminErr } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('is_admin', true);

    if (adminErr) {
      console.error('Error fetching admins:', adminErr.message);
      return new Response(
        JSON.stringify({ error: adminErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      );
    }

    if (!admins || admins.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: 'No admins found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    // Insert internal notification for each admin
    const notifications = admins
      .filter((a: any) => a.id !== submitterId) // don't notify the submitter if they're admin
      .map((admin: any) => ({
        user_id: admin.id,
        type: 'pending_tool',
        title: 'أداة جديدة تنتظر المراجعة',
        body: `تم إضافة أداة "${toolName}" وتنتظر موافقتك`,
        tool_id: toolId,
        actor_id: submitterId || null,
        is_read: false,
      }));

    if (notifications.length > 0) {
      const { error: insertErr } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertErr) {
        console.error('Error inserting notifications:', insertErr.message);
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        );
      }
    }

    // Log to audit
    await supabase.from('admin_audit_logs').insert({
      action: 'pending_tool_notification',
      resource_type: 'tool',
      resource_id: toolId,
      description: `إشعار للمسؤولين: أداة جديدة معلقة "${toolName}" (${notifications.length} إشعار)`,
    });

    console.log(`Notified ${notifications.length} admin(s) about pending tool: ${toolName}`);

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length, toolId, toolName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    console.error('notify-pending-tool error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
