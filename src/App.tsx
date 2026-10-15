import React, { useState, useEffect } from 'react';
import { 
  Project, 
  Asset, 
  Pin, 
  PinStatus, 
  PinCategory, 
  PinPriority, 
  Teammate, 
  ActivityItem, 
  ViewMode, 
  FilterState, 
  Comment, 
  Attachment,
  AuthUser,
  Organization,
  NotificationItem,
  QARubricRule,
  QAPinError
} from './types';
import { 
  TEAMMATES, 
  INITIAL_PROJECTS, 
  INITIAL_ASSETS,
  INITIAL_PINS, 
  INITIAL_ACTIVITY_LOGS 
} from './data/mockData';
import { INITIAL_QA_RUBRIC } from './data/qaRubricData';
import { 
  subscribeProjects, 
  subscribePins, 
  saveProjectToFirestore, 
  deleteProjectFromFirestore,
  savePinToFirestore, 
  deletePinFromFirestore, 
  seedInitialFirestoreData,
  checkFirebaseConnection
} from './lib/firebaseSync';
import { Header } from './components/Header';
import { AuthPage } from './components/AuthPage';
import { AnnotationStudio } from './components/AnnotationStudio';
import { SidebarDiscussion } from './components/SidebarDiscussion';
import { KanbanBoard } from './components/KanbanBoard';
import { FeedbackMatrix } from './components/FeedbackMatrix';
import { TeamActivityFeed } from './components/TeamActivityFeed';
import { ProjectsGridView } from './components/ProjectsGridView';
import { QAScoreManager } from './components/QAScoreManager';
import { NewProjectModal, NewAssetModal, ShareModal } from './components/Modals';
import { DomainSecurityModal } from './components/DomainSecurityModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { getAllowedDomains } from './utils/domains';

export default function App() {
  // Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('mf_auth_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(() => {
    try {
      const saved = localStorage.getItem('mf_auth_org');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  // State
  const [appName, setAppName] = useState('WebReview Pro');
  const [appIcon, setAppIcon] = useState('W');
  const [isGuestMode, setIsGuestMode] = useState(() => {
    const search = window.location.search;
    return search.includes('guest_mode=true') || search.includes('project=');
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('webreview_projects_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_PROJECTS;
  });

  const [pins, setPins] = useState<Pin[]>(() => {
    try {
      const saved = localStorage.getItem('webreview_pins_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return INITIAL_PINS;
  });

  const [rubricRules, setRubricRules] = useState<QARubricRule[]>(() => {
    try {
      const saved = localStorage.getItem('webreview_qa_rubric_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_QA_RUBRIC;
  });

  const handleUpdateRubricRules = (newRules: QARubricRule[]) => {
    setRubricRules(newRules);
    try {
      localStorage.setItem('webreview_qa_rubric_v1', JSON.stringify(newRules));
    } catch (e) {}
  };

  const handleUpdatePinQAError = (pinId: string, qaError?: QAPinError) => {
    setPins((prev) =>
      prev.map((p) => {
        if (p.id === pinId) {
          const updated = { ...p, qaError };
          if (selectedPin?.id === pinId) {
            setSelectedPin(updated);
          }
          return updated;
        }
        return p;
      })
    );
  };
  const [currentProject, setCurrentProject] = useState<Project>(() => projects[0] || INITIAL_PROJECTS[0]);
  const [currentAsset, setCurrentAsset] = useState<Asset>(() => (projects[0]?.assets?.[0]) || INITIAL_PROJECTS[0].assets[0]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityItem[]>(INITIAL_ACTIVITY_LOGS);
  const [teammates, setTeammates] = useState<Teammate[]>(TEAMMATES);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif_1',
      type: 'mention',
      title: 'Tagged in Pin #1',
      message: 'Sarah Jenkins tagged you: "@QA Lead please re-verify contrast ratio on button"',
      timestamp: '2m ago',
      isRead: false,
      pinId: 'pin_101',
      assetId: 'asset_1',
      sender: TEAMMATES[1],
      recipientName: 'QA Lead'
    },
    {
      id: 'notif_2',
      type: 'assignment',
      title: 'Assigned to Pin #2',
      message: 'Alex Rivera assigned Pin #2 (Hero spacing issue) to you.',
      timestamp: '1h ago',
      isRead: false,
      pinId: 'pin_102',
      assetId: 'asset_1',
      sender: TEAMMATES[0],
      recipientName: 'You'
    }
  ]);

  const handleNotifyMember = (notif: { title: string; message: string; recipient: string; pinId?: string; assetId?: string }) => {
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      type: 'mention',
      title: notif.title,
      message: notif.message,
      timestamp: 'Just now',
      isRead: false,
      sender: currentUser,
      recipientName: notif.recipient,
      pinId: notif.pinId,
      assetId: notif.assetId
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Sync projects and pins to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('webreview_projects_v2', JSON.stringify(projects));
    } catch (e) {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem('webreview_pins_v2', JSON.stringify(pins));
    } catch (e) {}
  }, [pins]);

  // Firebase Firestore Real-Time Synchronization
  useEffect(() => {
    checkFirebaseConnection();
    seedInitialFirestoreData(INITIAL_PROJECTS, INITIAL_PINS);

    const unsubProjects = subscribeProjects((cloudProjects) => {
      if (cloudProjects && cloudProjects.length > 0) {
        setProjects((prevProjects) => {
          // Prevent losing any local project created offline or un-synced
          const cloudIds = new Set(cloudProjects.map((p) => p.id));
          const localOnly = prevProjects.filter((p) => !cloudIds.has(p.id));
          if (localOnly.length > 0) {
            localOnly.forEach((p) => saveProjectToFirestore(p));
            return [...localOnly, ...cloudProjects];
          }
          return cloudProjects;
        });
      }
    });

    const unsubPins = subscribePins((cloudPins) => {
      if (cloudPins) {
        setPins(cloudPins);
      }
    });

    return () => {
      unsubProjects();
      unsubPins();
    };
  }, []);

  // Check URL query parameters on mount to auto-open shared project in Guest Review Mode without requiring login
  useEffect(() => {
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const projId = params.get('project');
    const isGuestParam = params.get('guest_mode') === 'true' || search.includes('guest') || !!projId;

    if (isGuestParam) {
      setIsGuestMode(true);
    }

    if (projId) {
      const allProjects = projects.length > 0 ? projects : INITIAL_PROJECTS;
      const foundProj = allProjects.find((p) => p.id === projId) || INITIAL_PROJECTS.find((p) => p.id === projId);
      if (foundProj) {
        setCurrentProject(foundProj);
        if (foundProj.assets && foundProj.assets.length > 0) {
          setCurrentAsset(foundProj.assets[0]);
        }
        setViewMode('studio');
      }
    }
  }, [projects]);

  const handleUpdateBranding = (newName: string, newIcon: string) => {
    setAppName(newName);
    setAppIcon(newIcon);
  };

  const handleUpdateTeammateRole = (id: string, newRole: Teammate['role']) => {
    setTeammates((prev) =>
      prev.map((tm) => (tm.id === id ? { ...tm, role: newRole } : tm))
    );
  };
  
  const currentUser: Teammate = authUser ? {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email,
    avatar: authUser.avatar,
    role: (authUser.role === 'Admin' || authUser.role === 'Reviewer') ? 'Owner' : (authUser.role as any),
    status: authUser.status,
    cursorColor: authUser.cursorColor
  } : {
    id: 'usr_guest',
    name: 'Guest Reviewer',
    email: 'guest@client.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Guest',
    status: 'online',
    cursorColor: '#F59E0B'
  };

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'dashboard' | 'archive' | 'team' | 'settings'>('dashboard');

  const handleNavigateDashboardTab = (tab: 'dashboard' | 'archive' | 'team' | 'settings' = 'dashboard') => {
    setDashboardTab(tab);
    setViewMode('dashboard');
  };

  const [isSimulatingPartner, setIsSimulatingPartner] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  // Profile Settings Modal State
  const [showProfileSettingsModal, setShowProfileSettingsModal] = useState(false);

  const handleSaveProfile = (updatedData: {
    name: string;
    email: string;
    role: string;
    department: string;
    avatar: string;
    status: 'online' | 'offline' | 'busy';
  }) => {
    if (authUser) {
      const updatedAuth: AuthUser = {
        ...authUser,
        name: updatedData.name,
        email: updatedData.email,
        role: updatedData.role,
        avatar: updatedData.avatar,
        status: updatedData.status,
      };
      setAuthUser(updatedAuth);
      try {
        localStorage.setItem('mf_auth_user', JSON.stringify(updatedAuth));
      } catch (e) {}
    }
    setTeammates((prev) =>
      prev.map((tm) => {
        if (tm.id === currentUser.id || tm.email.toLowerCase() === currentUser.email.toLowerCase()) {
          return {
            ...tm,
            name: updatedData.name,
            email: updatedData.email,
            role: updatedData.role as any,
            avatar: updatedData.avatar,
            department: updatedData.department,
            status: updatedData.status,
          };
        }
        return tm;
      })
    );
  };

  const handleAddNewUrlAsset = (newUrl: string) => {
    let finalUrl = newUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }
    const domainTitle = finalUrl.replace(/^https?:\/\//, '').split('/')[0] || finalUrl;

    const projId = `proj_${Date.now()}`;
    const assetId = `asset_${Date.now()}`;

    const newAsset: Asset = {
      id: assetId,
      projectId: projId,
      title: domainTitle,
      type: 'url',
      url: finalUrl,
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
      status: 'in_review',
      pinCount: 0,
      resolvedCount: 0
    };

    const newProject: Project = {
      id: projId,
      name: domainTitle,
      client: 'YourDigitalAgents Enterprise',
      description: `Live web annotation project for ${domainTitle}`,
      color: 'from-blue-600 to-indigo-600',
      avatar: '🌐',
      memberCount: 1,
      lastUpdated: 'Just now',
      ownerId: currentUser.id,
      assets: [newAsset]
    };

    setProjects((prev) => {
      const updated = [newProject, ...prev];
      try {
        localStorage.setItem('webreview_projects_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    saveProjectToFirestore(newProject);
    setCurrentProject(newProject);
    setCurrentAsset(newAsset);
    setSelectedPin(null);
    setViewMode('studio');
  };

  // Filters
  const [filterState, setFilterState] = useState<FilterState>({
    category: 'all',
    status: 'all',
    priority: 'all',
    assigneeId: 'all',
    search: '',
    showResolved: true,
  });

  // Modal toggles
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);

  const handleUpdateFilter = (updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    if (project.assets && project.assets.length > 0) {
      setCurrentAsset(project.assets[0]);
    }
    setSelectedPin(null);
  };

  const handleSelectAsset = (asset: Asset) => {
    setCurrentAsset(asset);
    setSelectedPin(null);
  };

  const handleUpdateAssetUrl = (newUrl: string, newType: Asset['type']) => {
    const updatedAsset = { ...currentAsset, url: newUrl, type: newType };
    setCurrentAsset(updatedAsset);
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id
          ? {
              ...proj,
              assets: proj.assets.map((a) => (a.id === currentAsset.id ? updatedAsset : a)),
            }
          : proj
      )
    );
  };

  // Add a new annotation pin
  const handleAddPin = (pinData: {
    x: number;
    y: number;
    title: string;
    commentText: string;
    category: PinCategory;
    priority: PinPriority;
    assigneeId: string;
    screenshotUrl?: string;
    attachments?: Attachment[];
  }) => {
    const assetPins = pins.filter((p) => p.assetId === currentAsset.id);
    const nextNum = assetPins.length + 1;
    const assignee = teammates.find((t) => t.id === pinData.assigneeId) || teammates[1];

    const pinId = `pin_${Date.now()}`;
    const newPin: Pin = {
      id: pinId,
      assetId: currentAsset.id,
      number: nextNum,
      x: pinData.x,
      y: pinData.y,
      category: pinData.category,
      status: 'open',
      priority: pinData.priority,
      title: pinData.title,
      createdAt: 'Just now',
      author: currentUser,
      assignedTo: assignee,
      screenshotUrl: pinData.screenshotUrl,
      attachments: pinData.attachments,
      metadata: {
        browser: 'Chrome 124.0 (AI Studio Proxy)',
        os: 'macOS Sonoma 14.4',
        viewport: '1920x1080',
        selector: `.element-target-coord-${pinData.x}-${pinData.y}`,
        deviceType: 'desktop',
      },
      comments: [
        {
          id: `cmt_${Date.now()}`,
          pinId: pinId,
          author: currentUser,
          text: pinData.commentText,
          createdAt: 'Just now',
          attachments: pinData.attachments,
        },
      ],
      isUnread: true,
    };

    setPins((prev) => [newPin, ...prev]);
    savePinToFirestore(newPin);
    setSelectedPin(newPin);

    // Update asset pin count
    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id
          ? {
              ...proj,
              assets: proj.assets.map((a) =>
                a.id === currentAsset.id ? { ...a, pinCount: (a.pinCount || 0) + 1 } : a
              ),
            }
          : proj
      )
    );

    // Log activity
    const newLog: ActivityItem = {
      id: `act_${Date.now()}`,
      projectId: currentProject.id,
      assetId: currentAsset.id,
      author: currentUser,
      action: `placed Pin #${nextNum}:`,
      targetName: pinData.title,
      timestamp: 'Just now',
      type: 'pin',
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  // Add Comment to existing pin
  const handleAddComment = (
    pinId: string,
    text: string,
    attachments?: Attachment[],
    audioDuration?: string
  ) => {
    const newComment: Comment = {
      id: `cmt_${Date.now()}`,
      pinId,
      author: currentUser,
      text,
      createdAt: 'Just now',
      attachments,
      audioDuration,
    };

    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id === pinId) {
          const updated = { ...pin, comments: [...pin.comments, newComment] };
          if (selectedPin?.id === pinId) setSelectedPin(updated);
          savePinToFirestore(updated);
          return updated;
        }
        return pin;
      })
    );

    const pinObj = pins.find((p) => p.id === pinId);
    if (pinObj) {
      const log: ActivityItem = {
        id: `act_${Date.now()}`,
        projectId: currentProject.id,
        assetId: currentAsset.id,
        author: currentUser,
        action: `commented on Pin #${pinObj.number}:`,
        targetName: `"${text.slice(0, 45)}..."`,
        timestamp: 'Just now',
        type: 'comment',
      };
      setActivityLogs((prev) => [log, ...prev]);
    }
  };

  // Update pin status
  const handleUpdatePinStatus = (pinId: string, newStatus: PinStatus) => {
    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id === pinId) {
          const updated = { ...pin, status: newStatus };
          if (selectedPin?.id === pinId) setSelectedPin(updated);
          savePinToFirestore(updated);
          return updated;
        }
        return pin;
      })
    );

    const pinObj = pins.find((p) => p.id === pinId);
    if (pinObj) {
      const log: ActivityItem = {
        id: `act_${Date.now()}`,
        projectId: currentProject.id,
        assetId: currentAsset.id,
        author: currentUser,
        action: `updated Pin #${pinObj.number} status to`,
        targetName: newStatus.replace('_', ' '),
        timestamp: 'Just now',
        type: 'status',
      };
      setActivityLogs((prev) => [log, ...prev]);
    }
  };

  // Update pin assignee
  const handleUpdatePinAssignee = (pinId: string, assignee: Teammate) => {
    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id === pinId) {
          const updated = { ...pin, assignedTo: assignee };
          if (selectedPin?.id === pinId) setSelectedPin(updated);
          savePinToFirestore(updated);
          return updated;
        }
        return pin;
      })
    );
  };

  // AI Automated Website Review
  const handleRunAiAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/ai/audit-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentAsset.url,
          title: currentAsset.title,
          type: currentAsset.type,
        }),
      });
      const aiPinsData = await res.json();
      if (Array.isArray(aiPinsData) && aiPinsData.length > 0) {
        const currentCount = pins.filter((p) => p.assetId === currentAsset.id).length;
        const newPins: Pin[] = aiPinsData.map((item: any, idx: number) => {
          const num = currentCount + idx + 1;
          return {
            id: `ai_pin_${Date.now()}_${idx}`,
            assetId: currentAsset.id,
            number: num,
            x: item.x || 30 + idx * 20,
            y: item.y || 25 + idx * 18,
            category: item.category || 'design',
            status: 'open',
            priority: item.priority || 'medium',
            title: `✨ [AI Review] ${item.title}`,
            createdAt: 'Just now',
            author: {
              id: 'ai_gemini',
              name: 'Gemini AI Auditor',
              email: 'gemini@aistudio.google.com',
              avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
              role: 'Designer',
              status: 'online',
              cursorColor: '#F59E0B',
            },
            assignedTo: teammates[1],
            metadata: {
              browser: 'Gemini 3.6 Vision Engine',
              os: 'Google Cloud Platform',
              viewport: '1920x1080 (Responsive UI Scan)',
              selector: item.selector || `#ai-target-${num}`,
              deviceType: 'desktop',
            },
            comments: [
              {
                id: `ai_cmt_${Date.now()}_${idx}`,
                pinId: `ai_pin_${Date.now()}_${idx}`,
                author: {
                  id: 'ai_gemini',
                  name: 'Gemini AI Auditor',
                  email: 'gemini@aistudio.google.com',
                  avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
                  role: 'Designer',
                  status: 'online',
                  cursorColor: '#F59E0B',
                },
                text: item.comment,
                createdAt: 'Just now',
                isAiGenerated: true,
              },
            ],
            isUnread: true,
          };
        });

        setPins((prev) => [...newPins, ...prev]);
        setSelectedPin(newPins[0]);

        const log: ActivityItem = {
          id: `act_${Date.now()}`,
          projectId: currentProject.id,
          assetId: currentAsset.id,
          author: {
            id: 'ai_gemini',
            name: 'Gemini AI Auditor',
            email: 'gemini@aistudio.google.com',
            avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
            role: 'Designer',
            status: 'online',
            cursorColor: '#F59E0B',
          },
          action: 'completed automated UX audit and placed',
          targetName: `${newPins.length} constructive pins`,
          timestamp: 'Just now',
          type: 'pin',
        };
        setActivityLogs((prev) => [log, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditing(false);
    }
  };

  // Create Project
  const handleCreateProject = (
    name: string,
    client: string,
    desc: string,
    avatar: string,
    color: string,
    websiteUrl?: string
  ) => {
    let finalUrl = websiteUrl?.trim();
    if (!finalUrl) {
      if (name.includes('.') && !name.includes(' ')) {
        finalUrl = name.startsWith('http') ? name : `https://${name}`;
      } else {
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        finalUrl = `https://${slug || 'site'}.websitepro.hosting`;
      }
    } else {
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = `https://${finalUrl}`;
      }
    }

    const domainTitle = finalUrl.replace(/^https?:\/\//, '').split('/')[0] || name;

    const projId = `proj_${Date.now()}`;
    const assetId = `asset_${Date.now()}`;

    const newAsset: Asset = {
      id: assetId,
      projectId: projId,
      title: domainTitle || name,
      type: 'url',
      url: finalUrl,
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
      status: 'in_review',
      pinCount: 0,
      resolvedCount: 0,
    };

    const newProj: Project = {
      id: projId,
      name,
      client,
      description: desc || `Live website annotation project for ${name}`,
      avatar: avatar || '🌐',
      color: color || 'from-blue-600 to-indigo-600',
      memberCount: 1,
      lastUpdated: 'Just now',
      ownerId: currentUser.id,
      assets: [newAsset],
    };

    setProjects((prev) => {
      const updated = [newProj, ...prev];
      try {
        localStorage.setItem('webreview_projects_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    saveProjectToFirestore(newProj);
    setCurrentProject(newProj);
    setCurrentAsset(newAsset);
    setSelectedPin(null);
    setViewMode('studio');
  };

  // Delete Project
  const handleDeleteProject = (projectId: string) => {
    deleteProjectFromFirestore(projectId);
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== projectId);
      try {
        localStorage.setItem('webreview_projects_v2', JSON.stringify(updated));
      } catch (e) {}
      if (updated.length > 0 && currentProject.id === projectId) {
        setCurrentProject(updated[0]);
        if (updated[0].assets && updated[0].assets.length > 0) {
          setCurrentAsset(updated[0].assets[0]);
        }
      }
      return updated;
    });
  };

  // Delete Teammate
  const handleDeleteTeammate = (teammateId: string) => {
    setTeammates((prev) => prev.filter((t) => t.id !== teammateId));
  };

  // Delete Pin
  const handleDeletePin = (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    if (selectedPin?.id === pinId) {
      setSelectedPin(null);
    }
  };

  // Delete Comment
  const handleDeleteComment = (pinId: string, commentId: string) => {
    setPins((prev) =>
      prev.map((pin) => {
        if (pin.id === pinId) {
          const updatedComments = pin.comments.filter((c) => c.id !== commentId);
          const updatedPin = { ...pin, comments: updatedComments };
          if (selectedPin?.id === pinId) {
            setSelectedPin(updatedPin);
          }
          return updatedPin;
        }
        return pin;
      })
    );
  };

  // Create Asset
  const handleCreateAsset = (title: string, url: string, type: Asset['type']) => {
    const newAsset: Asset = {
      id: `asset_${Date.now()}`,
      projectId: currentProject.id,
      title,
      type,
      url,
      status: 'in_review',
      pinCount: 0,
      resolvedCount: 0,
    };

    setProjects((prev) =>
      prev.map((proj) =>
        proj.id === currentProject.id ? { ...proj, assets: [...proj.assets, newAsset] } : proj
      )
    );
    setCurrentAsset(newAsset);
    setSelectedPin(null);
    setViewMode('studio');
  };

  // Invite Teammate
  const handleInviteTeammate = (name: string, email: string, role: Teammate['role']) => {
    const newTm: Teammate = {
      id: `usr_${Date.now()}`,
      name,
      email,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 500000000)}?w=150&auto=format&fit=crop&q=80`,
      role,
      status: 'online',
      cursorColor: '#F43F5E',
      createdBy: currentUser.email,
    };
    setTeammates((prev) => [...prev, newTm]);

    const log: ActivityItem = {
      id: `act_${Date.now()}`,
      projectId: currentProject.id,
      author: currentUser,
      action: 'invited teammate to workspace:',
      targetName: `${name} (${role})`,
      timestamp: 'Just now',
      type: 'approval',
    };
    setActivityLogs((prev) => [log, ...prev]);
  };

  const handleLogin = (user: AuthUser, org: Organization) => {
    setAuthUser(user);
    setCurrentOrganization(org);
    try {
      localStorage.setItem('mf_auth_user', JSON.stringify(user));
      localStorage.setItem('mf_auth_org', JSON.stringify(org));
    } catch (e) {}
  };

  const handleSignOut = () => {
    setAuthUser(null);
    setCurrentOrganization(null);
    try {
      localStorage.removeItem('mf_auth_user');
      localStorage.removeItem('mf_auth_org');
    } catch (e) {}
  };

  const isGuestShareLink = typeof window !== 'undefined' && (
    window.location.search.includes('guest_mode=true') ||
    window.location.search.includes('project=') ||
    window.location.search.includes('guest')
  );

  if (!authUser && !isGuestMode && !isGuestShareLink) {
    return <AuthPage onLogin={handleLogin} availableTeammates={teammates} />;
  }

  const effectiveGuestMode = isGuestMode || (!authUser && isGuestShareLink);

  const headerUser: AuthUser | undefined = authUser ? authUser : effectiveGuestMode ? {
    id: 'usr_guest',
    name: 'Guest Reviewer',
    email: 'guest@client.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'Reviewer',
    status: 'online',
    cursorColor: '#F59E0B',
    organizationName: 'Guest Review Mode'
  } : undefined;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Banner when in Guest Review Mode */}
      {effectiveGuestMode && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 flex items-center justify-between text-xs shadow-sm z-50">
          <div className="flex items-center gap-2">
            <span className="text-sm">👁️</span>
            <span>
              <strong>Guest Review Mode Active:</strong> You are viewing shared project <span className="underline">{currentProject.name}</span> as an invited reviewer (No login required).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGuestMode(false)}
              className="bg-slate-950 text-white hover:bg-slate-900 px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer"
            >
              Sign In as Workspace Admin
            </button>
          </div>
        </div>
      )}

      {/* Top Header Navigation */}
      <Header
        appName={appName}
        appIcon={appIcon}
        isGuestMode={effectiveGuestMode}
        onToggleGuestMode={() => setIsGuestMode(!effectiveGuestMode)}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        currentAsset={currentAsset}
        onSelectAsset={handleSelectAsset}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        teammates={teammates}
        isSimulatingPartner={isSimulatingPartner}
        onToggleSimulatePartner={() => setIsSimulatingPartner(!isSimulatingPartner)}
        onOpenNewProjectModal={() => setShowNewProjectModal(true)}
        onOpenShareModal={() => setShowShareModal(true)}
        onOpenNewAssetModal={() => setShowNewAssetModal(true)}
        currentUser={headerUser}
        currentOrganization={currentOrganization || undefined}
        onSignOut={handleSignOut}
        onOpenDomainModal={() => setShowDomainModal(true)}
        onOpenProfileSettings={() => setShowProfileSettingsModal(true)}
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onNotificationClick={(n) => {
          // Mark clicked notification as read
          setNotifications((prev) =>
            prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
          );

          // Find target pin by id or fallback to pin number match e.g. Pin #1
          let targetPin: Pin | undefined;
          if (n.pinId) {
            targetPin = pins.find((p) => p.id === n.pinId);
          }
          if (!targetPin) {
            const matchNum = n.title.match(/#(\d+)/) || n.message.match(/#(\d+)/);
            if (matchNum) {
              const pNum = parseInt(matchNum[1], 10);
              targetPin = pins.find((p) => p.number === pNum);
            }
          }

          const targetAssetId = targetPin?.assetId || n.assetId;

          let foundProject: Project | undefined;
          let foundAsset: Asset | undefined;

          if (targetAssetId) {
            for (const proj of projects) {
              const asset = proj.assets?.find((a) => a.id === targetAssetId);
              if (asset) {
                foundProject = proj;
                foundAsset = asset;
                break;
              }
            }
          }

          // Fallback if asset is in INITIAL_ASSETS
          if (!foundAsset && targetAssetId) {
            foundAsset = INITIAL_ASSETS.find((a) => a.id === targetAssetId);
            if (foundAsset) {
              foundProject = projects.find((p) => p.id === foundAsset?.projectId) || INITIAL_PROJECTS.find((p) => p.id === foundAsset?.projectId);
            }
          }

          if (foundProject) {
            setCurrentProject(foundProject);
          }
          if (foundAsset) {
            setCurrentAsset(foundAsset);
          }
          if (targetPin) {
            setSelectedPin(targetPin);
            if (targetPin.status === 'resolved' || targetPin.status === 'archived') {
              setFilterState((prev) => ({ ...prev, showResolved: true }));
            }
          }

          setViewMode('studio');
        }}
      />

      {/* Main Workspace View Switcher */}
      <main className="flex-1 min-h-0 min-w-0 flex overflow-hidden relative">
        {viewMode === 'dashboard' && (
          <ProjectsGridView
            appName={appName}
            appIcon={appIcon}
            onUpdateBranding={handleUpdateBranding}
            projects={projects}
            onSelectProject={handleSelectProject}
            onSelectAsset={handleSelectAsset}
            onOpenNewProjectModal={() => setShowNewProjectModal(true)}
            onOpenShareModal={() => setShowShareModal(true)}
            teammates={teammates}
            onUpdateTeammateRole={handleUpdateTeammateRole}
            currentUser={currentUser}
            onViewModeChange={setViewMode}
            initialTab={dashboardTab}
            onTabChange={setDashboardTab}
            onAddNewUrlAsset={handleAddNewUrlAsset}
            onDeleteProject={handleDeleteProject}
            onDeleteTeammate={handleDeleteTeammate}
            onRestoreProject={(archivedItem) => {
              // Restore an archived item back to active projects list
              const restoredAsset: Asset = {
                id: `asset_${Date.now()}`,
                projectId: `proj_${Date.now()}`,
                title: archivedItem.name,
                type: 'url',
                url: `https://${archivedItem.name.toLowerCase().replace(/\s+/g, '')}.com`,
                thumbnailUrl: archivedItem.thumbnailUrl,
                status: 'in_review',
                pinCount: archivedItem.pinCount,
                resolvedCount: archivedItem.resolvedCount
              };
              const restoredProject: Project = {
                id: `proj_${Date.now()}`,
                name: archivedItem.name,
                client: 'Restored Archive',
                description: 'Restored project from archive',
                color: 'from-blue-600 to-indigo-600',
                avatar: '📁',
                memberCount: 2,
                lastUpdated: 'Just now',
                ownerId: currentUser.id,
                assets: [restoredAsset]
              };
              setProjects((prev) => [restoredProject, ...prev]);
            }}
          />
        )}

        {viewMode === 'studio' && (
          <>
            <AnnotationStudio
              currentProject={currentProject}
              currentAsset={currentAsset}
              onUpdateAssetUrl={handleUpdateAssetUrl}
              pins={pins}
              selectedPin={selectedPin}
              onSelectPin={setSelectedPin}
              onAddPin={handleAddPin}
              teammates={teammates}
              currentUser={currentUser}
              filterState={filterState}
              onUpdateFilter={handleUpdateFilter}
              onRunAiAudit={handleRunAiAudit}
              isAuditing={isAuditing}
              isSimulatingPartner={isSimulatingPartner}
            />
            <SidebarDiscussion
              pins={pins.filter((p) => p.assetId === currentAsset.id)}
              selectedPin={selectedPin}
              onSelectPin={setSelectedPin}
              onUpdatePinStatus={handleUpdatePinStatus}
              onUpdatePinAssignee={handleUpdatePinAssignee}
              onAddComment={handleAddComment}
              teammates={teammates}
              currentUser={currentUser}
              onNotify={handleNotifyMember}
              rubricRules={rubricRules}
              onUpdatePinQAError={handleUpdatePinQAError}
              onDeletePin={handleDeletePin}
              onDeleteComment={handleDeleteComment}
            />
          </>
        )}

        {viewMode === 'qascore' && (
          <QAScoreManager
            projects={projects}
            pins={pins}
            teammates={teammates}
            rubricRules={rubricRules}
            onUpdateRubricRules={handleUpdateRubricRules}
            onUpdatePinQAError={handleUpdatePinQAError}
            currentUser={currentUser}
            onSelectProject={(proj) => {
              setCurrentProject(proj);
              if (proj.assets?.[0]) setCurrentAsset(proj.assets[0]);
              setViewMode('studio');
            }}
            onViewModeChange={(mode) => setViewMode(mode)}
            onNavigateTab={handleNavigateDashboardTab}
          />
        )}

        {viewMode === 'kanban' && (
          <KanbanBoard
            pins={pins}
            currentProject={currentProject}
            currentAsset={currentAsset}
            onUpdatePinStatus={handleUpdatePinStatus}
            onSelectPin={(pin) => {
              const asset = currentProject.assets.find((a) => a.id === pin.assetId) || currentAsset;
              setCurrentAsset(asset);
              setSelectedPin(pin);
              setViewMode('studio');
            }}
            teammates={teammates}
            onSwitchToStudio={(asset) => {
              setCurrentAsset(asset);
              setViewMode('studio');
            }}
          />
        )}

        {viewMode === 'matrix' && (
          <FeedbackMatrix
            pins={pins}
            currentProject={currentProject}
            onUpdatePinStatus={handleUpdatePinStatus}
            onSelectPin={(pin) => {
              const asset = currentProject.assets.find((a) => a.id === pin.assetId) || currentAsset;
              setCurrentAsset(asset);
              setSelectedPin(pin);
              setViewMode('studio');
            }}
            teammates={teammates}
            onSwitchToStudio={(asset) => {
              setCurrentAsset(asset);
              setViewMode('studio');
            }}
          />
        )}

        {viewMode === 'activity' && (
          <TeamActivityFeed
            activityLogs={activityLogs}
            teammates={teammates}
            currentProject={currentProject}
            onInviteTeammate={handleInviteTeammate}
          />
        )}
      </main>

      {/* Modals */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
      />
      <NewAssetModal
        isOpen={showNewAssetModal}
        onClose={() => setShowNewAssetModal(false)}
        onCreateAsset={handleCreateAsset}
      />
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        currentProject={currentProject}
      />
      <DomainSecurityModal
        isOpen={showDomainModal}
        onClose={() => setShowDomainModal(false)}
        currentOrganization={currentOrganization || {
          id: 'org-yda-enterprise',
          name: 'YourDigitalAgents Enterprise',
          domain: 'yourdigitalagents.com',
          allowedDomains: getAllowedDomains(),
          plan: 'Enterprise',
          ssoEnabled: true,
          maxSeats: 'Unlimited',
          activeSeats: 12
        }}
        teammates={teammates}
        onDomainsUpdated={(newDoms) => {
          if (currentOrganization) {
            const updated = { ...currentOrganization, allowedDomains: newDoms };
            setCurrentOrganization(updated);
            try { localStorage.setItem('mf_auth_org', JSON.stringify(updated)); } catch (e) {}
          }
        }}
      />
      <ProfileSettingsModal
        isOpen={showProfileSettingsModal}
        onClose={() => setShowProfileSettingsModal(false)}
        currentUser={currentUser}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
}
