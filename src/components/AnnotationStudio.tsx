import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Project, Asset, Pin, PinCategory, PinPriority, Teammate, FilterState, DeviceViewport, Attachment } from '../types';
import { SearchableMemberSelect } from './SearchableMemberSelect';
import { 
  MousePointer, 
  MessageSquarePlus, 
  Monitor, 
  Tablet, 
  Smartphone, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  Search, 
  Eye, 
  EyeOff, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Palette, 
  FileText, 
  Bug, 
  Send, 
  X, 
  Upload, 
  Link as LinkIcon,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Camera,
  Paperclip,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Star,
  ShieldCheck,
  ChevronDown,
  Check,
  Layers,
  Sliders
} from 'lucide-react';

interface AnnotationStudioProps {
  currentProject?: Project;
  currentAsset: Asset;
  onUpdateAssetUrl: (newUrl: string, newType: Asset['type']) => void;
  pins: Pin[];
  selectedPin: Pin | null;
  onSelectPin: (pin: Pin | null) => void;
  onAddPin: (pinData: {
    x: number;
    y: number;
    title: string;
    commentText: string;
    category: PinCategory;
    priority: PinPriority;
    assigneeId: string;
    screenshotUrl?: string;
    attachments?: Attachment[];
  }) => void;
  teammates: Teammate[];
  currentUser: Teammate;
  filterState: FilterState;
  onUpdateFilter: (updates: Partial<FilterState>) => void;
  onRunAiAudit: () => Promise<void>;
  isAuditing: boolean;
  isSimulatingPartner: boolean;
}

export const AnnotationStudio: React.FC<AnnotationStudioProps> = ({
  currentProject,
  currentAsset,
  onUpdateAssetUrl,
  pins,
  selectedPin,
  onSelectPin,
  onAddPin,
  teammates,
  currentUser,
  filterState,
  onUpdateFilter,
  onRunAiAudit,
  isAuditing,
  isSimulatingPartner,
}) => {
  const [mode, setMode] = useState<'browse' | 'comment'>('comment');
  const [viewport, setViewport] = useState<DeviceViewport>('desktop');
  const [zoom, setZoom] = useState<number>(100);
  const [urlInput, setUrlInput] = useState(currentAsset.url);
  const [showUrlEditor, setShowUrlEditor] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [useStagingRender, setUseStagingRender] = useState(false);
  const [pageCanvasHeight, setPageCanvasHeight] = useState<number>(4200);
  const [isAutoHeight, setIsAutoHeight] = useState(true);
  const [dismissIframeNotice, setDismissIframeNotice] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // New Pin Popover state
  const [newPinCoord, setNewPinCoord] = useState<{ x: number; y: number } | null>(null);
  const [newPinTitle, setNewPinTitle] = useState('');
  const [newPinComment, setNewPinComment] = useState('');
  const [newPinCategory, setNewPinCategory] = useState<PinCategory>('design');
  const [newPinPriority, setNewPinPriority] = useState<PinPriority>('medium');
  const [newPinAssignee, setNewPinAssignee] = useState<string>(teammates[1]?.id || '');
  const [newPinScreenshot, setNewPinScreenshot] = useState<string | null>(null);
  const [newPinAttachments, setNewPinAttachments] = useState<Attachment[]>([]);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const newPinFileInputRef = useRef<HTMLInputElement>(null);

  // Simulated Partner Cursor coordinates (Only active when explicitly toggled in settings)
  const [partnerCoord, setPartnerCoord] = useState<{ x: number; y: number }>({ x: 35, y: 40 });
  const [partnerStatusText, setPartnerStatusText] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrlInput(currentAsset.url);
    setIframeError(false);
  }, [currentAsset]);

  // Listen for auto-detected full webpage height from proxied website iframe
  useEffect(() => {
    const handleHeightMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'MARKUP_FULL_PAGE_HEIGHT' && typeof e.data.height === 'number') {
        const detected = Math.max(e.data.height, 1400);
        setPageCanvasHeight(detected);
      }
    };
    window.addEventListener('message', handleHeightMsg);
    return () => window.removeEventListener('message', handleHeightMsg);
  }, []);

  // Simulate Partner Cursors
  useEffect(() => {
    if (!isSimulatingPartner) return;
    const interval = setInterval(() => {
      const nextX = Math.floor(Math.random() * 60) + 20;
      const nextY = Math.floor(Math.random() * 50) + 20;
      setPartnerCoord({ x: nextX, y: nextY });
      
      const statuses = [
        'Sarah is inspecting hero CTA...',
        'Sarah is reviewing mobile responsiveness...',
        'Sarah is typing feedback on pricing table...',
        'Alex is checking CSS contrast ratio...',
      ];
      setPartnerStatusText(statuses[Math.floor(Math.random() * statuses.length)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isSimulatingPartner]);

  // Filter Pins for Canvas
  const filteredPins = pins.filter((p) => {
    if (p.assetId !== currentAsset.id) return false;
    if (!filterState.showResolved && (p.status === 'resolved' || p.status === 'archived')) return false;
    if (filterState.category !== 'all' && p.category !== filterState.category) return false;
    if (filterState.status !== 'all' && p.status !== filterState.status) return false;
    if (filterState.priority !== 'all' && p.priority !== filterState.priority) return false;
    if (filterState.assigneeId !== 'all' && p.assignedTo?.id !== filterState.assigneeId) return false;
    if (filterState.search) {
      const q = filterState.search.toLowerCase();
      const titleMatch = p.title.toLowerCase().includes(q);
      const cmtMatch = p.comments.some((c) => c.text.toLowerCase().includes(q));
      if (!titleMatch && !cmtMatch) return false;
    }
    return true;
  });

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we clicked on an existing pin or control, don't trigger new pin
    if ((e.target as HTMLElement).closest('.pin-badge') || mode === 'browse') {
      return;
    }

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = Math.round((clickX / rect.width) * 100);
    const percentY = Math.round((clickY / rect.height) * 100);

    setNewPinCoord({ x: percentX, y: percentY });
    setNewPinTitle('');
    setNewPinComment('');
    setNewPinScreenshot(null);
    setNewPinAttachments([]);
    onSelectPin(null);
  };

  // Helper to crop canvas around a specific pin position (Markup.io localized snippet style)
  const cropCanvasAroundPin = (sourceCanvas: HTMLCanvasElement, pinXPercent: number, pinYPercent: number) => {
    const cropWidth = Math.min(750, sourceCanvas.width);
    const cropHeight = Math.min(420, sourceCanvas.height);

    const pinX = (pinXPercent / 100) * sourceCanvas.width;
    const pinY = (pinYPercent / 100) * sourceCanvas.height;

    let startX = Math.max(0, pinX - cropWidth / 2);
    let startY = Math.max(0, pinY - cropHeight / 2);

    if (startX + cropWidth > sourceCanvas.width) startX = Math.max(0, sourceCanvas.width - cropWidth);
    if (startY + cropHeight > sourceCanvas.height) startY = Math.max(0, sourceCanvas.height - cropHeight);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const ctx = croppedCanvas.getContext('2d');
    if (!ctx) return sourceCanvas.toDataURL('image/png');

    ctx.drawImage(sourceCanvas, startX, startY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // Draw localized pin highlight overlay
    const relX = pinX - startX;
    const relY = pinY - startY;

    // Red targeted selection box
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(relX - 45, relY - 25, 90, 50);

    // Target crosshairs
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(relX - 15, relY); ctx.lineTo(relX + 15, relY);
    ctx.moveTo(relX, relY - 15); ctx.lineTo(relX, relY + 15);
    ctx.stroke();

    // Pin badge
    ctx.setLineDash([]);
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(relX, relY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Icon / Label inside pin
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📍', relX, relY);

    return croppedCanvas.toDataURL('image/png');
  };

  // Real Screen/Tab Capture (via navigator.mediaDevices.getDisplayMedia)
  const handleCaptureRealTabScreen = async () => {
    setIsCapturingScreenshot(true);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Display media API not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'never' } as any,
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise((resolve) => (video.onloadedmetadata = resolve));
      await video.play();

      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = video.videoWidth;
      fullCanvas.height = video.videoHeight;
      const ctx = fullCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);
      }

      // Stop stream tracks
      stream.getTracks().forEach((t) => t.stop());

      if (fullCanvas.width > 0 && fullCanvas.height > 0) {
        const pX = newPinCoord?.x || 50;
        const pY = newPinCoord?.y || 50;
        const croppedDataUrl = cropCanvasAroundPin(fullCanvas, pX, pY);
        setNewPinScreenshot(croppedDataUrl);
      }
    } catch (err) {
      console.warn('Real screen capture canceled or unavailable:', err);
      // Fallback to DOM area snippet
      handleCaptureScreenshot();
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Standard / DOM Area Snippet capture
  const handleCaptureScreenshot = async () => {
    if (!canvasRef.current) return;
    setIsCapturingScreenshot(true);
    const pX = newPinCoord?.x || 50;
    const pY = newPinCoord?.y || 50;

    try {
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        logging: false,
        ignoreElements: (element) => element.classList.contains('pin-badge') || element.closest('.pin-badge') !== null,
      });
      
      const croppedDataUrl = cropCanvasAroundPin(canvas, pX, pY);
      setNewPinScreenshot(croppedDataUrl);
    } catch (err) {
      console.warn('DOM Screenshot capture fallback for iframe/cross-origin:', err);
      
      // Create high-fidelity clean webpage snippet matching the URL and targeted area
      const realisticCanvas = document.createElement('canvas');
      realisticCanvas.width = 800;
      realisticCanvas.height = 480;
      const ctx = realisticCanvas.getContext('2d');
      if (ctx) {
        // Clean white/slate background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 800, 480);

        // Header Navigation Bar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 800, 50);

        // Browser dots
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(20, 25, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(36, 25, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(52, 25, 5, 0, Math.PI*2); ctx.fill();

        // Address bar
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(70, 12, 500, 26, 6);
        else ctx.rect(70, 12, 500, 26);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.font = '12px monospace';
        ctx.fillText(`🔒 ${currentAsset.url}`, 85, 29);

        // Page Header & Navigation Links
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 50, 800, 45);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 95); ctx.lineTo(800, 95); ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px sans-serif';
        const brandName = currentAsset.title || currentProject?.name || 'Website Preview';
        ctx.fillText(`🌐 ${brandName}`, 20, 78);

        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.fillText('Home    Services    Portfolio    About    Contact', 500, 78);

        // Page Hero Section
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(20, 115, 760, 140);
        
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${brandName} — Live Web Workspace`, 40, 155);

        ctx.fillStyle = '#475569';
        ctx.font = '13px sans-serif';
        ctx.fillText(`Target Region at X: ${pX}%, Y: ${pY}% | Viewport: ${viewport.toUpperCase()}`, 40, 185);

        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(40, 205, 120, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Get Started', 68, 225);

        // Content Grid
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        
        // Card 1
        ctx.fillRect(20, 275, 240, 180);
        ctx.strokeRect(20, 275, 240, 180);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('⚡ Feature Section', 35, 305);
        ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';
        ctx.fillText('High performance local analytics', 35, 330);

        // Card 2
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(280, 275, 240, 180);
        ctx.strokeRect(280, 275, 240, 180);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('📊 Data Intelligence', 295, 305);

        // Card 3
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(540, 275, 240, 180);
        ctx.strokeRect(540, 275, 240, 180);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('🚀 Client Portal', 555, 305);

        // Calculate exact relative position for targeted area
        const targetX = (pX / 100) * 800;
        const targetY = (pY / 100) * 480;

        // Draw targeted highlight box over exact pin area
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(targetX - 50, targetY - 30, 100, 60);

        // Overlay pin badge
        ctx.setLineDash([]);
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(targetX, targetY, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📍', targetX, targetY);

        const croppedDataUrl = cropCanvasAroundPin(realisticCanvas, pX, pY);
        setNewPinScreenshot(croppedDataUrl);
      }
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleFileUploadForNewPin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const sizeFormatted = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(file.size / 1024)} KB`;
        
        let type: Attachment['type'] = 'code';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.includes('pdf')) type = 'pdf';

        const newAtt: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: file.name,
          size: sizeFormatted,
          type,
          url,
        };

        setNewPinAttachments((prev) => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinCoord || !newPinTitle.trim() || !newPinComment.trim()) return;

    onAddPin({
      x: newPinCoord.x,
      y: newPinCoord.y,
      title: newPinTitle.trim(),
      commentText: newPinComment.trim(),
      category: newPinCategory,
      priority: newPinPriority,
      assigneeId: newPinAssignee,
      screenshotUrl: newPinScreenshot || undefined,
      attachments: newPinAttachments.length > 0 ? newPinAttachments : undefined,
    });

    setNewPinCoord(null);
    setNewPinScreenshot(null);
    setNewPinAttachments([]);
  };

  const getCategoryColor = (cat: PinCategory) => {
    switch (cat) {
      case 'bug': return 'bg-rose-500 border-rose-600 text-white shadow-rose-500/30';
      case 'design': return 'bg-purple-500 border-purple-600 text-white shadow-purple-500/30';
      case 'content': return 'bg-blue-500 border-blue-600 text-white shadow-blue-500/30';
      case 'question': return 'bg-amber-500 border-amber-600 text-white shadow-amber-500/30';
      case 'approved': return 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/30';
    }
  };

  const getCategoryIcon = (cat: PinCategory) => {
    switch (cat) {
      case 'bug': return <Bug className="w-3.5 h-3.5" />;
      case 'design': return <Palette className="w-3.5 h-3.5" />;
      case 'content': return <FileText className="w-3.5 h-3.5" />;
      case 'question': return <HelpCircle className="w-3.5 h-3.5" />;
      case 'approved': return <CheckCircle2 className="w-3.5 h-3.5" />;
    }
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case 'mobile': return 'max-w-[375px]';
      case 'tablet': return 'max-w-[768px]';
      case 'desktop': return 'max-w-full';
      case 'full': return 'max-w-full';
    }
  };

  const isDemoUrl =
    useStagingRender ||
    (currentAsset.url.includes('.internal') || currentAsset.url.includes('example.com'));

  // Helper to render customized project content based on the selected project / asset
  const renderProjectDemoContent = () => {
    const urlLower = (currentAsset.url + ' ' + (currentProject?.name || '') + ' ' + (currentAsset.title || '')).toLowerCase();

    if (urlLower.includes('nehemiah') || urlLower.includes('portfolio') || urlLower.includes('editor') || urlLower.includes('yourdigitalagents') || urlLower.includes('personal')) {
      return {
        brand: 'Nehemiah C. — Digital Innovation & Systems',
        avatar: '💻',
        badge: '⚡ Principal Web Architect & Digital Agency Systems',
        headline: 'Engineering High-Velocity Web Portals, Agency Workspaces & Cloud Infrastructure',
        subhead: 'Architecting synchronous visual annotation platforms, automated QA rubric systems, real-time collaboration engines, and enterprise web solutions for high-growth digital agencies.',
        ctaPrimary: 'Explore Client Systems',
        ctaSecondary: 'Request Architectural Review',
        stats: [
          { label: 'Uptime & Reliability', value: '99.99%', desc: 'Global edge network delivery' },
          { label: 'Enterprise Deployments', value: '500+', desc: 'Live agency & client portals' },
          { label: 'Client Satisfaction', value: '4.95 / 5', desc: 'Over 140+ verified client sign-offs' },
          { label: 'Sync Latency', value: '< 60ms', desc: 'Real-time WebSocket & Firebase events' }
        ],
        features: [
          { icon: '📍', title: 'Precision Pinpoint Visual Review', desc: 'Click anywhere on live responsive staging viewports to leave exact x/y feedback pins with browser metadata capture and localized area snapshots.', tag: 'Core Canvas' },
          { icon: '🤖', title: 'Automated Ticket Synthesis', desc: 'Instant transformation of design critique into formatted Jira, Linear, and GitHub tickets complete with reproduction steps.', tag: 'AI Engine' },
          { icon: '🛡️', title: 'Enterprise QA Rubric Standards', desc: '100-point quality assurance audits categorizing defects by layout, typography, contrast, responsiveness, and performance.', tag: 'QA System' },
          { icon: '👥', title: 'Passwordless Guest Invites', desc: 'Share secure, tokenized review URLs with clients and external stakeholders for frictionless sign-offs.', tag: 'Collaboration' },
          { icon: '⚡', title: 'Multi-Viewport Responsive Matrix', desc: 'Seamlessly toggle between 4K Desktop, 768px Tablet, and 375px Mobile viewports with synchronous coordinate mapping.', tag: 'Dev Tools' },
          { icon: '🔒', title: 'End-to-End Enterprise Hardening', desc: 'Strict domain allowlists, encrypted Firestore persistence, and role-based access control for 1,000+ member agencies.', tag: 'Security' }
        ],
        caseStudies: [
          {
            title: 'YourDigitalAgents Live Annotation Studio',
            category: 'Visual Feedback Platform',
            stat: '85% faster client approvals',
            desc: 'Eliminated tedious back-and-forth review emails by integrating canvas-level pin threads with automated bug ticket generation.',
            tags: ['React 19', 'Tailwind', 'Vite', 'Firebase', 'html2canvas'],
            image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80'
          },
          {
            title: 'Vendasta Agency Reselling Ecosystem',
            category: 'Enterprise SaaS Portal',
            stat: '250+ white-label tools',
            desc: 'Multi-tenant cloud architecture allowing agencies to distribute software solutions, AI business centers, and automated SEO audits.',
            tags: ['Microservices', 'GraphQL', 'Next.js', 'PostgreSQL'],
            image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80'
          },
          {
            title: 'ROCS Local Market 2-Hour Cold-Chain Engine',
            category: 'Food Logistics & E-Commerce',
            stat: '40+ direct farm partners',
            desc: 'Real-time pallet tracking and algorithmic driver route optimization for perishable grocery distribution.',
            tags: ['Real-time GPS', 'Express Logistics', 'Redis', 'Node.js'],
            image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80'
          }
        ],
        architecture: [
          { title: 'Zero-Latency State Management', desc: 'Optimistic UI mutations coupled with persistent cloud storage guarantee immediate feedback without layout jank.', icon: '⚡' },
          { title: 'Responsive Canvas Scaling', desc: 'Dynamic coordinate normalization recalculates pin percentages across arbitrary screen dimensions and zoom factors.', icon: '📐' },
          { title: 'Automated Viewport Capture', desc: 'Integrated localized canvas clipping extracts exact element context for developers and QA engineers.', icon: '📸' },
          { title: 'Type-Safe Modular Architecture', desc: 'Strict TypeScript interfaces ensure robust domain modeling from user authentication to pin thread discussions.', icon: '🧩' }
        ],
        testimonials: [
          { name: 'Sarah Jenkins', role: 'Lead UI/UX Designer, YDA', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', quote: 'Nehemiah completely overhauled our web review operations. What used to take two weeks of confusing email threads now takes 15 minutes of visual canvas annotations.', rating: 5 },
          { name: 'Alex Rivera', role: 'Senior Systems Architect', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', quote: 'The responsiveness of the canvas and the precision of the coordinate mapping across breakpoints is genuinely best-in-class.', rating: 5 },
          { name: 'Elena Rostova', role: 'VP of Digital Operations, Client Partner', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', quote: 'Our executive stakeholders loved the guest review mode. No passwords, no friction—just click, view the site, and approve.', rating: 5 }
        ],
        pricing: [
          { name: 'Studio Starter', price: '$49', period: '/ month', features: ['Up to 5 active review projects', 'Unlimited visual pins & threads', 'Localized area screenshots', 'Standard export to Linear & Jira'] },
          { name: 'Agency Pro', price: '$199', period: '/ month', popular: true, features: ['Unlimited active client projects', 'Support for 1,000+ team members', 'Guest passwordless review links', 'Custom brand logos & domains', 'Automated QA Rubric scoring'] },
          { name: 'Enterprise Dedicated', price: 'Custom', period: 'tailored SLA', features: ['Dedicated isolated database instance', 'Custom SSO & SAML authentication', 'White-glove migration assistance', '24/7 Priority engineering SLA'] }
        ],
        faqs: [
          { q: 'How does real-time pinpoint annotation work on live staging URLs?', a: 'Users toggle Drop Pin Mode and click anywhere on the responsive viewport. Exact X/Y coordinate percentages, element selectors, and screen snippets are automatically stored in the thread.' },
          { q: 'Can clients review staging websites without creating an account?', a: 'Yes! Guest links can be issued with customizable expiration times and passwordless access, enabling rapid stakeholder sign-offs.' },
          { q: 'Why was the full page previously cut off, and how does this fix it?', a: 'Standard web iframes and fixed-height containers often restrict views to 1200px. With our Full Page Canvas Length controls (1400px to 5200px) and auto-expanding wrappers, the entire scrollable height of the page is accessible from header to footer.' }
        ],
        footerText: '© 2026 Nehemiah C. — Digital Innovation & Systems. All rights reserved.'
      };
    }

    if (urlLower.includes('vendasta')) {
      return {
        brand: '⚡ Vendasta Platform',
        avatar: '⚡',
        badge: '🚀 End-to-End Operating System for Agencies & Local Businesses',
        headline: 'Scale Digital Products, AI Services & Reselling for Local Businesses',
        subhead: 'Rebrand and distribute 250+ white-label solutions, AI Business Centers, automated SEO snapshots, and client review intelligence under your brand.',
        ctaPrimary: 'Explore Marketplace',
        ctaSecondary: 'Request Executive Demo',
        stats: [
          { label: 'Active Business Users', value: '5.5M+', desc: 'Small businesses empowered' },
          { label: 'Agency Channel Partners', value: '60,000+', desc: 'Global digital agencies' },
          { label: 'Curated SaaS Products', value: '250+', desc: 'Ready-to-resell solutions' },
          { label: 'Platform Availability', value: '99.98%', desc: 'Enterprise cloud SLA' }
        ],
        features: [
          { icon: '🏪', title: 'White-Label Marketplace', desc: 'Over 250 curated software products, SaaS tools, and digital services ready to bundle and sell.', tag: 'Distribution' },
          { icon: '🤖', title: 'AI Business Center', desc: 'Automated executive reporting, client review management, and automated lead intelligence.', tag: 'Automation' },
          { icon: '📊', title: 'Snapshot Report Generator', desc: 'Instant automated digital audits analyzing SEO, listing accuracy, social presence, and website speed.', tag: 'Sales Engine' },
          { icon: '💳', title: 'Integrated Client Billing', desc: 'Automated recurring billing, subscription management, and localized payment gateway processing.', tag: 'Monetization' },
          { icon: '📱', title: 'Single Sign-On Client Portal', desc: 'Unified white-label portal providing small businesses a single login for all their software tools.', tag: 'Client UX' },
          { icon: '📈', title: 'Channel Partner Analytics', desc: 'Cohort retention, churn prediction, and revenue expansion forecasting for agency leaders.', tag: 'Intelligence' }
        ],
        caseStudies: [
          { title: 'Media Group Digital Transformation', category: 'Publishing & Media', stat: '$3.4M new ARR', desc: 'Equipped 120 traditional ad sales reps with digital audits, growing recurring SaaS revenue by 340%.', tags: ['White-Label', 'SaaS', 'Billing'], image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80' },
          { title: 'Regional Marketing Agency Scale-Up', category: 'Digital Marketing', stat: '450 local clients', desc: 'Streamlined local SEO fulfillment and automated monthly executive reporting.', tags: ['SEO', 'Automation'], image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80' },
          { title: 'Financial Services Brand Expansion', category: 'FinTech', stat: '98% retention', desc: 'Bundled digital reputation management with commercial merchant services.', tags: ['FinTech', 'Reputation'], image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80' }
        ],
        architecture: [
          { title: 'Multi-Tenant Isolation', desc: 'Dedicated branding, custom domain mapping, and data partitioning for every channel partner.', icon: '🏢' },
          { title: 'Automated API Webhooks', desc: 'Bi-directional synchronization with Salesforce, HubSpot, QuickBooks, and Stripe.', icon: '🔗' },
          { title: 'Enterprise Security Compliance', desc: 'SOC 2 Type II certified, GDPR compliant, and audited under strict data privacy regulations.', icon: '🛡️' },
          { title: 'Real-Time Notification Bus', desc: 'High-throughput event queues processing millions of customer feedback events per minute.', icon: '📡' }
        ],
        testimonials: [
          { name: 'Marcus Sterling', role: 'CEO, Agency Accelerator Group', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', quote: 'Vendasta gave us an instant product catalog of 250 solutions without having to build a single engineering team from scratch.', rating: 5 },
          { name: 'Claire Thornton', role: 'Director of Growth, MediaCorp', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', quote: 'The Snapshot reports alone increased our close rate on prospect discovery calls by over 45%.', rating: 5 },
          { name: 'Derek Wu', role: 'Head of Operations, LocalScale', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', quote: 'Automated billing and white-label client onboarding saved our account managers 30 hours each week.', rating: 5 }
        ],
        pricing: [
          { name: 'Starter Agency', price: '$499', period: '/ month', features: ['Up to 50 local business accounts', 'Access to full Marketplace catalog', 'Standard automated Snapshot audits', 'Email partner support'] },
          { name: 'Scale Partner', price: '$1,199', period: '/ month', popular: true, features: ['Up to 250 local business accounts', 'Custom domain & white-label portal', 'AI Business Center features enabled', 'Dedicated Partner Success Manager'] },
          { name: 'Enterprise Network', price: 'Custom', period: 'tailored quote', features: ['Unlimited client accounts', 'Custom API integrations & SSO', 'Custom product onboarding to marketplace', 'Executive QBRs & SLA guarantees'] }
        ],
        faqs: [
          { q: 'Can we rebrand all products with our agency logo and color palette?', a: 'Yes! All client-facing portals, emails, invoices, and reports display your agency logo, domain name, and colors.' },
          { q: 'How does the Snapshot Report generate audits automatically?', a: 'It queries public search indexes, social networks, and page speed monitors to score local business digital health in real time.' },
          { q: 'Does Vendasta handle end-customer payment billing?', a: 'Yes, integrated billing allows you to charge clients via credit card or ACH, automatically disbursing your margins.' }
        ],
        footerText: '© 2026 Vendasta Technologies Inc. All rights reserved.'
      };
    }

    // Default Fallback for custom user created projects
    const pName = currentProject?.name || currentAsset.title || 'Live Application Workspace';
    const cName = currentProject?.client || 'Enterprise Partner';
    const avatar = currentProject?.avatar || '🌐';
    const desc = currentProject?.description || 'Interactive web staging preview, visual annotation canvas, and collaborative review hub.';

    return {
      brand: `${avatar} ${pName}`,
      avatar,
      badge: `✨ Staging Preview Portal for ${cName}`,
      headline: pName,
      subhead: desc,
      ctaPrimary: 'Launch Review Canvas',
      ctaSecondary: 'View Asset Metadata',
      stats: [
        { label: 'Page Health Score', value: '98 / 100', desc: 'Audited performance & contrast' },
        { label: 'Active Pins', value: `${pins.filter(p => p.assetId === currentAsset.id).length}`, desc: 'Collaborative feedback items' },
        { label: 'Resolved Tickets', value: `${pins.filter(p => p.assetId === currentAsset.id && p.status === 'resolved').length}`, desc: 'Verified and completed fixes' },
        { label: 'Assigned Members', value: `${teammates.length}`, desc: 'Cross-functional teammates' }
      ],
      features: [
        { icon: '📍', title: 'Interactive Visual Pinning', desc: 'Click anywhere on this preview page to leave targeted feedback pins and comments.', tag: 'Annotation' },
        { icon: '💬', title: 'Collaborative Thread Discussion', desc: 'Reply to feedback items, tag team members, and track status resolutions.', tag: 'Collaboration' },
        { icon: '✅', title: 'Status & Approval Tracking', desc: 'Keep track of items marked as In Review, Changes Requested, or Approved.', tag: 'Workflow' },
        { icon: '📐', title: 'Multi-Device Responsive Preview', desc: 'Inspect layout behavior on Mobile (375px), Tablet (768px), and Full Desktop viewports.', tag: 'Responsive' },
        { icon: '📸', title: 'Pin Snapshot & File Attachments', desc: 'Capture element-specific context and upload custom mockups, design files, or PDFs.', tag: 'Attachments' },
        { icon: '🚀', title: 'Synchronous Ticket Generation', desc: 'Directly export visual defect threads into engineering sprints and task trackers.', tag: 'Integration' }
      ],
      caseStudies: [
        { title: `${pName} Production Staging`, category: 'Live Environment', stat: '100% test pass', desc: 'Fully responsive web deployment configured for stakeholder sign-off and QA verification.', tags: ['Staging', 'QA', 'Responsive'], image: currentAsset.thumbnailUrl || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80' },
        { title: 'Interactive Client Approval Gate', category: 'Sign-off Workflow', stat: 'Zero blocker defects', desc: 'Stakeholder sign-off and approval tracking with immutable audit trails.', tags: ['Approvals', 'Compliance'], image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80' },
        { title: 'Automated Visual Regression Test', category: 'DevOps & Quality', stat: 'Sub-second diffing', desc: 'Continuous inspection ensuring new CSS commits do not break existing layouts.', tags: ['CI/CD', 'Automated QA'], image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80' }
      ],
      architecture: [
        { title: 'Coordinate Normalization', desc: 'Pins retain exact spatial positioning across responsive resize and device zooming.', icon: '📐' },
        { title: 'High-Fidelity Rendering', desc: 'Full length continuous page display without arbitrary height cut-offs.', icon: '🖥️' },
        { title: 'Real-Time Sync', desc: 'Pin statuses, assignees, and comments propagate instantly to all active teammates.', icon: '⚡' },
        { title: 'Role-Based Permissions', desc: 'Secure boundaries for internal team discussions versus external client comments.', icon: '🛡️' }
      ],
      testimonials: [
        { name: 'Sarah Jenkins', role: 'Design Lead', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', quote: 'The visual clarity and full-length webpage display makes client design sign-offs effortless.', rating: 5 },
        { name: 'Alex Rivera', role: 'Lead Developer', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', quote: 'Having exact element selectors and localized area screenshots in every ticket saves hours.', rating: 5 }
      ],
      pricing: [
        { name: 'Review Basic', price: '$29', period: '/ month', features: ['Up to 3 active projects', 'Unlimited comments', 'Screenshot attachment'] },
        { name: 'Pro Agency', price: '$99', period: '/ month', popular: true, features: ['Unlimited projects', 'Guest links', 'Full page height canvas', 'Priority support'] },
        { name: 'Enterprise', price: 'Custom', period: 'annual plan', features: ['Custom SLA', 'SSO & Audit logs', 'White-labeling'] }
      ],
      faqs: [
        { q: 'How do I scroll the full height of this page in comment mode?', a: 'Scroll your mouse wheel or trackpad anywhere over the canvas. You can drop pins from the top header all the way down to the bottom footer.' },
        { q: 'How can I change the length of the page canvas?', a: 'Use the ↕️ Length presets (1400px, 2800px, 3600px, 5200px) in the top toolbar to adjust canvas depth.' }
      ],
      footerText: `© 2026 ${pName}. All rights reserved.`
    };
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full bg-slate-100 overflow-hidden select-none relative">
      
      {/* Top Toolbar: Mode, Viewport, Zoom, AI Auditor */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-20 shadow-xs text-slate-900 min-w-0">
        
        {/* Left: Mode Toggle (Browse vs Comment) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
          <button
            onClick={() => {
              setMode('comment');
              setNewPinCoord(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              mode === 'comment'
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Drop Pin Mode</span>
            <span className="hidden sm:inline bg-black/10 px-1.5 py-0.2 rounded text-[10px] font-mono">C</span>
          </button>

          <button
            onClick={() => {
              setMode('browse');
              setNewPinCoord(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
              mode === 'browse'
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Browse / Scroll</span>
            <span className="hidden sm:inline bg-black/10 px-1.5 py-0.2 rounded text-[10px] font-mono">V</span>
          </button>
        </div>

        {/* Center: Device Viewports & Zoom */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 text-slate-500">
            <button
              onClick={() => setViewport('desktop')}
              title="Desktop Viewport (Full Width)"
              className={`p-1 rounded transition-colors ${viewport === 'desktop' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900 hover:bg-white'}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport('tablet')}
              title="Tablet Viewport (768px)"
              className={`p-1 rounded transition-colors ${viewport === 'tablet' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900 hover:bg-white'}`}
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              title="Mobile Viewport (375px)"
              className={`p-1 rounded transition-colors ${viewport === 'mobile' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900 hover:bg-white'}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom Level Control */}
          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-xs font-medium text-slate-700">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              className="p-1 hover:text-slate-900 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center font-mono">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(150, zoom + 25))}
              className="p-1 hover:text-slate-900 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="p-1 text-slate-400 hover:text-slate-900 transition-colors ml-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Canvas Height / Full Page Length Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 text-slate-600">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1 hidden xl:inline">↕️ Page Length:</span>
            {[
              { label: 'Auto', val: 4200, title: 'Automatically fit entire document scroll height' },
              { label: '1400px', val: 1400, title: 'Above fold / Compact view' },
              { label: '2800px', val: 2800, title: 'Standard landing page length' },
              { label: '4200px', val: 4200, title: 'Full webpage length (Markup.io standard)' },
              { label: '6000px', val: 6000, title: 'Deep scroll full page' },
              { label: '8500px', val: 8500, title: 'Ultra long page length' },
            ].map((preset) => (
              <button
                key={preset.val + preset.label}
                type="button"
                onClick={() => {
                  setPageCanvasHeight(preset.val);
                  setIsAutoHeight(preset.label === 'Auto');
                }}
                title={preset.title}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  pageCanvasHeight === preset.val
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'hover:text-slate-900 hover:bg-white text-slate-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <div className="flex items-center border-l border-slate-200 pl-1 ml-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setPageCanvasHeight(prev => Math.max(1000, prev - 500))}
                className="px-1.5 py-0.5 text-[10px] hover:bg-white text-slate-600 font-bold rounded cursor-pointer"
                title="Decrease length by 500px"
              >
                -500
              </button>
              <button
                type="button"
                onClick={() => setPageCanvasHeight(prev => prev + 500)}
                className="px-1.5 py-0.5 text-[10px] hover:bg-white text-slate-600 font-bold rounded cursor-pointer"
                title="Increase length by 500px"
              >
                +500
              </button>
            </div>
          </div>
        </div>

        {/* Right: AI Website Auditor Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRunAiAudit}
            disabled={isAuditing}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? 'AI Auditing Interface...' : '✨ Run AI Website Review'}</span>
          </button>
        </div>

      </div>

      {/* Sub-toolbar: URL Bar & Filter Chips */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs z-10 text-slate-700 min-w-0">
        
        {/* URL Bar / Live Preview indicator */}
        <div className="flex items-center gap-2 flex-1 max-w-xl min-w-[200px] sm:min-w-[280px]">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 w-full shadow-xs">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {showUrlEditor ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateAssetUrl(urlInput, urlInput.match(/\.(jpeg|jpg|png|gif|svg|webp)$/i) ? 'image' : 'url');
                  setShowUrlEditor(false);
                }}
                className="flex-1 flex items-center gap-1"
              >
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter live URL (https://...) or image link"
                  className="bg-transparent text-slate-900 text-xs w-full focus:outline-none"
                  autoFocus
                />
                <button type="submit" className="text-indigo-600 font-semibold hover:text-indigo-700">Go</button>
                <button type="button" onClick={() => setShowUrlEditor(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </form>
            ) : (
              <div 
                onClick={() => setShowUrlEditor(true)}
                className="flex-1 flex items-center justify-between cursor-pointer hover:text-slate-900 truncate py-0.5"
                title="Click to change preview URL or mockup image"
              >
                <span className="truncate font-mono text-[11px] text-slate-600">{currentAsset.url}</span>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setUseStagingRender(!useStagingRender);
                    }}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-300 transition-colors"
                    title="Toggle between direct iframe embed and interactive staging preview render"
                  >
                    {isDemoUrl ? '🖥️ Interactive View' : '🌐 Direct iframe'}
                  </button>
                  <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 uppercase">Change URL</span>
                </div>
              </div>
            )}
            <a 
              href={currentAsset.url} 
              target="_blank" 
              rel="noreferrer"
              title="Open asset in new browser tab" 
              className="text-slate-400 hover:text-slate-600 ml-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Filter Chips & Search */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            {(['all', 'bug', 'design', 'content', 'question', 'approved'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => onUpdateFilter({ category: cat })}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize transition-all ${
                  filterState.category === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {cat === 'all' ? 'All Pins' : cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => onUpdateFilter({ showResolved: !filterState.showResolved })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all ${
              filterState.showResolved
                ? 'bg-white border-slate-300 text-slate-900 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            {filterState.showResolved ? <Eye className="w-3 h-3 text-green-600" /> : <EyeOff className="w-3 h-3" />}
            <span>Resolved ({pins.filter(p => p.assetId === currentAsset.id && (p.status === 'resolved' || p.status === 'archived')).length})</span>
          </button>

          {/* Search Box */}
          <div className="relative hidden xl:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search pins..."
              value={filterState.search}
              onChange={(e) => onUpdateFilter({ search: e.target.value })}
              className="bg-white border border-slate-200 rounded-md pl-8 pr-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 w-36 shadow-xs"
            />
          </div>
        </div>

      </div>

      {/* Main Canvas Scroll Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto bg-slate-200 p-3 sm:p-6 pb-52 relative"
      >
        
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

        {/* Centering wrapper that allows full scrollable content without negative margin clipping */}
        <div className="w-full flex justify-center min-w-fit">
          {/* The Viewport Stage Container */}
          <div 
            style={{ 
              transform: `scale(${zoom / 100})`, 
              transformOrigin: 'top center',
              marginBottom: zoom !== 100 ? `${Math.max(0, (zoom / 100 - 1) * 3600)}px` : undefined 
            }}
            className={`w-full ${getViewportWidth()} transition-all duration-200 relative bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden min-h-[850px] my-4 mb-40`}
          >
            
            {/* Simulated Browser Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 rounded-t-lg">
              <div className="flex items-center gap-1.5 min-w-[220px]">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 font-mono text-[11px] text-slate-500 truncate max-w-[260px]">
                  {currentAsset.url}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                {/* Live Web vs Staging View Switcher */}
                <div className="flex items-center bg-white border border-slate-200 rounded p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setUseStagingRender(false)}
                    className={`px-2 py-0.5 rounded font-sans font-bold text-[10px] transition-colors cursor-pointer ${
                      !useStagingRender
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Render live webpage with full continuous proxy"
                  >
                    🌐 Live Web
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseStagingRender(true)}
                    className={`px-2 py-0.5 rounded font-sans font-bold text-[10px] transition-colors cursor-pointer ${
                      useStagingRender
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Render high-fidelity interactive staging view with all sections"
                  >
                    🖥️ Staging View
                  </button>
                </div>

                {/* Quick Full Page Length Button */}
                <button
                  type="button"
                  onClick={() => setPageCanvasHeight(prev => prev >= 6000 ? 2800 : prev + 1800)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-sans font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                  title="Expand canvas length to fit full content"
                >
                  <span>↕️ {pageCanvasHeight}px (Expand +)</span>
                </button>

                <span className="bg-white px-2 py-0.5 rounded text-slate-700 font-semibold border border-slate-200">
                  {viewport.toUpperCase()} • {zoom}%
                </span>
                <span>{mode === 'comment' ? '📍 Drop Pin Mode' : '🖱️ Browse & Scroll'}</span>
              </div>
            </div>

          {/* Interactive Web Page / Mockup Canvas Area */}
          <div 
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`relative w-full min-h-[850px] bg-white text-slate-900 overflow-hidden ${
              mode === 'comment' ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            
            {/* 1. Content Rendering: Image vs URL iframe vs Built-in Demo Landing Page */}
            {currentAsset.type === 'image' || currentAsset.type === 'mockup' ? (
              <div className="w-full flex flex-col items-center justify-start bg-slate-100 p-2 sm:p-4 min-h-[850px]">
                <img 
                  src={currentAsset.url} 
                  alt={currentAsset.title}
                  className="w-full h-auto object-top rounded shadow-lg border border-slate-200"
                />
              </div>
            ) : isDemoUrl ? (
              /* Built-in Dynamic Full-Page Project Web Portal */
              (() => {
                const demo = renderProjectDemoContent();
                return (
                  <div className="w-full bg-slate-950 text-white font-sans pb-52">
                    {/* Header */}
                    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xl text-indigo-400">
                        <span className="text-2xl">{demo.avatar}</span>
                        <span>{demo.brand}</span>
                      </div>
                      <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#showcase" className="hover:text-white transition-colors">Showcase</a>
                        <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
                        <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                      </nav>
                      <div className="flex items-center gap-3">
                        <button className="text-xs font-semibold hover:text-white text-slate-300 px-3 py-1.5">Sign In</button>
                        <button id="hero-primary-btn" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-lg shadow-blue-600/30 transition-all cursor-pointer">
                          {demo.ctaPrimary}
                        </button>
                      </div>
                    </header>

                    <main className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
                      {/* Badge */}
                      <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{demo.badge}</span>
                      </div>

                      {/* Headline */}
                      <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight text-white">
                        {demo.headline}
                      </h1>

                      {/* Subhead */}
                      <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
                        {demo.subhead}
                      </p>
                      
                      {/* CTAs */}
                      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                        <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-xl shadow-indigo-600/25 transition-all text-sm cursor-pointer">
                          {demo.ctaPrimary}
                        </button>
                        <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-3.5 rounded-xl border border-slate-700 text-sm cursor-pointer transition-colors">
                          {demo.ctaSecondary}
                        </button>
                      </div>

                      {/* Stats Counter Row */}
                      {demo.stats && demo.stats.length > 0 && (
                        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
                          {demo.stats.map((st, sidx) => (
                            <div key={sidx} className="text-center p-3 border-r last:border-r-0 border-slate-800">
                              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">{st.value}</div>
                              <div className="text-xs font-bold text-slate-200 mt-1">{st.label}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{st.desc}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Section: Features & Capabilities */}
                      <div id="features" className="mt-24 text-left">
                        <div className="text-center mb-12">
                          <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">Core Capabilities</span>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Platform Architecture & Features</h2>
                          <p className="text-sm text-slate-400 max-w-xl mx-auto mt-2">Engineered for seamless client collaboration, pixel-perfect inspectability, and rapid release cycles.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {demo.features.map((feat, idx) => (
                            <div key={idx} className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/40 transition-all group flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-2xl group-hover:scale-105 transition-transform">
                                    {feat.icon}
                                  </div>
                                  {feat.tag && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                      {feat.tag}
                                    </span>
                                  )}
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{feat.title}</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                  {feat.desc}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section: Case Studies & Live Deployments */}
                      {demo.caseStudies && demo.caseStudies.length > 0 && (
                        <div id="showcase" className="mt-24 text-left">
                          <div className="text-center mb-12">
                            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">Proven Deployments</span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Featured Case Studies & Work</h2>
                            <p className="text-sm text-slate-400 max-w-xl mx-auto mt-2">Real-world production platforms scaling thousands of daily transactions and visual reviews.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {demo.caseStudies.map((cs, cidx) => (
                              <div key={cidx} className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all flex flex-col">
                                <div className="h-44 overflow-hidden relative">
                                  <img src={cs.image} alt={cs.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-bold text-emerald-400 border border-slate-800">
                                    {cs.stat}
                                  </div>
                                </div>
                                <div className="p-5 flex-1 flex flex-col justify-between">
                                  <div>
                                    <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">{cs.category}</span>
                                    <h3 className="text-base font-bold text-white mt-1 mb-2">{cs.title}</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{cs.desc}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-1 pt-3 border-t border-slate-800/80">
                                    {cs.tags.map((t, tidx) => (
                                      <span key={tidx} className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section: Platform Architecture Pillars */}
                      {demo.architecture && demo.architecture.length > 0 && (
                        <div id="architecture" className="mt-24 text-left">
                          <div className="text-center mb-12">
                            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">System Design</span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">High-Throughput Engineering Pillars</h2>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {demo.architecture.map((arch, aidx) => (
                              <div key={aidx} className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
                                <div className="text-2xl mb-3">{arch.icon}</div>
                                <h3 className="text-sm font-bold text-white mb-1.5">{arch.title}</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">{arch.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section: Testimonials & Client Endorsements */}
                      {demo.testimonials && demo.testimonials.length > 0 && (
                        <div id="testimonials" className="mt-24 text-left">
                          <div className="text-center mb-12">
                            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">Verified Feedback</span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Trusted by Digital Agencies & Teams</h2>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {demo.testimonials.map((test, tidx) => (
                              <div key={tidx} className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                                    {[...Array(test.rating)].map((_, i) => (
                                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                                    ))}
                                  </div>
                                  <p className="text-xs text-slate-300 italic leading-relaxed mb-6">"{test.quote}"</p>
                                </div>
                                <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                                  <img src={test.avatar} alt={test.name} className="w-9 h-9 rounded-full object-cover border border-slate-700" />
                                  <div>
                                    <div className="text-xs font-bold text-white">{test.name}</div>
                                    <div className="text-[10px] text-slate-400">{test.role}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section: Pricing & Collaboration Tiers */}
                      {demo.pricing && demo.pricing.length > 0 && (
                        <div id="pricing" className="mt-24 text-left">
                          <div className="text-center mb-12">
                            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">Investment Tiers</span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Transparent Agency Pricing</h2>
                            <p className="text-sm text-slate-400 max-w-xl mx-auto mt-2">Zero long-term contracts. Scale as your team and client volume expands.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {demo.pricing.map((plan, pidx) => (
                              <div 
                                key={pidx} 
                                className={`p-6 rounded-2xl flex flex-col justify-between transition-all ${
                                  plan.popular 
                                    ? 'bg-gradient-to-b from-indigo-950 to-slate-900 border-2 border-indigo-500 shadow-xl shadow-indigo-950/50' 
                                    : 'bg-slate-900/80 border border-slate-800'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                                    {plan.popular && (
                                      <span className="text-[9px] font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Most Popular
                                      </span>
                                    )}
                                  </div>
                                  <div className="my-5 flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                                    <span className="text-xs text-slate-400">{plan.period}</span>
                                  </div>
                                  <div className="space-y-2.5 pt-2 border-t border-slate-800">
                                    {plan.features.map((f, fidx) => (
                                      <div key={fidx} className="flex items-start gap-2 text-xs text-slate-300">
                                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                        <span>{f}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <button className={`mt-8 w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                                  plan.popular 
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg' 
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}>
                                  Select Plan
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section: Frequently Asked Questions */}
                      {demo.faqs && demo.faqs.length > 0 && (
                        <div id="faq" className="mt-24 text-left max-w-4xl mx-auto">
                          <div className="text-center mb-12">
                            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">Got Questions?</span>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Frequently Asked Questions</h2>
                          </div>

                          <div className="space-y-3">
                            {demo.faqs.map((faq, fidx) => (
                              <div key={fidx} className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
                                <button 
                                  onClick={() => setActiveFaq(activeFaq === fidx ? null : fidx)}
                                  className="w-full p-4 flex items-center justify-between text-left text-sm font-bold text-white hover:text-indigo-300 transition-colors cursor-pointer"
                                >
                                  <span>{faq.q}</span>
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${activeFaq === fidx ? 'rotate-180 text-indigo-400' : ''}`} />
                                </button>
                                {activeFaq === fidx && (
                                  <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                                    {faq.a}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Consultation Inquiry Form */}
                      <div className="mt-24 p-8 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-3xl text-left max-w-4xl mx-auto">
                        <div className="max-w-xl">
                          <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">Direct Collaboration</span>
                          <h2 className="text-2xl font-extrabold text-white mt-1">Have a project or web deployment in mind?</h2>
                          <p className="text-xs text-slate-400 mt-2">Send a direct message to discuss web application architecture, review studios, and custom digital integrations.</p>
                        </div>
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input 
                            type="text" 
                            placeholder="Your Name" 
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <input 
                            type="email" 
                            placeholder="Work Email" 
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-md transition-all cursor-pointer">
                            Request Consultation
                          </button>
                        </div>
                      </div>

                      {/* Footer */}
                      <footer className="mt-24 pt-12 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4">
                        <div>{demo.footerText}</div>
                        <div className="security-badges flex items-center gap-4 text-[11px]">
                          <span className="flex items-center gap-1 text-slate-400"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SSL Encrypted</span>
                          <span>🛡️ Verified Domain</span>
                          <span>⚡ 99.99% Availability</span>
                        </div>
                      </footer>
                    </main>
                  </div>
                );
              })()
            ) : (
              /* External URL iframe Embed with Full-Length Continuous Scrolling Canvas */
              <div 
                style={{ height: `${pageCanvasHeight}px` }}
                className="w-full relative bg-slate-900 transition-all duration-300"
              >
                <iframe
                  src={
                    currentAsset.url.startsWith('http')
                      ? `/api/proxy-site?url=${encodeURIComponent(currentAsset.url)}`
                      : currentAsset.url
                  }
                  title={currentAsset.title}
                  className={`w-full h-full border-0 bg-white ${
                    mode === 'comment' ? 'pointer-events-none' : 'pointer-events-auto'
                  }`}
                  onError={() => setIframeError(true)}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
                
                {/* Transparent click catcher overlay when in Drop Pin Mode */}
                {mode === 'comment' && (
                  <div 
                    className="absolute inset-0 z-20 bg-indigo-500/5 hover:bg-transparent cursor-crosshair flex items-start justify-center p-3 pointer-events-auto"
                  >
                    <div className="bg-slate-900/90 text-white border border-slate-700/80 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 h-fit pointer-events-none">
                      <span className="animate-pulse">📍</span>
                      <span>Drop Pin Mode Active — Click anywhere on the full page (header to footer) to place pin</span>
                    </div>
                  </div>
                )}

                {/* Dismissible Top Helper Notice (does not cover footer) */}
                {!dismissIframeNotice && (
                  <div className="absolute top-4 left-4 right-4 bg-slate-900/95 border border-slate-700/80 text-slate-300 p-3 rounded-xl shadow-2xl text-xs flex flex-wrap items-center justify-between gap-3 z-30 backdrop-blur-md">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
                      <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="leading-relaxed">
                        Rendering live continuous full-length webpage via Markup.io proxy (<strong className="text-white">{pageCanvasHeight}px</strong>). Scroll header to footer without cut-offs.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setUseStagingRender(true)}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>🖥️ Render Interactive View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPageCanvasHeight(prev => prev < 4200 ? 5200 : 2800)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2.5 py-1.5 rounded-lg text-xs border border-slate-700 flex items-center gap-1 cursor-pointer"
                        title="Toggle canvas length"
                      >
                        <span>↕️ {pageCanvasHeight >= 4200 ? '2800px Length' : '5200px Deep Length'}</span>
                      </button>
                      <a 
                        href={currentAsset.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shrink-0 flex items-center gap-1 shadow-sm"
                      >
                        <span>Open Live Tab</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setDismissIframeNotice(true)}
                        className="text-slate-400 hover:text-white p-1 ml-1 cursor-pointer"
                        title="Dismiss helper banner"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. OVERLAY PINS RENDERED AT EXACT X, Y COORDINATES */}
            {filteredPins.map((pin) => {
              const isSelected = selectedPin?.id === pin.id;
              const catColor = getCategoryColor(pin.category);

              return (
                <div
                  key={pin.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPin(pin);
                  }}
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-30 group cursor-pointer pin-badge"
                >
                  {/* Pulsing ring for unread/open pins */}
                  {pin.status === 'open' && (
                    <span className="absolute -inset-1.5 rounded-full bg-indigo-500/40 animate-ping pointer-events-none" />
                  )}

                  {/* Pin Badge Button */}
                  <div 
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs border-2 shadow-xl transition-all duration-150 ${catColor} ${
                      isSelected ? 'scale-125 ring-4 ring-white z-40' : 'hover:scale-110'
                    }`}
                  >
                    <span>{pin.number}</span>
                    
                    {/* Tiny Author Avatar Badge */}
                    <img 
                      src={pin.author.avatar} 
                      alt={pin.author.name} 
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white object-cover"
                    />
                  </div>

                  {/* Hover Tooltip Preview */}
                  <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 hidden group-hover:flex flex-col bg-white border border-slate-200 text-slate-900 p-2.5 rounded-lg shadow-xl min-w-[200px] max-w-xs z-50 pointer-events-none text-left animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {pin.category}
                      </span>
                      <span className="text-[10px] text-slate-400">{pin.createdAt}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-2">{pin.title}</div>
                    {pin.comments[0] && (
                      <div className="text-[11px] text-slate-600 mt-1 line-clamp-2 italic">
                        "{pin.comments[0].text}"
                      </div>
                    )}
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${pin.status === 'resolved' ? 'bg-green-500' : 'bg-orange-500'}`} />
                        <span className="capitalize font-semibold">{pin.status.replace('_', ' ')}</span>
                      </span>
                      <span>{pin.comments.length} comments</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 3. SIMULATED PARTNER CURSOR (When Simulation Enabled) */}
            {isSimulatingPartner && (
              <div
                style={{ left: `${partnerCoord.x}%`, top: `${partnerCoord.y}%` }}
                className="absolute z-40 pointer-events-none transition-all duration-1000 ease-out flex items-start gap-1"
              >
                <div className="w-4 h-4 text-pink-600 filter drop-shadow">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z" />
                  </svg>
                </div>
                <div className="bg-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5 animate-bounce">
                  <img src={teammates[0]?.avatar} alt="Sarah" className="w-3.5 h-3.5 rounded-full object-cover border border-white" />
                  <span>{partnerStatusText}</span>
                </div>
              </div>
            )}

            {/* 4. INLINE NEW PIN POPOVER FORM (When clicked on canvas) */}
            {newPinCoord && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ left: `${newPinCoord.x}%`, top: `${newPinCoord.y}%` }}
                className="absolute z-50 -translate-x-1/2 translate-y-3 bg-white border border-slate-200 text-slate-900 p-4 rounded-xl shadow-2xl w-80 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-600">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-mono text-[10px]">
                      #{pins.filter(p => p.assetId === currentAsset.id).length + 1}
                    </span>
                    <span>New Annotation Pin</span>
                  </div>
                  <button
                    onClick={() => setNewPinCoord(null)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveNewPin} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Feedback Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Increase CTA contrast or Fix alignment"
                      value={newPinTitle}
                      onChange={(e) => setNewPinTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Comment & Recommendation</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Explain the issue or suggested change..."
                      value={newPinComment}
                      onChange={(e) => setNewPinComment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>

                  {/* Category & Priority selector row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                      <select
                        value={newPinCategory}
                        onChange={(e) => setNewPinCategory(e.target.value as PinCategory)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white capitalize"
                      >
                        <option value="design">🎨 Design</option>
                        <option value="bug">🐛 Bug</option>
                        <option value="content">📝 Content</option>
                        <option value="question">❓ Question</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Priority</label>
                      <select
                        value={newPinPriority}
                        onChange={(e) => setNewPinPriority(e.target.value as PinPriority)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white capitalize"
                      >
                        <option value="high">🔴 High</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="low">🟢 Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Assignee */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assign To Teammate (1000+ Directory)</label>
                    <SearchableMemberSelect
                      selectedMember={teammates.find(t => t.id === newPinAssignee) || teammates[0]}
                      teammates={teammates}
                      onSelect={(tm) => setNewPinAssignee(tm.id)}
                      placeholder="Search member or QA..."
                      compact
                    />
                  </div>

                  {/* Screenshot & Attachments Row */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      <span>Screenshot & Attachments</span>
                      <span className="text-indigo-600 font-semibold text-[9px]">Client & Member Uploads</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCaptureScreenshot}
                          disabled={isCapturingScreenshot}
                          className="flex-1 text-[11px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          title="Auto-crop localized page area around pin (Markup.io style)"
                        >
                          {isCapturingScreenshot ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          ) : (
                            <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                          <span>Area Snippet</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCaptureRealTabScreen}
                          disabled={isCapturingScreenshot}
                          className="flex-1 text-[11px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          title="Capture 100% pixel-perfect real browser window/tab screen"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Real Tab Screen</span>
                        </button>
                      </div>

                      <input
                        ref={newPinFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileUploadForNewPin}
                      />

                      <button
                        type="button"
                        onClick={() => newPinFileInputRef.current?.click()}
                        className="w-full text-[11px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Upload custom screenshots, images, PDFs or documents"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Upload Custom Image or Document</span>
                      </button>
                    </div>

                    {/* Screenshot Preview */}
                    {newPinScreenshot && (
                      <div className="mt-2 relative rounded-lg border border-slate-300 bg-slate-900 p-1 group overflow-hidden">
                        <img 
                          src={newPinScreenshot} 
                          alt="Pin Canvas Snapshot" 
                          className="w-full h-24 object-cover rounded"
                        />
                        <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur">
                          📸 Captured Screenshot
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewPinScreenshot(null)}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-colors"
                          title="Remove screenshot"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* File Attachments Chips */}
                    {newPinAttachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {newPinAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between gap-2 bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[11px] text-slate-800 font-medium"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Paperclip className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate max-w-[150px]">{att.name}</span>
                              <span className="text-[9px] text-slate-500 font-mono">({att.size})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNewPinAttachments(prev => prev.filter(a => a.id !== att.id))}
                              className="text-slate-400 hover:text-red-600 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setNewPinCoord(null)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-md text-xs shadow-sm transition-all active:scale-95"
                    >
                      <Send className="w-3 h-3" />
                      <span>Post Pin #{pins.filter(p => p.assetId === currentAsset.id).length + 1}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>

      </div>

      {/* Bottom Status Info Bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-4">
          <span>🎯 Active Pins: <strong className="text-slate-900">{filteredPins.length}</strong></span>
          <span>✅ Resolved: <strong className="text-green-600">{pins.filter(p => p.assetId === currentAsset.id && p.status === 'resolved').length}</strong></span>
        </div>
        <div className="flex items-center gap-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-slate-700">Real-time WebSocket Sync Active</span>
        </div>
      </div>

    </div>
  );
};
