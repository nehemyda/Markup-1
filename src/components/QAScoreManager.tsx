import React, { useState, useMemo } from 'react';
import { 
  Project, 
  Pin, 
  QARubricRule, 
  QACategoryName, 
  Teammate,
  ViewMode 
} from '../types';
import { CATEGORY_COLORS } from '../data/qaRubricData';
import { 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  FileSpreadsheet, 
  TrendingUp, 
  Sparkles, 
  Copy, 
  ChevronRight, 
  LayoutGrid, 
  Users, 
  Archive, 
  Settings, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  BarChart3,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';

interface QAScoreManagerProps {
  projects: Project[];
  pins: Pin[];
  teammates?: Teammate[];
  rubricRules: QARubricRule[];
  onUpdateRubricRules: (rules: QARubricRule[]) => void;
  onUpdatePinQAError?: (pinId: string, qaError?: Pin['qaError']) => void;
  currentUser: Teammate;
  onSelectProject?: (project: Project) => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onNavigateTab?: (tab: 'dashboard' | 'archive' | 'team' | 'settings') => void;
}

export const QAScoreManager: React.FC<QAScoreManagerProps> = ({
  projects,
  pins,
  teammates = [],
  rubricRules,
  onUpdateRubricRules,
  onUpdatePinQAError,
  currentUser,
  onSelectProject,
  onViewModeChange,
  onNavigateTab
}) => {
  const [activeTab, setActiveTab] = useState<'member_scores' | 'project_scores' | 'rubric_settings' | 'analytics'>('member_scores');
  const [selectedCategory, setSelectedCategory] = useState<QACategoryName | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

  // Add rule modal / form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newCategory, setNewCategory] = useState<QACategoryName>('Content');
  const [newWeightage, setNewWeightage] = useState<number>(1.0);

  // Edit rule inline state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeightage, setEditWeightage] = useState<number>(1.0);

  const [copiedReport, setCopiedReport] = useState(false);

  const categories: QACategoryName[] = [
    'Pre-build',
    'Content',
    'Design',
    'Website Interactions',
    'Backend',
    'SEO',
    'Escalation'
  ];

  // Map assetId to Project for fast lookup
  const assetToProjectMap = useMemo(() => {
    const map: Record<string, Project> = {};
    projects.forEach((proj) => {
      proj.assets?.forEach((ast) => {
        map[ast.id] = proj;
      });
    });
    return map;
  }, [projects]);

  // Helper calculation for a project's QA score
  const calculateProjectQAStats = (projId: string) => {
    const projectPins = pins.filter((p) => {
      const proj = assetToProjectMap[p.assetId];
      return proj?.id === projId;
    });

    // Get pins tagged with QA Errors for this project
    const internalQAPins: Pin[] = [];
    const clientEditPins: Pin[] = [];

    projectPins.forEach((p) => {
      if (p.qaError) {
        if (p.qaError.source === 'internal_qa') {
          internalQAPins.push(p);
        } else if (p.qaError.source === 'client_edit') {
          clientEditPins.push(p);
        }
      }
    });

    const totalInternalDeduction = internalQAPins.reduce((acc, p) => {
      return acc + (p.qaError?.weightage || 0);
    }, 0);

    const baseScore = 100;
    const finalScore = Math.max(0, Math.round((baseScore - totalInternalDeduction) * 10) / 10);

    let grade = 'A+';
    let gradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (finalScore >= 95) { grade = 'A+'; gradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    else if (finalScore >= 90) { grade = 'A'; gradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    else if (finalScore >= 80) { grade = 'B'; gradeBg = 'bg-blue-50 text-blue-700 border-blue-200'; }
    else if (finalScore >= 70) { grade = 'C'; gradeBg = 'bg-amber-50 text-amber-700 border-amber-200'; }
    else { grade = 'D / Needs Review'; gradeBg = 'bg-rose-50 text-rose-700 border-rose-200'; }

    return {
      projectPins,
      internalQAPins,
      clientEditPins,
      totalInternalDeduction,
      finalScore,
      grade,
      gradeBg
    };
  };

  // Helper calculation for Team Member QA Scores (Overall + Project-wise)
  const memberQAStatsList = useMemo(() => {
    return teammates.map((member) => {
      // Find all pins assigned to this member or authored by this member
      const memberAssignedPins = pins.filter((p) => {
        return (
          p.assignedTo?.id === member.id ||
          p.assignedTo?.name === member.name ||
          p.author?.id === member.id
        );
      });

      // Internal QA error pins for this member
      const memberQAErrors = memberAssignedPins.filter(
        (p) => p.qaError && p.qaError.source === 'internal_qa'
      );

      // Client requested edit pins for this member
      const memberClientEdits = memberAssignedPins.filter(
        (p) => p.qaError && p.qaError.source === 'client_edit'
      );

      // Total deduction points for this member across all projects
      const totalMemberDeduction = memberQAErrors.reduce(
        (acc, p) => acc + (p.qaError?.weightage || 0),
        0
      );

      // Overall Member Score (starts at 100)
      const overallMemberScore = Math.max(
        0,
        Math.round((100 - totalMemberDeduction) * 10) / 10
      );

      let grade = 'A+';
      let gradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (overallMemberScore >= 95) { grade = 'A+'; gradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
      else if (overallMemberScore >= 90) { grade = 'A'; gradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
      else if (overallMemberScore >= 80) { grade = 'B'; gradeBg = 'bg-blue-50 text-blue-700 border-blue-200'; }
      else if (overallMemberScore >= 70) { grade = 'C'; gradeBg = 'bg-amber-50 text-amber-700 border-amber-200'; }
      else { grade = 'D / Action Needed'; gradeBg = 'bg-rose-50 text-rose-700 border-rose-200'; }

      // Project-wise score breakdown for this member
      const projectBreakdown = projects.map((proj) => {
        // Pins for this project assigned to member
        const projMemberPins = memberAssignedPins.filter((p) => {
          const projectForPin = assetToProjectMap[p.assetId];
          return projectForPin?.id === proj.id;
        });

        const projQAErrors = projMemberPins.filter(
          (p) => p.qaError && p.qaError.source === 'internal_qa'
        );
        const projClientEdits = projMemberPins.filter(
          (p) => p.qaError && p.qaError.source === 'client_edit'
        );

        const projDeduction = projQAErrors.reduce(
          (acc, p) => acc + (p.qaError?.weightage || 0),
          0
        );

        const projScore = Math.max(0, Math.round((100 - projDeduction) * 10) / 10);

        let pGrade = 'A+';
        let pGradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (projScore >= 95) { pGrade = 'A+'; pGradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
        else if (projScore >= 90) { pGrade = 'A'; pGradeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
        else if (projScore >= 80) { pGrade = 'B'; pGradeBg = 'bg-blue-50 text-blue-700 border-blue-200'; }
        else if (projScore >= 70) { pGrade = 'C'; pGradeBg = 'bg-amber-50 text-amber-700 border-amber-200'; }
        else { pGrade = 'D'; pGradeBg = 'bg-rose-50 text-rose-700 border-rose-200'; }

        return {
          project: proj,
          projMemberPins,
          projQAErrors,
          projClientEdits,
          projDeduction,
          projScore,
          pGrade,
          pGradeBg
        };
      });

      // Projects where member actually has activity or assignments
      const activeProjects = projectBreakdown.filter(
        (pb) => pb.projMemberPins.length > 0 || pb.project.ownerId === member.id
      );

      return {
        member,
        overallMemberScore,
        grade,
        gradeBg,
        totalMemberDeduction,
        memberQAErrors,
        memberClientEdits,
        memberAssignedPins,
        projectBreakdown,
        activeProjects: activeProjects.length > 0 ? activeProjects : projectBreakdown.slice(0, 3)
      };
    });
  }, [teammates, pins, projects, assetToProjectMap]);

  // Overall Team Average QA Score
  const teamAverageScore = useMemo(() => {
    if (memberQAStatsList.length === 0) return 100;
    const sum = memberQAStatsList.reduce((acc, m) => acc + m.overallMemberScore, 0);
    return Math.round((sum / memberQAStatsList.length) * 10) / 10;
  }, [memberQAStatsList]);

  // Check if current user can view all member scores or only their own
  const isMasterAdmin = currentUser.email === 'nehemiahc@yourdigitalagents.com' || currentUser.role === 'Owner' || currentUser.role === 'Admin';

  const [rolePermissions] = useState(() => {
    try {
      const saved = localStorage.getItem('webreview_role_permissions_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      membersCanViewAllQAScores: false,
      membersCanManageRubric: false,
      membersCanInvite: true,
      membersCanManageRoles: false,
      membersCanDeleteProjects: false,
      membersCanArchiveProjects: true
    };
  });

  const canViewAllQAScores = isMasterAdmin || rolePermissions.membersCanViewAllQAScores;

  // Filtered Rubric Rules
  const filteredRules = rubricRules.filter((r) => {
    const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
    const matchesSearch = r.ruleName.toLowerCase().includes(searchQuery.toLowerCase()) || r.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filtered Members List with Role-based condition
  const filteredMemberStats = memberQAStatsList.filter((ms) => {
    // Condition: Members only see their own QA score unless permitted by Admin/Master Admin
    if (!canViewAllQAScores) {
      const isSelf = ms.member.id === currentUser.id || ms.member.email.toLowerCase() === currentUser.email.toLowerCase();
      if (!isSelf) return false;
    }

    const matchesSearch =
      memberSearchQuery === '' ||
      ms.member.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      ms.member.email.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      ms.member.role.toLowerCase().includes(memberSearchQuery.toLowerCase());

    const matchesRole =
      selectedRoleFilter === 'all' ||
      ms.member.role.toLowerCase() === selectedRoleFilter.toLowerCase();

    return matchesSearch && matchesRole;
  });

  // Category sums for rubric table
  const categorySums = categories.reduce((acc, cat) => {
    const sum = rubricRules.filter(r => r.category === cat && r.isActive).reduce((s, r) => s + r.weightage, 0);
    acc[cat] = Math.round(sum * 100) / 100;
    return acc;
  }, {} as Record<QACategoryName, number>);

  const grandTotalWeightage = Object.values(categorySums).reduce((a, b) => a + b, 0);

  // Add rule handler
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;

    const newRule: QARubricRule = {
      id: `qa_rule_${Date.now()}`,
      category: newCategory,
      ruleName: newRuleName.trim(),
      weightage: Number(newWeightage) || 1.0,
      isActive: true
    };

    onUpdateRubricRules([...rubricRules, newRule]);
    setNewRuleName('');
    setShowAddModal(false);
  };

  // Save inline edit
  const handleSaveEdit = (ruleId: string) => {
    onUpdateRubricRules(
      rubricRules.map((r) =>
        r.id === ruleId ? { ...r, ruleName: editName.trim() || r.ruleName, weightage: Number(editWeightage) } : r
      )
    );
    setEditingRuleId(null);
  };

  // Toggle active rule
  const handleToggleActive = (ruleId: string) => {
    onUpdateRubricRules(
      rubricRules.map((r) => (r.id === ruleId ? { ...r, isActive: !r.isActive } : r))
    );
  };

  // Delete rule
  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this QA rule from the rubric?')) {
      onUpdateRubricRules(rubricRules.filter((r) => r.id !== ruleId));
    }
  };

  const selectedProj = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const projStats = selectedProj ? calculateProjectQAStats(selectedProj.id) : null;

  const handleCopyReportText = () => {
    if (!selectedProj || !projStats) return;
    const text = `QA SCORE REPORT: ${selectedProj.name} (${selectedProj.client})
====================================================
QA Score: ${projStats.finalScore}% (Grade: ${projStats.grade})
Internal QA Deductions: -${projStats.totalInternalDeduction} pts (${projStats.internalQAPins.length} errors tagged)
Client Requested Revisions: ${projStats.clientEditPins.length} edits (0% Penalty)

INTERNAL QA ERRORS:
${projStats.internalQAPins.map(p => `- Pin #${p.number}: [${p.qaError?.category}] ${p.qaError?.ruleName} (-${p.qaError?.weightage} pts)`).join('\n') || 'None - Perfect QA Record!'}

CLIENT EDITS LOG:
${projStats.clientEditPins.map(p => `- Pin #${p.number}: ${p.title} (${p.qaError?.notes || 'Client requested modification'})`).join('\n') || 'No client edits recorded.'}`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="flex-1 min-w-0 flex bg-slate-100/70 text-slate-900 overflow-hidden h-[calc(100vh-3.5rem)]">
      
      {/* 1. LEFT MARKUP.IO STYLE SIDEBAR (Identical to ProjectsGridView sidebar) */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 hidden md:flex">
        
        <div className="p-4 space-y-4">
          
          {/* Navigation Items */}
          <nav className="space-y-1">
            <button
              onClick={() => onNavigateTab ? onNavigateTab('dashboard') : onViewModeChange?.('dashboard')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4 text-slate-700" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigateTab ? onNavigateTab('archive') : onViewModeChange?.('dashboard')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
            >
              <Archive className="w-4 h-4 text-slate-700" />
              <span>Archive</span>
            </button>

            <button
              onClick={() => onNavigateTab ? onNavigateTab('team') : onViewModeChange?.('dashboard')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4 text-slate-700" />
              <span>Team</span>
            </button>

            {/* QA Score Matrix Active Item */}
            <button
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-xs cursor-default"
            >
              <div className="flex items-center gap-3">
                <Award className="w-4 h-4 text-white" />
                <span>QA Score Matrix</span>
              </div>
              <span className="text-[10px] bg-indigo-500 text-white font-extrabold px-1.5 py-0.5 rounded">
                NEW
              </span>
            </button>

            <button
              onClick={() => onNavigateTab ? onNavigateTab('settings') : onViewModeChange?.('dashboard')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-700" />
              <span>Settings</span>
            </button>
          </nav>

        </div>

        {/* BOTTOM SIDEBAR STATS CARD */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Workspace QA Score
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-slate-900">{teamAverageScore}%</span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                A+ Rating
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              33 QA rubric error rules active
            </p>
          </div>
        </div>

      </aside>

      {/* 2. MAIN WORKSPACE CONTENT AREA */}
      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col bg-slate-50">
        
        {/* TOP SUB-HEADER BAR */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 shadow-2xs shrink-0">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>QA Score & Error Weightage Matrix</span>
                  <span className="text-[11px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                    Manager Control
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track member QA ratings, project scores, error weightages, and separate client requested edits.
                </p>
              </div>
            </div>

            {/* QA Sub-Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab('member_scores')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'member_scores'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Member QA Scores</span>
              </button>

              <button
                onClick={() => setActiveTab('project_scores')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'project_scores'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Project Scorecards</span>
              </button>

              <button
                onClick={() => setActiveTab('rubric_settings')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'rubric_settings'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>QA Rubric ({rubricRules.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'analytics'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>
            </div>
          </div>
        </header>

        {/* BODY CONTENT CONTAINER */}
        <div className="w-full p-4 md:p-6 space-y-6 flex-1 overflow-y-auto">

          {/* TAB 1: MEMBER QA SCORES (Overall Score + Project-wise Score) */}
          {activeTab === 'member_scores' && (
            <div className="space-y-6">
              
              {!canViewAllQAScores && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
                  <div className="flex items-center gap-2.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      🔒 Role Restricted View: As a workspace Member, you are viewing your own personal QA score scorecard. Team-wide QA scores are accessible to Master Admin & Admins, or when granted in Team Settings -&gt; Roles.
                    </span>
                  </div>
                </div>
              )}

              {/* Top Overview Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Overall Team Average Score
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
                    {teamAverageScore}%
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Excellent
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Across all {teammates.length} team members</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Active Team Staff
                  </div>
                  <div className="text-2xl font-black text-indigo-600 mt-1">
                    {teammates.length} <span className="text-xs font-normal text-slate-500">Members</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Developers, Designers & QA leads</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Total QA Errors Attributed
                  </div>
                  <div className="text-2xl font-black text-rose-600 mt-1">
                    {pins.filter(p => p.qaError?.source === 'internal_qa').length} <span className="text-xs font-normal text-slate-500">Items</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Total QA deductions across workspace</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Client Revisions Handled
                  </div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {pins.filter(p => p.qaError?.source === 'client_edit').length} <span className="text-xs font-normal text-slate-500">Edits</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">0% Penalty on team member scores</div>
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative min-w-[260px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search member by name or role..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  <button
                    onClick={() => setSelectedRoleFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedRoleFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Roles ({teammates.length})
                  </button>
                  {['Developer', 'Designer', 'Admin', 'Reviewer', 'Owner', 'Member'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setSelectedRoleFilter(role)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        selectedRoleFilter === role
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Member QA Scorecards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredMemberStats.map((ms) => {
                  return (
                    <div
                      key={ms.member.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-all"
                    >
                      {/* Member Profile Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={ms.member.avatar}
                            alt={ms.member.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                              <span>{ms.member.name}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-extrabold px-2 py-0.5 rounded border border-slate-200">
                                {ms.member.role}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 truncate">{ms.member.email}</div>
                          </div>
                        </div>

                        {/* OVERALL MEMBER SCORE */}
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall QA Score</div>
                          <div className="text-xl font-black text-slate-900 flex items-center justify-end gap-1.5 mt-0.5">
                            <span>{ms.overallMemberScore}%</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded font-extrabold border ${ms.gradeBg}`}>
                              {ms.grade}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Metrics Row */}
                      <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">QA Deductions</div>
                          <div className="font-black text-rose-600 mt-0.5">
                            -{ms.totalMemberDeduction} pts ({ms.memberQAErrors.length})
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Client Edits</div>
                          <div className="font-black text-indigo-600 mt-0.5">
                            {ms.memberClientEdits.length} items
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Active Projects</div>
                          <div className="font-black text-slate-800 mt-0.5">
                            {ms.activeProjects.length} Projects
                          </div>
                        </div>
                      </div>

                      {/* PROJECT-WISE SCORE BREAKDOWN FOR THIS MEMBER */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                          <span>Project-Wise Scores</span>
                          <span className="text-slate-400 font-normal">Base 100 per project</span>
                        </div>

                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 divide-y divide-slate-100 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                          {ms.activeProjects.map((pb) => (
                            <div key={pb.project.id} className="pt-2 first:pt-0 pb-2 flex flex-col gap-1 text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-lg shrink-0">{pb.project.avatar}</span>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 truncate block">{pb.project.name}</span>
                                    <span className="text-[10px] text-slate-500 truncate block">{pb.project.client}</span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className={`text-[11px] font-black px-2 py-0.5 rounded border inline-block ${pb.pGradeBg}`}>
                                    {pb.projScore}% ({pb.pGrade})
                                  </span>
                                  {pb.projDeduction > 0 && (
                                    <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                                      -{pb.projDeduction} pts ({pb.projQAErrors.length} errors)
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Error list for this project if any */}
                              {pb.projQAErrors.length > 0 && (
                                <div className="ml-7 mt-1 space-y-1">
                                  {pb.projQAErrors.map((errPin) => (
                                    <div key={errPin.id} className="text-[11px] bg-rose-50 border border-rose-200 text-rose-900 p-1.5 rounded flex items-center justify-between gap-2">
                                      <span className="truncate font-medium">#{errPin.number} {errPin.title}</span>
                                      <span className="font-bold shrink-0 text-rose-700">-{errPin.qaError?.weightage} pts</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 2: PROJECT QA SCORECARDS */}
          {activeTab === 'project_scores' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Project Picker */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <label className="text-xs font-extrabold text-slate-600 uppercase tracking-wider block">
                      Select Project for QA Inspection
                    </label>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                      {projects.length} Total
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {projects.map((proj) => {
                      const stats = calculateProjectQAStats(proj.id);
                      const isSelected = proj.id === selectedProjectId;
                      return (
                        <button
                          key={proj.id}
                          onClick={() => setSelectedProjectId(proj.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-50/90 border-indigo-600 shadow-2xs ring-1 ring-indigo-500/30'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl shrink-0">{proj.avatar}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">{proj.name}</div>
                              <div className="text-[11px] text-slate-500 truncate">{proj.client}</div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className={`text-[11px] font-black px-2 py-0.5 rounded border inline-block ${stats.gradeBg}`}>
                              {stats.finalScore}% ({stats.grade})
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                              -{stats.totalInternalDeduction} pts QA penalty
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Columns: Detailed Scorecard for Selected Project */}
                {selectedProj && projStats && (
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-2xs space-y-6">
                    
                    {/* Scorecard Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-3xl shrink-0">{selectedProj.avatar}</span>
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-slate-900 truncate">{selectedProj.name}</h2>
                          <p className="text-xs text-slate-500">Client: {selectedProj.client} • 100 Base QA Score Matrix</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleCopyReportText}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedReport ? 'Copied!' : 'Copy QA Report'}</span>
                        </button>

                        {onSelectProject && (
                          <button
                            onClick={() => onSelectProject(selectedProj)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Open in Studio</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rating KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      
                      <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-2xs">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Final Project QA Rating
                        </div>
                        <div className="text-3xl font-black text-white flex items-baseline gap-2">
                          {projStats.finalScore}%
                          <span className={`text-xs px-2 py-0.5 rounded font-extrabold border ${projStats.gradeBg}`}>
                            {projStats.grade}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Calculated from 100 base score</span>
                        </div>
                      </div>

                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-2xs">
                        <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                          Internal QA Deductions
                        </div>
                        <div className="text-3xl font-black text-rose-900">
                          -{projStats.totalInternalDeduction} <span className="text-sm font-normal text-rose-700">pts</span>
                        </div>
                        <div className="text-[11px] text-rose-700 mt-2 font-medium">
                          {projStats.internalQAPins.length} internal error items tagged
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl shadow-2xs">
                        <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-1">
                          Client Requested Edits
                        </div>
                        <div className="text-3xl font-black text-indigo-900">
                          {projStats.clientEditPins.length} <span className="text-sm font-normal text-indigo-700">edits</span>
                        </div>
                        <div className="text-[11px] text-indigo-700 mt-2 font-bold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>0% penalty on Website Team Score</span>
                        </div>
                      </div>

                    </div>

                    {/* Internal QA Error Items Breakdown */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Internal QA Error Log (Deducted Points)</span>
                        </h3>
                        <span className="text-xs text-slate-500 font-semibold">
                          {projStats.internalQAPins.length} errors found
                        </span>
                      </div>

                      {projStats.internalQAPins.length > 0 ? (
                        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                          {projStats.internalQAPins.map((p) => {
                            const cat = (p.qaError?.category || 'Design') as QACategoryName;
                            const catStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Design'];
                            return (
                              <div key={p.id} className="p-3 bg-white hover:bg-slate-50/80 flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                                    #{p.number}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">{p.title}</div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                      Rule: <strong className="text-slate-800">{p.qaError?.ruleName}</strong>
                                      {p.assignedTo && (
                                        <span className="ml-2 text-indigo-600 font-semibold">
                                          • Assigned: {p.assignedTo.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catStyle.badge}`}>
                                    {cat}
                                  </span>
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded font-black text-xs">
                                    -{p.qaError?.weightage || 0} pts
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 bg-emerald-50/60 border border-emerald-200 rounded-xl text-center text-emerald-800 text-xs">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                          <p className="font-bold">Zero Internal QA Errors!</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">The website team delivered pristine code following all QA guidelines.</p>
                        </div>
                      )}
                    </div>

                    {/* Client Edits & Scope Changes */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-xs font-extrabold text-slate-900">Client Requested Revisions & Scope Changes</h3>
                            <p className="text-[11px] text-slate-500">Tracked separately for billing. Does NOT penalize internal team QA score.</p>
                          </div>
                        </div>
                        <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded border border-indigo-200">
                          {projStats.clientEditPins.length} Client Items
                        </span>
                      </div>

                      {projStats.clientEditPins.length > 0 ? (
                        <div className="space-y-2 mt-2">
                          {projStats.clientEditPins.map((p) => (
                            <div key={p.id} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  #{p.number}
                                </span>
                                <span className="font-medium text-slate-800 truncate">{p.title}</span>
                              </div>
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                Client Scope Edit (0 Penalty)
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">No client edits recorded for this project yet.</div>
                      )}
                    </div>

                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 3: QA RUBRIC RULES (33 Rules Table & Weightage Editor) */}
          {activeTab === 'rubric_settings' && (
            <div className="space-y-6">
              
              {/* Category Weightage Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {categories.map((cat) => {
                  const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Design'];
                  const sum = categorySums[cat] || 0;
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(isSelected ? 'all' : cat)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${style.bg} ${style.border} ${
                        isSelected ? 'ring-2 ring-indigo-600 shadow-xs' : 'hover:opacity-90'
                      }`}
                    >
                      <div className={`text-[9px] font-black uppercase tracking-wider ${style.text}`}>
                        {cat}
                      </div>
                      <div className="text-lg font-black text-slate-900 mt-1">
                        {sum} <span className="text-[10px] font-normal text-slate-500">pts</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Controls & Search */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search error rule or category..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Categories ({rubricRules.length})
                  </button>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Custom Error Rule</span>
                </button>
              </div>

              {/* Rubric Rules Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                    <span>QA RUBRIC RULES LIST ({filteredRules.length} ITEMS)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Total Active Weightage Pool: {grandTotalWeightage} pts
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <th className="py-3 px-4 w-36">Error Category</th>
                        <th className="py-3 px-4">Error Description / Rule Name</th>
                        <th className="py-3 px-4 w-32 text-center">Weightage (Penalty Pts)</th>
                        <th className="py-3 px-4 w-28 text-center">Status</th>
                        <th className="py-3 px-4 w-28 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRules.map((rule) => {
                        const style = CATEGORY_COLORS[rule.category] || CATEGORY_COLORS['Design'];
                        const isEditing = editingRuleId === rule.id;

                        return (
                          <tr key={rule.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 align-middle">
                              <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-extrabold border ${style.badge}`}>
                                {rule.category}
                              </span>
                            </td>

                            <td className="py-3 px-4 align-middle font-medium text-slate-800">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                                />
                              ) : (
                                <span>{rule.ruleName}</span>
                              )}
                            </td>

                            <td className="py-3 px-4 align-middle text-center font-black text-slate-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  value={editWeightage}
                                  onChange={(e) => setEditWeightage(Number(e.target.value))}
                                  className="w-20 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-center text-slate-900 focus:outline-none focus:border-indigo-600 mx-auto block"
                                />
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold">
                                  {rule.weightage} pts
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 align-middle text-center">
                              <button
                                onClick={() => handleToggleActive(rule.id)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                  rule.isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {rule.isActive ? 'Active' : 'Disabled'}
                              </button>
                            </td>

                            <td className="py-3 px-4 align-middle text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleSaveEdit(rule.id)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                    title="Save"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingRuleId(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingRuleId(rule.id);
                                      setEditName(rule.ruleName);
                                      setEditWeightage(rule.weightage);
                                    }}
                                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Edit Rule"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                    title="Delete Rule"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: ANALYTICS & TRENDS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Error Category Distribution */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Error Category Penalty Weightage Allocation</span>
                  </h3>

                  <div className="space-y-3">
                    {categories.map((cat) => {
                      const sum = categorySums[cat] || 0;
                      const percentage = grandTotalWeightage > 0 ? Math.round((sum / grandTotalWeightage) * 100) : 0;
                      const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Design'];

                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{cat}</span>
                            <span>{sum} pts ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${style.badge.split(' ')[0]} bg-indigo-600`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team QA Health Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Overall QA Health Metrics</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Overall Average Score Across All Members:</span>
                      <span className="font-black text-slate-900 text-sm">{teamAverageScore}%</span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Total Active QA Rubric Error Rules:</span>
                      <span className="font-black text-slate-900 text-sm">{rubricRules.length} Rules</span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Client Edits Separated from QA Deductions:</span>
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        100% Compliant
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

      {/* ADD CUSTOM ERROR RULE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Add Custom Error Rule to Rubric</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Error Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as QACategoryName)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Rule Name / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unresponsive layout break on tablet view..."
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Penalty Weightage (Points)</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="20"
                  required
                  value={newWeightage}
                  onChange={(e) => setNewWeightage(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Add Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
