const fs = require('fs');
let text = fs.readFileSync('schema.sql', 'utf8');

// Insert the helper function right before the RLS policies section
if (!text.includes('get_auth_role()')) {
  text = text.replace(
    /-- سياسات RLS لجدول Profiles/g,
    `-- Function لتخطي الـ Recursion
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- سياسات RLS لجدول Profiles`
  );
  
  // Replace references
  text = text.replace(/EXISTS \(\s*SELECT 1 FROM profiles\s*WHERE id = auth\.uid\(\) AND role = 'super_admin'\s*\)/g, "public.get_auth_role() = 'super_admin'");
  text = text.replace(/EXISTS \(\s*SELECT 1 FROM profiles\s*WHERE id = auth\.uid\(\)\s*AND role = 'sub_admin'/g, "(public.get_auth_role() = 'sub_admin'");
  text = text.replace(/EXISTS \(\s*SELECT 1 FROM profiles p\s*WHERE p\.id = auth\.uid\(\)\s*AND p\.role = 'sub_admin'/g, "(public.get_auth_role() = 'sub_admin'");
  text = text.replace(/EXISTS \(\s*SELECT 1 FROM profiles p\s*JOIN profiles u ON u\.assigned_to = p\.id\s*WHERE p\.id = auth\.uid\(\)\s*AND p\.role = 'sub_admin'\s*AND u\.id = transactions\.user_id\s*\)/g, "(public.get_auth_role() = 'sub_admin' AND EXISTS (SELECT 1 FROM profiles u WHERE u.assigned_to = auth.uid() AND u.id = transactions.user_id))");
  text = text.replace(/EXISTS \(\s*SELECT 1 FROM profiles p\s*JOIN profiles u ON u\.assigned_to = p\.id\s*WHERE p\.id = auth\.uid\(\)\s*AND p\.role = 'sub_admin'\s*AND u\.id = trades\.user_id\s*\)/g, "(public.get_auth_role() = 'sub_admin' AND EXISTS (SELECT 1 FROM profiles u WHERE u.assigned_to = auth.uid() AND u.id = trades.user_id))");
  
  // Update auth.users trigger
  text = text.replace(/CREATE TRIGGER on_auth_user_created/g, "CREATE OR REPLACE TRIGGER on_auth_user_created");
  
  fs.writeFileSync('schema.sql', text);
  console.log('Fixed schema.sql');
}
