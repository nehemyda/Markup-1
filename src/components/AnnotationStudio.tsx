import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { capturePageSnapshot, captureImageSnapshot, ReviewSnapshot } from '../lib/pageSnapshot';
import { nextPinNumber } from '../lib/pins';
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
  onRunAiAudit: (snapshot: ReviewSnapshot) => Promise<void>;
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
  // Full page height, reported by the proxied page (see /api/proxy-site); 4200 until it reports
  const [pageCanvasHeight, setPageCanvasHeight] = useState<number>(4200);

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isCapturingPage, setIsCapturingPage] = useState(false);

  // AI review: read the page actually shown in the canvas, then hand it to App to send to Gemini
  const handleRunAiReview = async () => {
    if (!canvasRef.current) return;
    setIsCapturingPage(true);
    try {
      let snapshot: ReviewSnapshot;
      if (currentAsset.type === 'image' || currentAsset.type === 'mockup') {
        if (!imageRef.current) throw new Error('The image has not loaded yet.');
        snapshot = captureImageSnapshot(imageRef.current, canvasRef.current, zoom);
      } else {
        if (!iframeRef.current) throw new Error('The page has not loaded yet.');
        snapshot = await capturePageSnapshot(iframeRef.current, canvasRef.current, zoom);
      }
      setIsCapturingPage(false);
      await onRunAiAudit(snapshot);
    } catch (err: any) {
      alert(err?.message || 'Could not read the page for the AI review.');
    } finally {
      setIsCapturingPage(false);
    }
  };

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

  // Keyboard shortcuts: C = Drop Pin Mode, V = Browse / Scroll (ignored while typing)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        setMode('comment');
        setNewPinCoord(null);
      } else if (key === 'v') {
        setMode('browse');
        setNewPinCoord(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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

        </div>

        {/* Right: AI Website Auditor Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAiReview}
            disabled={isAuditing || isCapturingPage}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAuditing || isCapturingPage ? 'animate-spin' : ''}`} />
            <span>{isCapturingPage ? 'Reading page...' : isAuditing ? 'AI reviewing page...' : 'Run AI Website Review'}</span>
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
                  ref={imageRef}
                  src={currentAsset.url} 
                  alt={currentAsset.title}
                  className="w-full h-auto object-top rounded shadow-lg border border-slate-200"
                />
              </div>
            ) : (
              /* External URL iframe Embed with Full-Length Continuous Scrolling Canvas */
              <div 
                style={{ height: `${pageCanvasHeight}px` }}
                className="w-full relative bg-slate-900 transition-all duration-300"
              >
                <iframe
                  ref={iframeRef}
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
                      #{nextPinNumber(pins, currentAsset.id)}
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
                      <span>Post Pin #{nextPinNumber(pins, currentAsset.id)}</span>
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
