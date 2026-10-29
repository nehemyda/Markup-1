import { apiFetch } from '../lib/api';
import { toMillis, timeAgo, fullTime } from '../lib/time';
import { filesToAttachments, rejectedFilesMessage } from '../lib/attachments';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { capturePageSnapshot, captureImageSnapshot, ReviewSnapshot, cssSelector } from '../lib/pageSnapshot';
import { nextPinNumber, pinDevice, PinDevice, DEVICE_WIDTHS, pinColor } from '../lib/pins';
import { Project, Asset, Pin, PinCategory, PinPriority, Teammate, FilterState, DeviceViewport, Attachment } from '../types';
import { SearchableMemberSelect } from './SearchableMemberSelect';
import { UserAvatar } from './UserAvatar';
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
  Plus,
  Check,
  Layers,
  Sliders
} from 'lucide-react';

interface AnnotationStudioProps {
  currentProject?: Project;
  currentAsset: Asset;
  onNavigatePage: (url: string) => void;
  projectPageIds: string[];
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
    viewportWidth?: number;
    selector?: string;
  }) => void;
  teammates: Teammate[];
  currentUser: Teammate;
  filterState: FilterState;
  onUpdateFilter: (updates: Partial<FilterState>) => void;
  onRunAiAudit: (snapshot: ReviewSnapshot) => Promise<void>;
  isAuditing: boolean;
  isSimulatingPartner: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  sidebar?: React.ReactNode;
  viewport: PinDevice;
  onViewportChange: (device: PinDevice) => void;
  isGuest?: boolean;
  // AI features for the workspace (Team → Roles & Permissions)
  aiEnabled?: boolean;
  // Bumped after a fix is applied or undone on the live site, to reload the page
  siteVersion?: number;
  // CSS of an AI fix being previewed (shown on the page only, nothing is saved)
  previewCss?: string | null;
  // Guest link after the client submitted: browse only, no new pins
  readOnly?: boolean;
  // A new pin is being written (lets others on the link see someone is still adding feedback)
  onDraftingChange?: (drafting: boolean) => void;
}

// Pin title shown in lists: the first line of the comment, shortened at a word
function pinTitleFrom(comment: string) {
  const line = comment.split('\n')[0].trim();
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : 80)}…`;
}

export const AnnotationStudio: React.FC<AnnotationStudioProps> = ({
  currentProject,
  currentAsset,
  onNavigatePage,
  projectPageIds,
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
  isSidebarOpen,
  onToggleSidebar,
  sidebar,
  viewport,
  onViewportChange,
  isGuest = false,
  aiEnabled = true,
  siteVersion = 0,
  previewCss = null,
  readOnly = false,
  onDraftingChange,
}) => {
  const [mode, setMode] = useState<'browse' | 'comment'>('comment');
  const [zoom, setZoom] = useState<number>(100);
  const [iframeError, setIframeError] = useState(false);
  // Full page height, reported by the proxied page (see /api/proxy-site); a normal screen height until it reports
  const [pageCanvasHeight, setPageCanvasHeight] = useState<number>(1000);
  // Pages with full-screen-height sections grow along with the frame; detect that and stop growing
  const heightHistory = useRef<number[]>([]);
  const pageHeightRef = useRef(1000);

  // New Pin Popover state
  const [newPinCoord, setNewPinCoord] = useState<{ x: number; y: number } | null>(null);
  const [newPinComment, setNewPinComment] = useState('');
  const [newPinCategory, setNewPinCategory] = useState<PinCategory>('design');
  const [newPinPriority, setNewPinPriority] = useState<PinPriority>('medium');
  // New pins start unassigned; the person dropping the pin chooses an assignee if they want one
  const [newPinAssignee, setNewPinAssignee] = useState<string>('');
  const [newPinScreenshot, setNewPinScreenshot] = useState<string | null>(null);
  const [newPinAttachments, setNewPinAttachments] = useState<Attachment[]>([]);

  // When the link turns view-only while a pin is being written, keep its text in this browser and bring it back
  // when the team opens the link for the next revision
  const draftKey = `mf_pin_draft_${currentProject.id}`;
  useEffect(() => {
    if (readOnly) {
      setMode('browse');
      if (newPinCoord && newPinComment.trim()) {
        try {
          localStorage.setItem(draftKey, JSON.stringify({ assetId: currentAsset.id, ...newPinCoord, comment: newPinComment }));
        } catch (e) {}
      }
      setNewPinCoord(null);
      return;
    }
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft && draft.assetId === currentAsset.id) {
        localStorage.removeItem(draftKey);
        setMode('comment');
        setNewPinCoord({ x: draft.x, y: draft.y });
        setNewPinComment(draft.comment || '');
      }
    } catch (e) {}
  }, [readOnly, currentAsset.id]);

  useEffect(() => {
    onDraftingChange?.(!!newPinCoord);
  }, [!!newPinCoord]);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const newPinFileInputRef = useRef<HTMLInputElement>(null);

  // Simulated Partner Cursor coordinates (Only active when explicitly toggled in settings)
  const [partnerCoord, setPartnerCoord] = useState<{ x: number; y: number }>({ x: 35, y: 40 });
  const [partnerStatusText, setPartnerStatusText] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Show a CSS fix preview on the live page (re-added whenever the page reloads)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const apply = () => {
      const doc = iframe.contentDocument;
      if (!doc?.head) return;
      doc.getElementById('vpin-fix-preview')?.remove();
      if (!previewCss) return;
      const style = doc.createElement('style');
      style.id = 'vpin-fix-preview';
      style.textContent = previewCss;
      doc.head.appendChild(style);
    };
    apply();
    iframe.addEventListener('load', apply);
    return () => iframe.removeEventListener('load', apply);
  }, [previewCss, currentAsset.url]);
  const stageRef = useRef<HTMLDivElement>(null);

  // Fixed render width per device; the stage is scaled down to fit the space available (then by the zoom control)
  const deviceWidth = DEVICE_WIDTHS[viewport];
  const [availableWidth, setAvailableWidth] = useState(deviceWidth);
  const [stageHeight, setStageHeight] = useState(900);
  useEffect(() => {
    const container = scrollContainerRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return;
    const observer = new ResizeObserver(() => {
      const padding = window.innerWidth >= 640 ? 48 : 24;
      setAvailableWidth(Math.max(200, container.clientWidth - padding));
      setStageHeight(stage.offsetHeight);
    });
    observer.observe(container);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const fitScale = Math.min(1, availableWidth / deviceWidth);
  const scale = fitScale * (zoom / 100);
  // Effective zoom in percent, used to map screen positions back to page positions
  const effectiveZoom = scale * 100;
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
        snapshot = captureImageSnapshot(imageRef.current, canvasRef.current, effectiveZoom);
      } else {
        if (!iframeRef.current) throw new Error('The page has not loaded yet.');
        snapshot = await capturePageSnapshot(iframeRef.current, canvasRef.current, effectiveZoom);
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
    setIframeError(false);
    heightHistory.current = [];
  }, [currentAsset]);

  useEffect(() => {
    heightHistory.current = [];
  }, [viewport]);

  // Listen for auto-detected full webpage height from proxied website iframe
  useEffect(() => {
    const handleHeightMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'VPIN_FULL_PAGE_HEIGHT' && typeof e.data.height === 'number') {
        const detected = Math.min(Math.max(e.data.height, 600), 40000);
        // Bookkeeping lives outside the state updater (React may run updaters more than once)
        const current = pageHeightRef.current;
        if (Math.abs(detected - current) < 4) return;
        const history = heightHistory.current;
        // Each resize changes the page's own layout, so cap the adjustments per page load to rule out a resize loop
        if (history.length >= 8) return;
        if (detected > current) {
          // Three growths by about the same amount in a row = the page is stretching to the frame
          const growths = [...history.filter((d) => d > 0), detected - current].slice(-3);
          if (growths.length === 3 && Math.max(...growths) - Math.min(...growths) < 8) return;
        } else if (current - detected < 100) {
          // Only shrink for real differences, so the frame cannot flip between two nearly equal heights
          return;
        }
        history.push(detected - current);
        pageHeightRef.current = detected;
        setPageCanvasHeight(detected);
      }
    };
    window.addEventListener('message', handleHeightMsg);
    return () => window.removeEventListener('message', handleHeightMsg);
  }, []);

  // A link was clicked inside the page (Browse mode): open that page of the website in the app
  const onNavigatePageRef = useRef(onNavigatePage);
  onNavigatePageRef.current = onNavigatePage;
  useEffect(() => {
    const handleNavigate = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'VPIN_NAVIGATE' && typeof e.data.url === 'string') {
        onNavigatePageRef.current(e.data.url);
      }
    };
    window.addEventListener('message', handleNavigate);
    return () => window.removeEventListener('message', handleNavigate);
  }, []);

  // Opening a comment (sidebar, link, notification) scrolls the canvas to its pin. Runs again shortly after,
  // because a newly opened page is still loading and settling its height.
  useEffect(() => {
    if (!selectedPin || selectedPin.assetId !== currentAsset.id) return;
    const scrollToPin = () => {
      const container = scrollContainerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const c = container.getBoundingClientRect();
      const r = canvas.getBoundingClientRect();
      const pinTop = r.top - c.top + container.scrollTop + (selectedPin.y / 100) * r.height;
      container.scrollTo({ top: Math.max(0, pinTop - container.clientHeight / 3), behavior: 'smooth' });
    };
    scrollToPin();
    const later = setTimeout(scrollToPin, 1500);
    return () => clearTimeout(later);
  }, [selectedPin?.id, currentAsset.id]);

  // Keyboard shortcuts: C = Drop Pin Mode, V = Browse / Scroll (ignored while typing)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        if (readOnly) return;
        setMode('comment');
        setNewPinCoord(null);
      } else if (key === 'v') {
        setMode('browse');
        setNewPinCoord(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [readOnly]);

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
    if (pinDevice(p) !== viewport) return false;
    // The sidebar's Active / Resolved tab decides which pins show on the page
    const isResolved = p.status === 'resolved' || p.status === 'archived';
    if (filterState.showResolved !== isResolved) return false;
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

    const coord = { x: percentX, y: percentY };
    // Clicking elsewhere while writing a pin moves it (the text and files stay); otherwise a new pin starts
    const moving = !!newPinCoord;
    setNewPinCoord(coord);
    if (!moving) {
      setNewPinComment('');
      setNewPinAttachments([]);
    }
    // A screenshot taken by hand stays; an automatic one is retaken at the new spot
    if (!moving || autoShot || !newPinScreenshot) {
      setNewPinScreenshot(null);
      setAutoShot(false);
      autoCaptureAt(coord);
    }
    onSelectPin(null);
  };

  // ---------- New pin form placement ----------
  // Place the form beside the pending marker on screen; flip to the left when there is no room, keep it in the window
  const pendingMarkerRef = useRef<HTMLDivElement>(null);
  const pinFormRef = useRef<HTMLDivElement>(null);
  const [pinFormPos, setPinFormPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!newPinCoord) {
      setPinFormPos(null);
      return;
    }
    const place = () => {
      const marker = pendingMarkerRef.current;
      if (!marker) return;
      const m = marker.getBoundingClientRect();
      const w = pinFormRef.current?.offsetWidth || 320;
      const h = pinFormRef.current?.offsetHeight || 420;
      const gap = 12;
      const margin = 8;
      let left = m.right + gap;
      if (left + w > window.innerWidth - margin) left = m.left - gap - w;
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
      const top = Math.max(margin, Math.min(m.top - 24, window.innerHeight - h - margin));
      setPinFormPos((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
    };
    place();
    const frame = requestAnimationFrame(place);
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', place);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      container?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [newPinCoord, scale, newPinScreenshot, newPinAttachments.length]);

  // ---------- Pin screenshots ----------
  // Snippet size in page pixels around the pin
  const SNIPPET_WIDTH = 800;
  const SNIPPET_HEIGHT = 450;

  // Draw the pin marker (numbered dot) onto a captured snippet
  const drawPinMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    const r = 13 * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
    ctx.shadowBlur = 6 * scale;
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${12 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(nextPinNumber(pins, projectPageIds)), x, y + 0.5 * scale);
    ctx.restore();
  };

  // Crop a region centered on (cx, cy) out of a source image/canvas and mark the pin
  const cropAroundPoint = (
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    cx: number,
    cy: number,
    cropW: number,
    cropH: number,
    markerScale: number
  ): string => {
    const w = Math.min(cropW, sourceWidth);
    const h = Math.min(cropH, sourceHeight);
    const sx = Math.min(Math.max(0, cx - w / 2), sourceWidth - w);
    const sy = Math.min(Math.max(0, cy - h / 2), sourceHeight - h);
    const out = document.createElement('canvas');
    out.width = Math.round(w);
    out.height = Math.round(h);
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.drawImage(source, sx, sy, w, h, 0, 0, w, h);
    drawPinMarker(ctx, cx - sx, cy - sy, markerScale);
    return out.toDataURL('image/jpeg', 0.82);
  };

  // CSS selector of the page element under the new pin (live pages only)
  const elementSelectorAtPin = (): string | undefined => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!canvasRef.current || !iframe || !doc || !newPinCoord) return undefined;
    try {
      const c = canvasRef.current.getBoundingClientRect();
      const f = iframe.getBoundingClientRect();
      const x = (newPinCoord.x / 100) * canvasRef.current.offsetWidth - (f.left - c.left) / scale;
      const y = (newPinCoord.y / 100) * canvasRef.current.offsetHeight - (f.top - c.top) / scale;
      // Skip invisible layers (e.g. a closed menu's overlay) and take the first visible element under the pin
      const win = iframe.contentWindow!;
      const el = doc
        .elementsFromPoint(x - (win.scrollX || 0), y - (win.scrollY || 0))
        .find((node) => {
          if (node === doc.body || node === doc.documentElement) return false;
          const st = win.getComputedStyle(node);
          return st.visibility !== 'hidden' && Number(st.opacity) > 0.05 && st.pointerEvents !== 'none';
        });
      return el ? cssSelector(el) : undefined;
    } catch {
      return undefined;
    }
  };

  // Pin position in unscaled canvas pixels
  const pinCanvasPoint = (coord: { x: number; y: number }) => {
    const canvas = canvasRef.current!;
    return {
      x: (coord.x / 100) * canvas.offsetWidth,
      y: (coord.y / 100) * canvas.offsetHeight,
    };
  };

  // Area Snippet: render the real page (or image) around the pin, as a JPEG data URL. Asks the person nothing,
  // so it is also the automatic screenshot when a pin is placed or moved.
  const snippetAt = async (coord: { x: number; y: number }): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('The page has not finished loading yet.');
    const canvasRect = canvas.getBoundingClientRect();
    const pin = pinCanvasPoint(coord);

    if (currentAsset.type === 'image' || currentAsset.type === 'mockup') {
      const img = imageRef.current;
      if (!img || !img.naturalWidth) throw new Error('The image has not loaded yet.');
      const imgRect = img.getBoundingClientRect();
      // Pin inside the displayed image, then in the image's own pixels
      const ratio = img.naturalWidth / (imgRect.width / scale);
      const ix = (pin.x - (imgRect.left - canvasRect.left) / scale) * ratio;
      const iy = (pin.y - (imgRect.top - canvasRect.top) / scale) * ratio;
      return cropAroundPoint(img, img.naturalWidth, img.naturalHeight, ix, iy, SNIPPET_WIDTH * ratio, SNIPPET_HEIGHT * ratio, ratio);
    }

    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) throw new Error('The page has not finished loading yet.');
    const iframeRect = iframe.getBoundingClientRect();
    // Pin in the page's own coordinates (the iframe is as tall as the page, so it does not scroll)
    const px = pin.x - (iframeRect.left - canvasRect.left) / scale + (iframe.contentWindow?.scrollX || 0);
    const py = pin.y - (iframeRect.top - canvasRect.top) / scale + (iframe.contentWindow?.scrollY || 0);
    const pageW = doc.documentElement.scrollWidth;
    const pageH = doc.documentElement.scrollHeight;
    const w = Math.min(SNIPPET_WIDTH, pageW);
    const h = Math.min(SNIPPET_HEIGHT, pageH);
    const rx = Math.min(Math.max(0, px - w / 2), pageW - w);
    const ry = Math.min(Math.max(0, py - h / 2), pageH - h);
    // Preferred: a real screenshot from the server's headless Chrome at the same page width
    try {
      const res = await apiFetch('/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentAsset.url,
          viewportWidth: doc.documentElement.clientWidth,
          x: rx,
          y: ry,
          width: w,
          height: h,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const blobUrl = URL.createObjectURL(await res.blob());
      try {
        const img = new Image();
        img.src = blobUrl;
        await img.decode();
        const k = img.naturalWidth / w; // device pixels per page pixel
        const out = document.createElement('canvas');
        out.width = img.naturalWidth;
        out.height = img.naturalHeight;
        const octx = out.getContext('2d')!;
        octx.drawImage(img, 0, 0);
        drawPinMarker(octx, (px - rx) * k, (py - ry) * k, k);
        return out.toDataURL('image/jpeg', 0.82);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.warn('Real screenshot unavailable, falling back to an in-browser render:', err);
    }

    // Fallback: re-render in the browser (fonts and images from other sites may be missing)
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const shot = await html2canvas(doc.body, {
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scale: dpr,
      x: rx,
      y: ry,
      width: w,
      height: h,
      windowWidth: pageW,
      windowHeight: pageH,
      scrollX: 0,
      scrollY: 0,
    });
    const ctx = shot.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    drawPinMarker(ctx, (px - rx) * dpr, (py - ry) * dpr, dpr);
    return shot.toDataURL('image/jpeg', 0.82);
  };

  const handleCaptureScreenshot = async () => {
    if (!canvasRef.current || !newPinCoord) return;
    const seq = ++shotSeq.current;
    setIsCapturingScreenshot(true);
    try {
      const shot = await snippetAt(newPinCoord);
      if (seq !== shotSeq.current) return;
      setNewPinScreenshot(shot);
      setAutoShot(false);
    } catch (err: any) {
      console.warn('Area snippet failed:', err);
      alert(
        err?.message?.includes('tainted')
          ? 'This image is hosted on another site that does not allow capturing it. Use Real Tab Screen instead.'
          : err?.message || 'Could not capture this area. Try Real Tab Screen instead.'
      );
    } finally {
      if (seq === shotSeq.current) setIsCapturingScreenshot(false);
    }
  };

  // Real Tab Screen: capture this browser tab's pixels and crop around the pin. The browser asks to share the tab;
  // the share is kept open, so it only asks again after a reload or "Stop sharing".
  const [hidePinFormForCapture, setHidePinFormForCapture] = useState(false);
  const liveTab = useRef<{ stream: MediaStream; video: HTMLVideoElement } | null>(null);
  // The current screenshot was taken automatically, so moving the pin replaces it
  const [autoShot, setAutoShot] = useState(false);
  const shotSeq = useRef(0);

  useEffect(() => () => liveTab.current?.stream.getTracks().forEach((t) => t.stop()), []);

  // Must start inside the click (browsers only ask to share during one)
  const openLiveTab = async () => {
    if (liveTab.current?.stream.active) return liveTab.current;
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'never', displaySurface: 'browser' } as any,
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    } as any);
    const track = stream.getVideoTracks()[0];
    if ((track.getSettings() as any).displaySurface !== 'browser') {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Please choose "This tab" when asked, so the area around the pin can be found.');
    }
    // "Stop sharing" in the browser: ask again next time
    track.addEventListener('ended', () => {
      liveTab.current = null;
    });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    liveTab.current = { stream, video };
    return liveTab.current;
  };

  // Grab the shared tab around a pin, with the pin form hidden so it does not cover the area
  const grabLiveTab = async (coord: { x: number; y: number }) => {
    const tab = liveTab.current;
    if (!tab || !canvasRef.current) throw new Error('This tab is not being shared.');
    setHidePinFormForCapture(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const { video } = tab;
      const frame = document.createElement('canvas');
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      frame.getContext('2d')!.drawImage(video, 0, 0);

      // Map the pin from page coordinates to the captured frame
      const rect = canvasRef.current.getBoundingClientRect();
      const ratio = video.videoWidth / window.innerWidth;
      const cx = (rect.left + (coord.x / 100) * rect.width) * ratio;
      const cy = (rect.top + (coord.y / 100) * rect.height) * ratio;
      return cropAroundPoint(frame, frame.width, frame.height, cx, cy, SNIPPET_WIDTH * ratio, SNIPPET_HEIGHT * ratio, ratio);
    } finally {
      setHidePinFormForCapture(false);
    }
  };

  const handleCaptureRealTabScreen = async () => {
    if (!canvasRef.current || !newPinCoord) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Screen capture is not supported in this browser. Use Area Snippet instead.');
      return;
    }
    const seq = ++shotSeq.current;
    setIsCapturingScreenshot(true);
    try {
      await openLiveTab();
      const shot = await grabLiveTab(newPinCoord);
      if (seq !== shotSeq.current) return;
      setNewPinScreenshot(shot);
      setAutoShot(false);
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        console.warn('Real tab capture failed:', err);
        alert(err?.message || 'Could not capture this tab.');
      }
    } finally {
      if (seq === shotSeq.current) setIsCapturingScreenshot(false);
    }
  };

  // Automatic Area Snippet when a pin is placed or moved (no prompt); the buttons still work by hand
  const autoCaptureAt = async (coord: { x: number; y: number }) => {
    const seq = ++shotSeq.current;
    setIsCapturingScreenshot(true);
    try {
      const shot = await snippetAt(coord);
      if (seq !== shotSeq.current) return;
      setNewPinScreenshot(shot);
      setAutoShot(true);
    } catch (err: any) {
      console.warn('Automatic screenshot failed:', err);
    } finally {
      if (seq === shotSeq.current) setIsCapturingScreenshot(false);
    }
  };

  const handleFileUploadForNewPin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Images are compressed; other files over the size limit are refused (see lib/attachments)
    filesToAttachments(Array.from(files)).then(({ attachments, rejected }) => {
      if (attachments.length) setNewPinAttachments((prev) => [...prev, ...attachments]);
      if (rejected.length) alert(rejectedFilesMessage(rejected));
    });

    e.target.value = '';
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    const comment = newPinComment.trim();
    if (!newPinCoord || !comment) return;

    onAddPin({
      x: newPinCoord.x,
      y: newPinCoord.y,
      title: pinTitleFrom(comment),
      commentText: comment,
      category: newPinCategory,
      priority: newPinPriority,
      assigneeId: newPinAssignee,
      screenshotUrl: newPinScreenshot || undefined,
      attachments: newPinAttachments.length > 0 ? newPinAttachments : undefined,
      viewportWidth: canvasRef.current?.offsetWidth,
      selector: elementSelectorAtPin(),
    });

    setNewPinCoord(null);
    setNewPinScreenshot(null);
    setAutoShot(false);
    setNewPinAttachments([]);
  };

  // Same colours as the comments sidebar (lib/pins)
  const getCategoryColor = (cat: PinCategory) => {
    const c = pinColor(cat);
    return `${c.bg} ${c.border} text-white ${c.shadow}`;
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


  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full bg-slate-100 overflow-hidden relative">
      
      {/* Top Toolbar: Mode, Viewport, Zoom, AI Auditor */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-20 shadow-xs text-slate-900 min-w-0">
        
        {/* Left: Mode Toggle (Browse vs Comment) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
          {!readOnly && <button
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
          </button>}

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
          {/* Device views: each shows only its own pins. Badge = pin count (amber: some open, green: all resolved) */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-md border border-slate-200 text-slate-500">
            {([
              { device: 'desktop', label: 'Desktop', Icon: Monitor },
              { device: 'tablet', label: 'Tablet (768px)', Icon: Tablet },
              { device: 'mobile', label: 'Mobile (375px)', Icon: Smartphone },
            ] as const).map(({ device, label, Icon }) => {
              const devicePins = pins.filter((p) => p.assetId === currentAsset.id && pinDevice(p) === device);
              const openCount = devicePins.filter((p) => p.status !== 'resolved' && p.status !== 'archived').length;
              return (
                <button
                  key={device}
                  onClick={() => onViewportChange(device)}
                  title={`${label}: ${devicePins.length} ${devicePins.length === 1 ? 'pin' : 'pins'}${devicePins.length ? `, ${openCount} open` : ''}`}
                  className={`relative px-1.5 py-1 rounded transition-colors ${viewport === device ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900 hover:bg-white'}`}
                >
                  <Icon className="w-4 h-4" />
                  {devicePins.length > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold leading-4 text-white text-center ring-2 ring-white ${
                        openCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    >
                      {openCount > 0 ? openCount : devicePins.length}
                    </span>
                  )}
                </button>
              );
            })}
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

        {/* Right: AI Website Auditor Trigger + comments sidebar toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Hide comments' : 'Show comments'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              isSidebarOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Comments ({pins.filter((p) => projectPageIds.includes(p.assetId) && pinDevice(p) === viewport).length})</span>
          </button>
          {!isGuest && aiEnabled && (
          <button
            onClick={handleRunAiReview}
            disabled={isAuditing || isCapturingPage}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAuditing || isCapturingPage ? 'animate-spin' : ''}`} />
            <span>{isCapturingPage ? 'Reading page...' : isAuditing ? 'AI reviewing page...' : 'Run AI Website Review'}</span>
          </button>
          )}
        </div>

      </div>

      {/* Canvas area + comments sidebar (which slides over the canvas, below the toolbars) */}
      <div className="flex-1 min-h-0 relative flex">
      <div className="flex-1 min-w-0 flex flex-col">
      {/* Main Canvas Scroll Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto bg-slate-200 p-3 sm:p-6 pb-24 relative"
      >
        
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

        {/* The page renders at a fixed width per device and is scaled to fit, so its layout (and pin positions)
            never change when the window or the sidebar changes size. The outer box reserves the scaled size. */}
        <div className="w-full">
          <div
            style={{ width: deviceWidth * scale, height: stageHeight * scale }}
            className="relative mx-auto my-4 mb-8 shrink-0"
          >
          {/* The Viewport Stage Container */}
          <div 
            ref={stageRef}
            style={{ width: deviceWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            className="absolute top-0 left-0 bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden min-h-[850px]"
          >
            
            {/* Simulated Browser Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 rounded-t-lg">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full bg-rose-400 shrink-0" />
                <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                <div className="w-3 h-3 rounded-full bg-green-400 shrink-0" />
                {/* The page address (the only address bar; links in Browse mode change it) */}
                <span className="ml-2 font-mono text-[11px] text-slate-600 truncate flex-1 min-w-0" title={currentAsset.url}>
                  {currentAsset.url}
                </span>
                <a
                  href={currentAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open this page in a new browser tab"
                  className="text-slate-400 hover:text-slate-700 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

          {/* Interactive Web Page / Mockup Canvas Area */}
          <div 
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`relative w-full min-h-[850px] bg-white text-slate-900 overflow-hidden select-none ${
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
                className="w-full relative bg-slate-900"
              >
                <iframe
                  ref={iframeRef}
                  src={
                    currentAsset.url.startsWith('http')
                      ? `/api/proxy-site?url=${encodeURIComponent(currentAsset.url)}${siteVersion ? `&v=${siteVersion}` : ''}`
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
                  <div className="absolute inset-0 z-20 cursor-crosshair pointer-events-auto" />
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
                    
                    {/* Tiny author avatar: their photo, or their initials (guests have no photo) */}
                    <span className="absolute -bottom-1 -right-1 rounded-full ring-1 ring-white">
                      <UserAvatar name={pin.author.name} email={pin.author.email} avatar={pin.author.avatar} size={16} title={pin.author.name} />
                    </span>
                  </div>

                  {/* Hover Tooltip Preview */}
                  <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 hidden group-hover:flex flex-col bg-white border border-slate-200 text-slate-900 p-2.5 rounded-lg shadow-xl min-w-[200px] max-w-xs z-50 pointer-events-none text-left animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {pin.category}
                      </span>
                      <span className="text-[10px] text-slate-400" title={fullTime(toMillis(pin.createdAt, pin.id))}>{timeAgo(toMillis(pin.createdAt, pin.id))}</span>
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

            {/* 4. NEW PIN: marker at the clicked point, form beside it (left side near the right edge) */}
            {newPinCoord && (
              <div
                ref={pendingMarkerRef}
                onClick={(e) => e.stopPropagation()}
                style={{ left: `${newPinCoord.x}%`, top: `${newPinCoord.y}%` }}
                className="absolute z-50 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-indigo-600 border-[3px] border-white shadow-lg flex items-center justify-center text-white font-bold text-[11px] pointer-events-none animate-in zoom-in-50 duration-150"
              >
                {nextPinNumber(pins, projectPageIds)}
              </div>
            )}
            {/* The form is drawn above everything (not inside the page frame), so it is never clipped
                (e.g. by the 375px mobile frame) and is not scaled with the page */}
            {newPinCoord && createPortal(
              <div
                ref={pinFormRef}
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: pinFormPos?.left ?? -9999,
                  top: pinFormPos?.top ?? -9999,
                  maxHeight: 'calc(100vh - 16px)',
                  visibility: hidePinFormForCapture || !pinFormPos ? 'hidden' : 'visible',
                }}
                className="fixed z-[55] overflow-y-auto bg-white border border-slate-200 text-slate-900 p-4 rounded-xl shadow-2xl w-80 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-600">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-mono text-[10px]">
                      #{nextPinNumber(pins, projectPageIds)}
                    </span>
                    <span>Add comment here</span>
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
                    <textarea
                      required
                      rows={3}
                      autoFocus
                      placeholder="Describe the issue or the change you want..."
                      value={newPinComment}
                      onChange={(e) => setNewPinComment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>

                  {/* Category & Priority selector row (priority is for the team only) */}
                  <div className={`grid gap-2 ${isGuest ? 'grid-cols-1' : 'grid-cols-2'}`}>
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

                    {!isGuest && (
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
                    )}
                  </div>

                  {/* Assignee (team members only; guests never see the team list) */}
                  {!isGuest && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assignee</label>
                      <SearchableMemberSelect
                        selectedMember={teammates.find(t => t.id === newPinAssignee)}
                        teammates={teammates}
                        onSelect={(tm) => setNewPinAssignee(tm.id)}
                        placeholder="Search team members..."
                        compact
                      />
                    </div>
                  )}

                  {/* Screenshot & Attachments Row */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      <span>Attach (optional)</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCaptureScreenshot}
                          disabled={isCapturingScreenshot}
                          className="flex-1 text-[11px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          title="Auto-crop localized page area around pin"
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
                          📸 {autoShot ? 'Auto screenshot' : 'Captured Screenshot'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            ++shotSeq.current;
                            setNewPinScreenshot(null);
                            setAutoShot(false);
                          }}
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
                      <span>Post Pin #{nextPinNumber(pins, projectPageIds)}</span>
                    </button>
                  </div>
                </form>
              </div>,
              document.body
            )}

          </div>
        </div>
          </div>
      </div>

      </div>

      </div>
      {sidebar}
      </div>

    </div>
  );
};
