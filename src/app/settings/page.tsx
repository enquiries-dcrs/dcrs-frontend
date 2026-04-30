 'use client';

 import React, { useState } from 'react';
 import {
   Users,
   Shield,
   LayoutTemplate,
   Hospital,
   Plus,
   Mail,
   Loader2,
   X,
   CheckCircle2,
   MapPin,
   ClipboardList,
   ChevronLeft,
   ChevronRight,
   Search,
   KeyRound,
 } from 'lucide-react';
 import { useQuery, useQueryClient } from '@tanstack/react-query';
 import { api } from '@/lib/api';

 export default function AdminSettingsPage() {
   const queryClient = useQueryClient();
   const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [resettingUserId, setResettingUserId] = useState<string | null>(null);
   const [deactivatingUserId, setDeactivatingUserId] = useState<string | null>(null);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [templateDraftName, setTemplateDraftName] = useState('');
  const [templateDraftFields, setTemplateDraftFields] = useState<Array<any>>([
    { key: 'risk', label: 'Overall risk', type: 'select', required: true, options: ['Low', 'Medium', 'High'] },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]);
  const [templateDraftAdvanced, setTemplateDraftAdvanced] = useState(false);
  const [templateDraftJson, setTemplateDraftJson] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string>('');
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateFields, setEditTemplateFields] = useState<Array<any>>([]);
  const [editTemplateAdvanced, setEditTemplateAdvanced] = useState(false);
  const [editTemplateJson, setEditTemplateJson] = useState('');
  const [editTemplateActive, setEditTemplateActive] = useState(true);
  const [editTemplateBumpVersion, setEditTemplateBumpVersion] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
   const [inviteForm, setInviteForm] = useState({
     email: '',
     firstName: '',
     lastName: '',
     role: 'Carer',
     homeScopeId: 'ALL'
   });

   const auditLimit = 25;
   const [auditOffset, setAuditOffset] = useState(0);
   const [auditActionDraft, setAuditActionDraft] = useState('');
   const [auditFromDraft, setAuditFromDraft] = useState('');
   const [auditToDraft, setAuditToDraft] = useState('');
   const [auditAction, setAuditAction] = useState('');
   const [auditFrom, setAuditFrom] = useState('');
   const [auditTo, setAuditTo] = useState('');

   const {
     data: auditData,
     isLoading: auditLoading,
     isError: auditIsError,
     error: auditQueryError,
     refetch: refetchAudit,
   } = useQuery({
     queryKey: ['admin-audit-logs', auditOffset, auditLimit, auditAction, auditFrom, auditTo],
     queryFn: async () => {
       const params = new URLSearchParams();
       params.set('limit', String(auditLimit));
       params.set('offset', String(auditOffset));
       if (auditAction.trim()) params.set('action', auditAction.trim());
       if (auditFrom.trim()) params.set('from', auditFrom.trim());
       if (auditTo.trim()) params.set('to', auditTo.trim());
       const { data } = await api.get(`/api/v1/admin/audit-logs?${params.toString()}`);
       return data as {
         total: number;
         limit: number;
         offset: number;
         items: Array<{
           id: string;
           occurred_at: string;
           actor_email: string | null;
           actor_role: string | null;
           action: string;
           resource_type: string | null;
           resource_id: string | null;
           outcome: string;
           request_path?: string | null;
           metadata?: Record<string, unknown> | null;
         }>;
       };
     },
     staleTime: 30_000,
   });

   const applyAuditFilters = () => {
     setAuditAction(auditActionDraft.trim());
     setAuditFrom(auditFromDraft.trim());
     setAuditTo(auditToDraft.trim());
     setAuditOffset(0);
   };

   const auditTotal = auditData?.total ?? 0;
   const auditHasPrev = auditOffset > 0;
   const auditHasNext = auditOffset + auditLimit < auditTotal;
   const auditErrData = auditQueryError as { response?: { data?: { error?: string; requestId?: string } } } | undefined;

   // Fetch Homes for the scope dropdown
   const { data: layoutData } = useQuery({
     queryKey: ['facility-layout'],
     queryFn: async () => {
       const { data } = await api.get('/api/v1/facility-layout');
       return data;
     }
   });

   // Align with Sidebar scope options; facility-layout may not include a `homes` list yet
   const DEFAULT_HOMES = [
     { id: '11111111-1111-1111-1111-111111111111', name: 'Watson House' },
     { id: '22222222-2222-2222-2222-222222222222', name: 'Mariners Court' },
     { id: '33333333-3333-3333-3333-333333333333', name: 'Redbricks' },
   ];
   const apiHomes = layoutData?.homes;
   const homes =
     Array.isArray(apiHomes) && apiHomes.length > 0 ? apiHomes : DEFAULT_HOMES;

   // Fetch existing users from the backend (no mock list — fake “Regional Manager” rows confused sign-in debugging)
   const {
     data: users,
     isLoading: usersLoading,
     isError: usersError,
     error: usersQueryError,
   } = useQuery({
     queryKey: ['admin-users'],
     queryFn: async () => {
       const { data } = await api.get('/api/v1/admin/users');
       return data as Array<{
         id: string;
         first_name: string;
         last_name: string;
         email: string;
         system_role: string;
         home_scope_id: string | null;
         is_active: boolean;
       }>;
     },
   });
   const usersErrMsg =
     usersQueryError && typeof usersQueryError === 'object' && 'response' in usersQueryError
       ? (usersQueryError as { response?: { data?: { error?: string } } }).response?.data?.error
       : null;

   const handleInvite = async (e: React.FormEvent) => {
     e.preventDefault();
     setIsSubmitting(true);
     try {
       // In production, this hits our secure Node API which uses the Supabase Admin Auth Client
       await api.post('/api/v1/admin/users/invite', inviteForm);
       alert('Staff member invited successfully! They will receive an email to set their password.');
       setIsInviteModalOpen(false);
       setInviteForm({ email: '', firstName: '', lastName: '', role: 'Carer', homeScopeId: 'ALL' });
       await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
     } catch (error: any) {
       console.error(error);
       alert('Note: This requires the backend endpoint to be configured first to send the Supabase invite email. (UI preview successful)');
       setIsInviteModalOpen(false);
     } finally {
       setIsSubmitting(false);
     }
   };

   const handleDeactivateUser = async (userId: string, displayName: string) => {
     if (
       !window.confirm(
         `Revoke access for ${displayName}? They will no longer be able to sign in to DCRS.`
       )
     ) {
       return;
     }
     setDeactivatingUserId(userId);
     try {
       const { data } = await api.post<{ message?: string }>(
         `/api/v1/admin/users/${userId}/deactivate`
       );
       alert(data?.message || 'Access revoked.');
       await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
       await queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
     } catch (error: unknown) {
       console.error(error);
       const msg =
         typeof error === 'object' &&
         error !== null &&
         'response' in error &&
         typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error ===
           'string'
           ? (error as { response: { data: { error: string } } }).response.data.error
           : 'Could not revoke access.';
       alert(msg);
     } finally {
       setDeactivatingUserId(null);
     }
   };

   const handleResetPassword = async (userId: string) => {
     if (!window.confirm('Send a password reset link to this user’s email?')) return;
     setResettingUserId(userId);
     try {
       const { data } = await api.post<{ message?: string }>(
         `/api/v1/admin/users/${userId}/reset-password`
       );
       alert(data?.message || 'Password reset link sent to their email.');
       await queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
     } catch (error: unknown) {
       console.error(error);
       const msg =
         typeof error === 'object' &&
         error !== null &&
         'response' in error &&
         typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error ===
           'string'
           ? (error as { response: { data: { error: string } } }).response.data.error
           : 'Could not send password reset. You need Regional Manager or Admin access.';
       alert(msg);
     } finally {
       setResettingUserId(null);
     }
   };

  const { data: templatesData, isLoading: templatesLoading, isError: templatesIsError, error: templatesQueryError } =
    useQuery({
      queryKey: ['assessment-templates-admin'],
      queryFn: async () => {
        const { data } = await api.get('/api/v1/assessment-templates');
        return data as {
          templates: Array<{
            id: string;
            name: string;
            version: number;
            is_active: boolean;
            schema_json: any;
            updated_at: string;
          }>;
        };
      },
      staleTime: 30_000,
    });

  const templatesErrMsg =
    templatesQueryError && typeof templatesQueryError === 'object' && 'response' in templatesQueryError
      ? (templatesQueryError as { response?: { data?: { error?: string } } }).response?.data?.error
      : null;

  const normalizeFieldsToSchema = (fields: Array<any>) => {
    const safe = Array.isArray(fields) ? fields : [];
    const cleaned = safe
      .map((f) => {
        const key = typeof f?.key === 'string' ? f.key.trim() : '';
        if (!key) return null;
        const type = typeof f?.type === 'string' ? f.type.trim() : 'text';
        const out: any = {
          key,
          label: typeof f?.label === 'string' && f.label.trim() ? f.label.trim() : key,
          type,
        };
        if (f.required === true) out.required = true;
        if (type === 'select') {
          const opts = Array.isArray(f.options) ? f.options : [];
          out.options = opts
            .map((o: any) => (o && typeof o === 'object' ? { label: o.label ?? o.value, value: o.value ?? o.label } : o))
            .filter((o: any) => (typeof o === 'string' ? o.trim() !== '' : o?.value != null));
        }
        if (type === 'number') {
          if (f.min !== '' && f.min != null && Number.isFinite(Number(f.min))) out.min = Number(f.min);
          if (f.max !== '' && f.max != null && Number.isFinite(Number(f.max))) out.max = Number(f.max);
        } else {
          if (f.minLength !== '' && f.minLength != null && Number.isFinite(Number(f.minLength))) out.minLength = Number(f.minLength);
          if (f.maxLength !== '' && f.maxLength != null && Number.isFinite(Number(f.maxLength))) out.maxLength = Number(f.maxLength);
          if (typeof f.pattern === 'string' && f.pattern.trim()) out.pattern = f.pattern.trim();
        }
        return out;
      })
      .filter(Boolean);
    return { fields: cleaned };
  };

  const schemaToEditableFields = (schema: any) => {
    const fields = Array.isArray(schema?.fields) ? schema.fields : [];
    return fields.map((f: any) => ({
      key: String(f?.key ?? ''),
      label: String(f?.label ?? ''),
      type: String(f?.type ?? 'text'),
      required: Boolean(f?.required),
      options: Array.isArray(f?.options)
        ? f.options.map((o: any) => (o && typeof o === 'object' ? String(o.value ?? o.label ?? '') : String(o)))
        : [],
      min: f?.min ?? '',
      max: f?.max ?? '',
      minLength: f?.minLength ?? '',
      maxLength: f?.maxLength ?? '',
      pattern: f?.pattern ?? '',
    }));
  };

  useEffect(() => {
    setTemplateDraftJson(JSON.stringify(normalizeFieldsToSchema(templateDraftFields), null, 2));
  }, [templateDraftFields]);

  useEffect(() => {
    setEditTemplateJson(JSON.stringify(normalizeFieldsToSchema(editTemplateFields), null, 2));
  }, [editTemplateFields]);

  const createTemplate = async () => {
    const name = templateDraftName.trim();
    if (!name) return;
    let schema: any = null;
    try {
      schema = templateDraftAdvanced ? JSON.parse(templateDraftJson) : normalizeFieldsToSchema(templateDraftFields);
    } catch {
      alert('Template schema must be valid JSON.');
      return;
    }
    setCreatingTemplate(true);
    try {
      await api.post('/api/v1/assessment-templates', { name, schemaJson: schema });
      setTemplateDraftName('');
      setTemplateDraftFields([
        { key: 'risk', label: 'Overall risk', type: 'select', required: true, options: ['Low', 'Medium', 'High'] },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]);
      setTemplateDraftAdvanced(false);
      await queryClient.invalidateQueries({ queryKey: ['assessment-templates-admin'] });
      alert('Template created.');
    } catch (e) {
      console.error(e);
      alert('Could not create template. Check your permissions.');
    } finally {
      setCreatingTemplate(false);
    }
  };

  useEffect(() => {
    const list = templatesData?.templates || [];
    if (!editingTemplateId) return;
    const t = list.find((x) => x.id === editingTemplateId);
    if (!t) return;
    setEditTemplateName(t.name || '');
    setEditTemplateFields(schemaToEditableFields(t.schema_json ?? { fields: [] }));
    setEditTemplateAdvanced(false);
    setEditTemplateActive(Boolean(t.is_active));
    setEditTemplateBumpVersion(true);
  }, [editingTemplateId, templatesData?.templates]);

  const saveTemplateEdits = async () => {
    if (!editingTemplateId) return;
    const name = editTemplateName.trim();
    if (!name) return;
    let schema: any = null;
    try {
      schema = editTemplateAdvanced ? JSON.parse(editTemplateJson) : normalizeFieldsToSchema(editTemplateFields);
    } catch {
      alert('Template schema must be valid JSON.');
      return;
    }
    setSavingTemplate(true);
    try {
      await api.patch(`/api/v1/assessment-templates/${editingTemplateId}`, {
        name,
        schemaJson: schema,
        isActive: editTemplateActive,
        bumpVersion: editTemplateBumpVersion,
      });
      await queryClient.invalidateQueries({ queryKey: ['assessment-templates-admin'] });
      alert('Template updated.');
    } catch (e) {
      console.error(e);
      alert('Could not update template. Check your permissions.');
    } finally {
      setSavingTemplate(false);
    }
  };

   return (
     <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in pb-20">
       
       {/* Header */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
         <div>
           <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
           <p className="text-gray-500">Manage users, integrations, and clinical templates.</p>
         </div>
         <button 
           onClick={() => setIsInviteModalOpen(true)} 
           className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm text-sm transition-colors"
         >
           <Plus className="w-4 h-4 mr-2" /> Invite Staff
         </button>
       </div>

       {/* User Management Section */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-slate-50">
           <div>
             <h3 className="text-lg font-bold text-gray-900 flex items-center">
               <Users className="w-5 h-5 mr-2 text-blue-600" /> User Management
             </h3>
             <p className="text-sm text-gray-500 mt-1">
               Manage staff access levels, roles, and home assignments. The table reflects the{' '}
               <span className="font-medium text-gray-700">DCRS database</span> (not only Supabase), so someone removed
               from Supabase can still show as Active until you use <span className="font-medium text-gray-700">Revoke</span>.
               After an invite, use <span className="font-medium text-gray-700">Reset password</span> if they need the email again.
             </p>
           </div>
         </div>
         
         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm border-collapse">
             <thead className="bg-white text-gray-500 border-b border-gray-200">
               <tr>
                 <th className="p-4 font-medium">Staff Member</th>
                 <th className="p-4 font-medium">System Role</th>
                 <th className="p-4 font-medium">Location Scope</th>
                 <th className="p-4 font-medium">Status</th>
                 <th className="p-4 font-medium text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {usersLoading ? (
                 <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></td></tr>
               ) : usersError ? (
                 <tr>
                   <td colSpan={5} className="p-8 text-center text-sm text-rose-700 bg-rose-50/50">
                     <p className="font-medium">Could not load staff directory.</p>
                     <p className="mt-1 text-rose-600">{usersErrMsg || 'Check that you are signed in as Regional Manager or Admin.'}</p>
                   </td>
                 </tr>
               ) : (
                 users?.map((u: any) => {
                   const scopeName = u.home_scope_id 
                     ? homes.find((h: any) => h.id === u.home_scope_id)?.name || 'Unknown Home'
                     : 'Group Wide (All Homes)';
                   
                   return (
                     <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                       <td className="p-4">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                             {(u.first_name || '?')[0]}
                             {(u.last_name || '?')[0]}
                           </div>
                           <div>
                             <div className="font-semibold text-gray-900">{u.first_name} {u.last_name}</div>
                             <div className="text-xs text-gray-500">{u.email}</div>
                           </div>
                         </div>
                       </td>
                       <td className="p-4">
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                           <Shield className="w-3 h-3 mr-1" /> {u.system_role}
                         </span>
                       </td>
                       <td className="p-4 text-gray-600">
                         <div className="flex items-center">
                           <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                           {scopeName}
                         </div>
                       </td>
                       <td className="p-4">
                         {u.is_active ? (
                           <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-emerald-700 bg-emerald-50">
                             <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                           </span>
                         ) : (
                           <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-rose-700 bg-rose-50">
                             <X className="w-3 h-3 mr-1" /> Inactive
                           </span>
                         )}
                       </td>
                       <td className="p-4 text-right">
                         <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                           {u.is_active ? (
                             <button
                               type="button"
                               onClick={() => void handleResetPassword(String(u.id))}
                               disabled={resettingUserId === String(u.id)}
                               className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 text-xs font-medium transition-colors disabled:opacity-50"
                               title="Sends Supabase password recovery email"
                             >
                               {resettingUserId === String(u.id) ? (
                                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
                               ) : (
                                 <KeyRound className="w-3.5 h-3.5" />
                               )}
                               Reset password
                             </button>
                           ) : null}
                           <button
                             type="button"
                             className="text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                           >
                             Edit
                           </button>
                           {u.is_active ? (
                             <button
                               type="button"
                               onClick={() =>
                                 void handleDeactivateUser(
                                   String(u.id),
                                   `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email
                                 )
                               }
                               disabled={deactivatingUserId === String(u.id)}
                               className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 text-xs font-medium transition-colors disabled:opacity-50"
                             >
                               {deactivatingUserId === String(u.id) ? (
                                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
                               ) : null}
                               Revoke
                             </button>
                           ) : (
                             <span className="text-xs text-gray-400">Revoked</span>
                           )}
                         </div>
                       </td>
                     </tr>
                   );
                 })
               )}
             </tbody>
           </table>
         </div>
       </div>

       {/* Audit trail (governance) */}
       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 bg-slate-50">
           <div>
             <h3 className="text-lg font-bold text-gray-900 flex items-center">
               <ClipboardList className="w-5 h-5 mr-2 text-slate-600" /> Audit trail
             </h3>
             <p className="text-sm text-gray-500 mt-1">
               Recent security and clinical actions (Regional Manager / Admin). Use filters to narrow by action or date range.
             </p>
           </div>
           <button
             type="button"
             onClick={() => void refetchAudit()}
             className="shrink-0 text-sm font-medium text-slate-700 border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
           >
             Refresh
           </button>
         </div>

         <div className="p-4 border-b border-gray-100 bg-white flex flex-col lg:flex-row gap-3 lg:items-end">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
             <div>
               <label className="block text-xs font-semibold text-gray-600 mb-1">Action (exact)</label>
               <input
                 type="text"
                 placeholder="e.g. RESIDENT_RECORD_VIEW"
                 value={auditActionDraft}
                 onChange={(e) => setAuditActionDraft(e.target.value)}
                 className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
             <div>
               <label className="block text-xs font-semibold text-gray-600 mb-1">From (ISO date)</label>
               <input
                 type="datetime-local"
                 value={auditFromDraft}
                 onChange={(e) => setAuditFromDraft(e.target.value)}
                 className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
             <div>
               <label className="block text-xs font-semibold text-gray-600 mb-1">To (ISO date)</label>
               <input
                 type="datetime-local"
                 value={auditToDraft}
                 onChange={(e) => setAuditToDraft(e.target.value)}
                 className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
               />
             </div>
           </div>
           <button
             type="button"
             onClick={applyAuditFilters}
             className="inline-flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
           >
             <Search className="w-4 h-4" /> Apply filters
           </button>
         </div>

         {auditIsError && (
           <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 text-sm text-rose-800">
             <p className="font-medium">Unable to load audit trail.</p>
             <p className="mt-1 text-rose-700">
               {auditErrData?.response?.data?.error || 'Check that your account has admin access and the audit table exists.'}
             </p>
             {auditErrData?.response?.data?.requestId && (
               <p className="mt-2 text-xs font-mono text-rose-900">
                 Request ID: {auditErrData.response.data.requestId}
               </p>
             )}
           </div>
         )}

         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm border-collapse min-w-[720px]">
             <thead className="bg-white text-gray-500 border-b border-gray-200">
               <tr>
                 <th className="p-3 font-medium whitespace-nowrap">Time (UTC)</th>
                 <th className="p-3 font-medium">Actor</th>
                 <th className="p-3 font-medium">Action</th>
                 <th className="p-3 font-medium">Resource</th>
                 <th className="p-3 font-medium">Outcome</th>
                 <th className="p-3 font-medium min-w-[140px]">Details</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {auditLoading ? (
                 <tr>
                   <td colSpan={6} className="p-8 text-center">
                     <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                   </td>
                 </tr>
               ) : auditIsError ? (
                 <tr>
                   <td colSpan={6} className="p-6 text-center text-gray-500 text-sm">
                     No rows to display.
                   </td>
                 </tr>
               ) : !auditData?.items?.length ? (
                 <tr>
                   <td colSpan={6} className="p-6 text-center text-gray-500 text-sm">
                     No audit entries for this page. Adjust filters or confirm the database migration has been applied.
                   </td>
                 </tr>
               ) : (
                 auditData.items.map((row) => (
                   <tr key={row.id} className="hover:bg-slate-50 align-top">
                     <td className="p-3 text-gray-700 whitespace-nowrap text-xs">
                       {row.occurred_at
                         ? new Date(row.occurred_at).toISOString().replace('T', ' ').slice(0, 19)
                         : '—'}
                     </td>
                     <td className="p-3">
                       <div className="text-gray-900 text-xs font-medium">{row.actor_email || '—'}</div>
                       <div className="text-gray-500 text-xs">{row.actor_role || ''}</div>
                     </td>
                     <td className="p-3 text-gray-800 font-mono text-xs">{row.action}</td>
                     <td className="p-3 text-xs text-gray-600">
                       <div>{row.resource_type || '—'}</div>
                       <div className="text-gray-400 truncate max-w-[180px]" title={row.resource_id || ''}>
                         {row.resource_id || ''}
                       </div>
                     </td>
                     <td className="p-3">
                       <span
                         className={
                           row.outcome === 'SUCCESS'
                             ? 'inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100'
                             : 'inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-900 border border-amber-100'
                         }
                       >
                         {row.outcome}
                       </span>
                     </td>
                     <td className="p-3 text-xs text-gray-500 font-mono max-w-[220px] break-all">
                       {row.metadata != null ? JSON.stringify(row.metadata) : '—'}
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
         </div>

         <div className="p-4 border-t border-gray-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
           <span>
             Showing{' '}
             <span className="font-semibold text-gray-900">
               {auditTotal === 0 ? 0 : auditOffset + 1}–{Math.min(auditOffset + auditLimit, auditTotal)}
             </span>{' '}
             of <span className="font-semibold text-gray-900">{auditTotal}</span>
           </span>
           <div className="flex items-center gap-2">
             <button
               type="button"
               disabled={!auditHasPrev || auditLoading}
               onClick={() => setAuditOffset((o) => Math.max(0, o - auditLimit))}
               className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
             >
               <ChevronLeft className="w-4 h-4" /> Previous
             </button>
             <button
               type="button"
               disabled={!auditHasNext || auditLoading}
               onClick={() => setAuditOffset((o) => o + auditLimit)}
               className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
             >
               Next <ChevronRight className="w-4 h-4" />
             </button>
           </div>
         </div>
       </div>

       {/* NHS Integrations & Templates Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="p-6 border-b border-gray-200 bg-slate-50">
             <h3 className="text-lg font-bold text-gray-900 flex items-center">
               <Hospital className="w-5 h-5 mr-2 text-indigo-600" /> NHS Integrations
             </h3>
             <p className="text-sm text-gray-500 mt-1">Configure connections to external health systems.</p>
           </div>
           <div className="p-6 space-y-4">
             <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
               <div>
                 <h4 className="font-bold text-gray-900">IM1 / GP Connect</h4>
                 <p className="text-xs text-gray-600 mt-1">Import medication records directly from the NHS Spine.</p>
               </div>
               <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 shrink-0 ml-4">Connected</span>
             </div>
             <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
               <div>
                 <h4 className="font-bold text-gray-900">NRL (National Record Locator)</h4>
                 <p className="text-xs text-gray-600 mt-1">Locate crisis plans and end-of-life care records.</p>
               </div>
               <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium shrink-0 ml-4 transition-colors">Configure</button>
             </div>
           </div>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="p-6 border-b border-gray-200 bg-slate-50">
             <h3 className="text-lg font-bold text-gray-900 flex items-center">
               <LayoutTemplate className="w-5 h-5 mr-2 text-amber-600" /> Clinical Templates
             </h3>
             <p className="text-sm text-gray-500 mt-1">Customize the structure of care plans and assessment forms.</p>
           </div>
           <div className="p-6">
             <p className="text-sm text-gray-600 mb-4 leading-relaxed">
               Use the template builder to modify standard assessments like MUST, Waterlow, and daily care routines to fit your organization's specific policies.
             </p>
            <button
              type="button"
              onClick={() => setIsTemplatesModalOpen(true)}
              className="text-amber-600 hover:text-amber-800 font-medium text-sm flex items-center transition-colors"
            >
              Manage assessment templates &rarr;
             </button>
           </div>
         </div>
       </div>

      {/* Assessment Templates Modal */}
      {isTemplatesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Assessment templates</h3>
                <p className="text-xs text-gray-500">
                  V1 uses a JSON schema. Create templates for MUST, falls risk, Waterlow, etc.
                </p>
              </div>
              <button onClick={() => setIsTemplatesModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900">Create template</h4>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                  <input
                    value={templateDraftName}
                    onChange={(e) => setTemplateDraftName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. MUST (Malnutrition)"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-xs font-semibold text-gray-600">Fields</label>
                    <button
                      type="button"
                      onClick={() => setTemplateDraftAdvanced((v) => !v)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      {templateDraftAdvanced ? 'Use visual builder' : 'Advanced (JSON)'}
                    </button>
                  </div>

                  {templateDraftAdvanced ? (
                    <textarea
                      value={templateDraftJson}
                      onChange={(e) => setTemplateDraftJson(e.target.value)}
                      rows={12}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                    />
                  ) : (
                    <div className="mt-2 space-y-3">
                      {(templateDraftFields || []).map((f, idx) => (
                        <div key={`${idx}-${String(f.key || '')}`} className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Key</label>
                              <input
                                value={f.key ?? ''}
                                onChange={(e) =>
                                  setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. bmi"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Label</label>
                              <input
                                value={f.label ?? ''}
                                onChange={(e) =>
                                  setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. BMI"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Type</label>
                              <select
                                value={f.type ?? 'text'}
                                onChange={(e) =>
                                  setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x)))
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="text">Text</option>
                                <option value="textarea">Textarea</option>
                                <option value="number">Number</option>
                                <option value="select">Select</option>
                                <option value="checkbox">Checkbox</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(f.required)}
                                  onChange={(e) =>
                                    setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)))
                                  }
                                />
                                Required
                              </label>
                            </div>
                          </div>

                          {String(f.type || 'text') === 'select' ? (
                            <div className="mt-3">
                              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Options (comma-separated)</label>
                              <input
                                value={Array.isArray(f.options) ? f.options.join(', ') : ''}
                                onChange={(e) =>
                                  setTemplateDraftFields((p) =>
                                    p.map((x, i) =>
                                      i === idx ? { ...x, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x
                                    )
                                  )
                                }
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Low, Medium, High"
                              />
                            </div>
                          ) : null}

                          {String(f.type || 'text') === 'number' ? (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Min</label>
                                <input
                                  type="number"
                                  value={f.min ?? ''}
                                  onChange={(e) =>
                                    setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, min: e.target.value } : x)))
                                  }
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max</label>
                                <input
                                  type="number"
                                  value={f.max ?? ''}
                                  onChange={(e) =>
                                    setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, max: e.target.value } : x)))
                                  }
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          ) : null}

                          {String(f.type || 'text') !== 'number' && String(f.type || 'text') !== 'checkbox' ? (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Min length</label>
                                <input
                                  type="number"
                                  value={f.minLength ?? ''}
                                  onChange={(e) =>
                                    setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, minLength: e.target.value } : x)))
                                  }
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max length</label>
                                <input
                                  type="number"
                                  value={f.maxLength ?? ''}
                                  onChange={(e) =>
                                    setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, maxLength: e.target.value } : x)))
                                  }
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Pattern (regex)</label>
                                <input
                                  value={f.pattern ?? ''}
                                  onChange={(e) =>
                                    setTemplateDraftFields((p) => p.map((x, i) => (i === idx ? { ...x, pattern: e.target.value } : x)))
                                  }
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="^\\d+$"
                                />
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setTemplateDraftFields((p) => {
                                    if (idx === 0) return p;
                                    const next = [...p];
                                    const tmp = next[idx - 1];
                                    next[idx - 1] = next[idx];
                                    next[idx] = tmp;
                                    return next;
                                  })
                                }
                                disabled={idx === 0}
                                className="text-xs font-semibold text-slate-700 border border-gray-300 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setTemplateDraftFields((p) => {
                                    if (idx === p.length - 1) return p;
                                    const next = [...p];
                                    const tmp = next[idx + 1];
                                    next[idx + 1] = next[idx];
                                    next[idx] = tmp;
                                    return next;
                                  })
                                }
                                disabled={idx === templateDraftFields.length - 1}
                                className="text-xs font-semibold text-slate-700 border border-gray-300 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                Down
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTemplateDraftFields((p) => p.filter((_, i) => i !== idx))}
                              className="text-xs font-semibold text-rose-700 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          setTemplateDraftFields((p) => [
                            ...p,
                            { key: '', label: '', type: 'text', required: false, options: [], min: '', max: '', minLength: '', maxLength: '', pattern: '' },
                          ])
                        }
                        className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        + Add field
                      </button>

                      <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
                          Generated schema JSON (read-only preview)
                        </summary>
                        <pre className="mt-2 text-[11px] text-gray-700 overflow-auto whitespace-pre-wrap">
                          {templateDraftJson}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void createTemplate()}
                    disabled={creatingTemplate || !templateDraftName.trim()}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creatingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Create
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900">Existing templates</h4>
                {templatesLoading ? (
                  <div className="p-6 text-center text-gray-500">Loading templates…</div>
                ) : templatesIsError ? (
                  <div className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg">
                    {templatesErrMsg || 'Could not load templates.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="divide-y divide-gray-100">
                        {(templatesData?.templates || []).length === 0 ? (
                          <div className="p-5 text-sm text-gray-500">No templates yet.</div>
                        ) : (
                          (templatesData?.templates || []).map((t) => (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() => setEditingTemplateId(t.id)}
                              className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                                editingTemplateId === t.id ? 'bg-blue-50/40' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 text-sm truncate">
                                    {t.name}{' '}
                                    <span className="text-xs font-medium text-gray-500">(v{t.version})</span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {t.is_active ? 'Active' : 'Inactive'} • Updated{' '}
                                    {t.updated_at ? new Date(t.updated_at).toLocaleString() : '—'}
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-blue-700">Edit</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {editingTemplateId ? (
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-white">
                          <div className="text-sm font-semibold text-gray-900">Edit selected template</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Changes require Deputy Manager or Home Manager access.
                          </div>
                        </div>
                        <div className="p-4 space-y-3 bg-slate-50/30">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                            <input
                              value={editTemplateName}
                              onChange={(e) => setEditTemplateName(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={editTemplateActive}
                                onChange={(e) => setEditTemplateActive(e.target.checked)}
                              />
                              Active
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={editTemplateBumpVersion}
                                onChange={(e) => setEditTemplateBumpVersion(e.target.checked)}
                              />
                              Bump version on save
                            </label>
                          </div>
                          <div>
                            <div className="flex items-center justify-between gap-3">
                              <label className="block text-xs font-semibold text-gray-600">Fields</label>
                              <button
                                type="button"
                                onClick={() => setEditTemplateAdvanced((v) => !v)}
                                className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                              >
                                {editTemplateAdvanced ? 'Use visual builder' : 'Advanced (JSON)'}
                              </button>
                            </div>

                            {editTemplateAdvanced ? (
                              <textarea
                                value={editTemplateJson}
                                onChange={(e) => setEditTemplateJson(e.target.value)}
                                rows={10}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                              />
                            ) : (
                              <div className="mt-2 space-y-3">
                                {(editTemplateFields || []).map((f, idx) => (
                                  <div key={`${idx}-${String(f.key || '')}`} className="rounded-lg border border-gray-200 bg-white p-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Key</label>
                                        <input
                                          value={f.key ?? ''}
                                          onChange={(e) =>
                                            setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))
                                          }
                                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Label</label>
                                        <input
                                          value={f.label ?? ''}
                                          onChange={(e) =>
                                            setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                                          }
                                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Type</label>
                                        <select
                                          value={f.type ?? 'text'}
                                          onChange={(e) =>
                                            setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x)))
                                          }
                                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                          <option value="text">Text</option>
                                          <option value="textarea">Textarea</option>
                                          <option value="number">Number</option>
                                          <option value="select">Select</option>
                                          <option value="checkbox">Checkbox</option>
                                        </select>
                                      </div>
                                      <div className="flex items-end">
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(f.required)}
                                            onChange={(e) =>
                                              setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)))
                                            }
                                          />
                                          Required
                                        </label>
                                      </div>
                                    </div>

                                    {String(f.type || 'text') === 'select' ? (
                                      <div className="mt-3">
                                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Options (comma-separated)</label>
                                        <input
                                          value={Array.isArray(f.options) ? f.options.join(', ') : ''}
                                          onChange={(e) =>
                                            setEditTemplateFields((p) =>
                                              p.map((x, i) =>
                                                i === idx ? { ...x, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x
                                              )
                                            )
                                          }
                                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                      </div>
                                    ) : null}

                                    {String(f.type || 'text') === 'number' ? (
                                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Min</label>
                                          <input
                                            type="number"
                                            value={f.min ?? ''}
                                            onChange={(e) =>
                                              setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, min: e.target.value } : x)))
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max</label>
                                          <input
                                            type="number"
                                            value={f.max ?? ''}
                                            onChange={(e) =>
                                              setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, max: e.target.value } : x)))
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                      </div>
                                    ) : null}

                                    {String(f.type || 'text') !== 'number' && String(f.type || 'text') !== 'checkbox' ? (
                                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Min length</label>
                                          <input
                                            type="number"
                                            value={f.minLength ?? ''}
                                            onChange={(e) =>
                                              setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, minLength: e.target.value } : x)))
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max length</label>
                                          <input
                                            type="number"
                                            value={f.maxLength ?? ''}
                                            onChange={(e) =>
                                              setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, maxLength: e.target.value } : x)))
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">Pattern (regex)</label>
                                          <input
                                            value={f.pattern ?? ''}
                                            onChange={(e) =>
                                              setEditTemplateFields((p) => p.map((x, i) => (i === idx ? { ...x, pattern: e.target.value } : x)))
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                      </div>
                                    ) : null}

                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditTemplateFields((p) => {
                                              if (idx === 0) return p;
                                              const next = [...p];
                                              const tmp = next[idx - 1];
                                              next[idx - 1] = next[idx];
                                              next[idx] = tmp;
                                              return next;
                                            })
                                          }
                                          disabled={idx === 0}
                                          className="text-xs font-semibold text-slate-700 border border-gray-300 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                        >
                                          Up
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditTemplateFields((p) => {
                                              if (idx === p.length - 1) return p;
                                              const next = [...p];
                                              const tmp = next[idx + 1];
                                              next[idx + 1] = next[idx];
                                              next[idx] = tmp;
                                              return next;
                                            })
                                          }
                                          disabled={idx === editTemplateFields.length - 1}
                                          className="text-xs font-semibold text-slate-700 border border-gray-300 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                        >
                                          Down
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setEditTemplateFields((p) => p.filter((_, i) => i !== idx))}
                                        className="text-xs font-semibold text-rose-700 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditTemplateFields((p) => [
                                      ...p,
                                      { key: '', label: '', type: 'text', required: false, options: [], min: '', max: '', minLength: '', maxLength: '', pattern: '' },
                                    ])
                                  }
                                  className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  + Add field
                                </button>

                                <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                  <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
                                    Generated schema JSON (read-only preview)
                                  </summary>
                                  <pre className="mt-2 text-[11px] text-gray-700 overflow-auto whitespace-pre-wrap">
                                    {editTemplateJson}
                                  </pre>
                                </details>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingTemplateId('')}
                              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                            >
                              Clear selection
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveTemplateEdits()}
                              disabled={savingTemplate || !editTemplateName.trim()}
                              className="inline-flex items-center rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                            >
                              {savingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                              Save changes
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setIsTemplatesModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Invite Staff Modal */}
       {isInviteModalOpen && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
             <div className="p-5 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
               <div>
                 <h3 className="font-bold text-lg text-gray-900">Invite New Staff Member</h3>
                 <p className="text-xs text-gray-500">
                   They will receive an email to set their password. If it does not arrive, use{' '}
                   <strong>Reset password</strong> next to their name in User Management.
                 </p>
               </div>
               <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             <form onSubmit={handleInvite}>
               <div className="p-5 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                     <input 
                       type="text" required
                       value={inviteForm.firstName} onChange={e => setInviteForm({...inviteForm, firstName: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                     <input 
                       type="text" required
                       value={inviteForm.lastName} onChange={e => setInviteForm({...inviteForm, lastName: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                     />
                   </div>
                 </div>

                 <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                   <div className="relative">
                     <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                     <input 
                       type="email" required placeholder="name@carehome.com"
                       value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                       className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                     />
                   </div>
                 </div>

                 <div className="border-t border-gray-100 pt-4 mt-4">
                   <label className="block text-xs font-semibold text-gray-600 mb-1">System Role (RBAC)</label>
                   <select 
                     value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                   >
                    <option value="Carer">Carer (Basic Access)</option>
                    <option value="Senior Carer">Senior Carer (Shift Lead)</option>
                    <option value="Nurse">Nurse (Clinical Updates)</option>
                    <option value="Deputy Manager">Deputy Manager (Management)</option>
                    <option value="Home Manager">Home Manager (Management)</option>
                    <option value="Regional Manager">Regional Manager (Group Admin)</option>
                   </select>
                 </div>

                 <div>
                   <label className="block text-xs font-semibold text-gray-600 mb-1">Location Scope / Access</label>
                   <select 
                     value={inviteForm.homeScopeId} onChange={e => setInviteForm({...inviteForm, homeScopeId: e.target.value})}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                   >
                     <option value="ALL">Group Wide (All Homes)</option>
                     {homes.map((h: any) => (
                       <option key={h.id} value={h.id}>{h.name}</option>
                     ))}
                   </select>
                   <p className="text-xs text-gray-500 mt-1.5">
                     If assigned to a specific home, this user will not be able to view or edit residents from other locations.
                   </p>
                 </div>
               </div>

               <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-slate-50">
                 <button type="button" onClick={() => setIsInviteModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                   Cancel
                 </button>
                 <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center">
                   {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />} 
                   Send Invitation
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}
     </div>
   );
 }
