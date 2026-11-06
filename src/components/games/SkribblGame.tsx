import React, { useRef, useEffect, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  Palette, 
  Eraser, 
  Trash2, 
  RotateCcw, 
  Send, 
  Clock, 
  Trophy, 
  Sparkles, 
  Eye, 
  CheckCircle2,
  Crown,
  Play,
  LogOut,
  AlertTriangle,
  Flame,
  Zap,
  Smile,
  Shuffle,
  MessageSquare,
  Award,
  HelpCircle,
  PaintBucket,
  ThumbsUp,
  ThumbsDown,
  Paintbrush
} from 'lucide-react';
import type { 
  SkribblState, 
  DrawingStroke, 
  DrawingPoint, 
  Participant, 
  ChatMessage, 
  SkribblDifficulty 
} from '../../types/index.ts';
import { sounds } from '../../services/soundEffects.ts';

interface SkribblGameProps {
  skribbl: SkribblState;
  strokes: DrawingStroke[];
  participants: Participant[];
  chat?: ChatMessage[];
  currentParticipantId: string;
  isHost: boolean;
  socket?: any;
  onStartGame: () => void;
  onSetDifficulty?: (difficulty: SkribblDifficulty) => void;
  onSelectWord: (word: string) => void;
  onDrawStroke: (stroke: DrawingStroke) => void;
  onClearCanvas: () => void;
  onSendChatGuess: (guess: string) => void;
  onSendChatMessage?: (text: string) => void;
  onExitGame: () => void;
  onHostEndGame?: () => void;
}

const COLORS = [
  '#ffffff', // White
  '#c1c1c1', // Light Gray
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#a16207', // Ochre
  '#000000', // Black
  '#4b5563', // Dark Gray
  '#991b1b', // Dark Red
  '#c2410c', // Dark Orange
  '#854d0e', // Dark Yellow
  '#15803d', // Dark Green
  '#0e7490', // Dark Cyan
  '#1d4ed8', // Dark Blue
  '#6b21a8', // Dark Violet
  '#be185d', // Dark Pink
  '#451a03', // Deep Brown
];

const BRUSH_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 8 },
  { label: 'L', size: 16 },
  { label: 'XL', size: 26 },
];

const DIFFICULTY_CONFIG = [
  {
    id: 'easy' as SkribblDifficulty,
    name: 'Easy',
    icon: Smile,
    desc: 'Simple, familiar objects and animals that are easy to draw and guess.',
    examples: 'apple, cat, sun, house',
    activeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/50',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'medium' as SkribblDifficulty,
    name: 'Medium',
    icon: Zap,
    desc: 'More specific objects, activities, and concepts.',
    examples: 'skateboard, lighthouse, camping',
    activeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/50',
    tagColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  {
    id: 'hard' as SkribblDifficulty,
    name: 'Hard',
    icon: Flame,
    desc: 'Challenging but drawable words, phrases, and concepts.',
    examples: 'time machine, parallel universe, invisible bridge',
    activeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40 ring-1 ring-violet-500/50',
    tagColor: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  },
  {
    id: 'mixed' as SkribblDifficulty,
    name: 'Mixed Choice',
    icon: Shuffle,
    desc: 'Each turn offers 1 Easy, 1 Medium, and 1 Hard word for the drawer to choose.',
    examples: 'Drawer picks their own difficulty',
    activeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 ring-1 ring-indigo-500/50',
    tagColor: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  },
];

function hexToRgba(hex: string): [number, number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

/**
 * High-performance 4-way BFS flood-fill algorithm for canvas.
 * Fills enclosed regions with color tolerance for antialiased stroke borders.
 */
function floodFillCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  tolerance = 36
) {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return;
  const clampedX = Math.max(0, Math.min(width - 1, Math.round(startX)));
  const clampedY = Math.max(0, Math.min(height - 1, Math.round(startY)));

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(0, 0, width, height);
  } catch {
    return;
  }
  const data = imgData.data;
  const startIdx = (clampedY * width + clampedX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  const [fillR, fillG, fillB, fillA] = hexToRgba(fillColorHex);

  // If start color already equals fill color within tolerance, return immediately
  const initialDist = Math.abs(targetR - fillR) + Math.abs(targetG - fillG) + Math.abs(targetB - fillB) + Math.abs(targetA - fillA);
  if (initialDist <= tolerance) return;

  const colorMatch = (idx: number) => {
    const dr = data[idx] - targetR;
    const dg = data[idx + 1] - targetG;
    const db = data[idx + 2] - targetB;
    const da = data[idx + 3] - targetA;
    return (dr * dr + dg * dg + db * db + da * da) <= (tolerance * tolerance);
  };

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let head = 0;
  let tail = 0;

  queue[tail++] = clampedX;
  queue[tail++] = clampedY;
  visited[clampedY * width + clampedX] = 1;

  let filledPixels = 0;
  const maxPixels = width * height;

  while (head < tail && filledPixels < maxPixels) {
    const x = queue[head++];
    const y = queue[head++];
    const idx = (y * width + x) * 4;

    data[idx] = fillR;
    data[idx + 1] = fillG;
    data[idx + 2] = fillB;
    data[idx + 3] = fillA;
    filledPixels++;

    // 4-way neighbors
    // West
    if (x > 0) {
      const nx = x - 1;
      const pos = y * width + nx;
      if (!visited[pos]) {
        visited[pos] = 1;
        if (colorMatch(pos * 4)) {
          queue[tail++] = nx;
          queue[tail++] = y;
        }
      }
    }
    // East
    if (x < width - 1) {
      const nx = x + 1;
      const pos = y * width + nx;
      if (!visited[pos]) {
        visited[pos] = 1;
        if (colorMatch(pos * 4)) {
          queue[tail++] = nx;
          queue[tail++] = y;
        }
      }
    }
    // North
    if (y > 0) {
      const ny = y - 1;
      const pos = ny * width + x;
      if (!visited[pos]) {
        visited[pos] = 1;
        if (colorMatch(pos * 4)) {
          queue[tail++] = x;
          queue[tail++] = ny;
        }
      }
    }
    // South
    if (y < height - 1) {
      const ny = y + 1;
      const pos = ny * width + x;
      if (!visited[pos]) {
        visited[pos] = 1;
        if (colorMatch(pos * 4)) {
          queue[tail++] = x;
          queue[tail++] = ny;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export const SkribblGame: React.FC<SkribblGameProps> = ({
  skribbl,
  strokes,
  participants,
  chat = [],
  currentParticipantId,
  isHost,
  socket,
  onStartGame,
  onSetDifficulty,
  onSelectWord,
  onDrawStroke,
  onClearCanvas,
  onSendChatGuess,
  onSendChatMessage,
  onExitGame,
  onHostEndGame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<DrawingPoint[]>([]);
  const currentStrokeIdRef = useRef<string | null>(null);
  const throttleBufferRef = useRef<DrawingPoint[]>([]);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [color, setColor] = useState('#ffffff');
  const [brushWidth, setBrushWidth] = useState(8);
  const [activeTool, setActiveTool] = useState<'brush' | 'fill' | 'eraser'>('brush');
  const isEraser = activeTool === 'eraser';
  const [guessInput, setGuessInput] = useState('');
  const [generalInput, setGeneralInput] = useState('');
  const [activeChatTab, setActiveChatTab] = useState<'game' | 'general'>('game');
  const [localStrokes, setLocalStrokes] = useState<DrawingStroke[]>(strokes);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [closeGuessToast, setCloseGuessToast] = useState<string | null>(null);
  const [correctGuessCelebration, setCorrectGuessCelebration] = useState<{ score: number } | null>(null);

  const isDrawer = skribbl.drawerId === currentParticipantId;
  const hasGuessed = skribbl.correctGuessers.includes(currentParticipantId);
  const currentDiff = skribbl.difficulty || 'mixed';

  const reactions = skribbl.reactions || { likes: [], dislikes: [] };
  const isLiked = reactions.likes.includes(currentParticipantId);
  const isDisliked = reactions.dislikes.includes(currentParticipantId);
  const likeCount = reactions.likes.length;
  const dislikeCount = reactions.dislikes.length;

  const handleReactDrawing = (reaction: 'like' | 'dislike') => {
    if (!socket || isDrawer || skribbl.status !== 'drawing') return;
    socket.emit('skribbl_react_drawing', { reaction });
    sounds.playReactionSound();
  };

  const handleRequestExit = () => {
    if (skribbl.status === 'drawing' || skribbl.status === 'selecting_word') {
      setShowExitConfirm(true);
    } else {
      onExitGame();
    }
  };

  // Sync external strokes into local strokes
  useEffect(() => {
    setLocalStrokes(strokes);
  }, [strokes]);

  // Real-time remote drawing synchronization via Socket.IO
  useEffect(() => {
    if (!socket) return;

    // Active remote in-progress stroke mapping
    const remoteActiveStrokes = new Map<string, DrawingStroke>();

    const onRemoteStrokeStart = (data: { strokeId: string; point: DrawingPoint; color: string; width: number; isEraser?: boolean }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const newRemoteStroke: DrawingStroke = {
        id: data.strokeId,
        points: [data.point],
        color: data.color,
        width: data.width,
        isEraser: data.isEraser,
      };
      remoteActiveStrokes.set(data.strokeId, newRemoteStroke);
    };

    const onRemoteStrokeChunk = (data: { strokeId: string; points: DrawingPoint[] }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const activeStroke = remoteActiveStrokes.get(data.strokeId);
      if (!activeStroke || activeStroke.points.length === 0) return;

      const lastPt = activeStroke.points[activeStroke.points.length - 1];
      activeStroke.points.push(...data.points);

      // Render streaming segment immediately onto canvas
      ctx.beginPath();
      ctx.strokeStyle = activeStroke.isEraser ? '#11131f' : activeStroke.color;
      ctx.lineWidth = (activeStroke.width / 800) * canvas.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(lastPt.x * canvas.width, lastPt.y * canvas.height);
      for (const pt of data.points) {
        ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      }
      ctx.stroke();
    };

    const onRemoteStrokeEnd = (data: { strokeId: string; stroke: DrawingStroke }) => {
      remoteActiveStrokes.delete(data.strokeId);
      if (data.stroke) {
        setLocalStrokes((prev) => {
          if (prev.some(s => s.id === data.stroke.id)) return prev;
          return [...prev, data.stroke];
        });
      }
    };

    const onRemoteStrokesSync = ({ strokes }: { strokes: DrawingStroke[] }) => {
      setLocalStrokes(strokes);
    };

    const onRemoteCloseGuess = ({ guess }: { guess: string }) => {
      setCloseGuessToast(`"${guess}" is close!`);
      sounds.playTimerWarningSound();
      setTimeout(() => setCloseGuessToast(null), 3500);
    };

    const onYouGuessed = ({ score }: { score: number }) => {
      sounds.playCorrectGuessSound();
      setCorrectGuessCelebration({ score: score || 500 });
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.55 },
      });
      setTimeout(() => setCorrectGuessCelebration(null), 3000);
    };

    socket.on('skribbl_stroke_start', onRemoteStrokeStart);
    socket.on('skribbl_stroke_chunk', onRemoteStrokeChunk);
    socket.on('skribbl_stroke_end', onRemoteStrokeEnd);
    socket.on('skribbl_strokes_sync', onRemoteStrokesSync);
    socket.on('skribbl_close_guess', onRemoteCloseGuess);
    socket.on('skribbl_you_guessed', onYouGuessed);

    return () => {
      socket.off('skribbl_stroke_start', onRemoteStrokeStart);
      socket.off('skribbl_stroke_chunk', onRemoteStrokeChunk);
      socket.off('skribbl_stroke_end', onRemoteStrokeEnd);
      socket.off('skribbl_strokes_sync', onRemoteStrokesSync);
      socket.off('skribbl_close_guess', onRemoteCloseGuess);
      socket.off('skribbl_you_guessed', onYouGuessed);
    };
  }, [socket]);

  // Celebrate on game over
  useEffect(() => {
    if (skribbl.status === 'game_over') {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 },
      });
      sounds.playCorrectGuessSound();
    }
  }, [skribbl.status]);

  const [localWordOptions, setLocalWordOptions] = useState<string[]>(skribbl.wordOptions || []);
  const [localWordDifficulties, setLocalWordDifficulties] = useState<Record<string, any>>(skribbl.wordOptionDifficulties || {});

  // Keep localWordOptions in sync with props
  useEffect(() => {
    if (skribbl.wordOptions && skribbl.wordOptions.length > 0) {
      setLocalWordOptions(skribbl.wordOptions);
    }
    if (skribbl.wordOptionDifficulties) {
      setLocalWordDifficulties(skribbl.wordOptionDifficulties);
    }
  }, [skribbl.wordOptions, skribbl.wordOptionDifficulties]);

  // Listen directly for skribbl_word_options event as a failsafe
  useEffect(() => {
    if (!socket) return;
    const onDirectWordOptions = (data: { options: string[]; difficulties?: any }) => {
      if (data?.options && data.options.length > 0) {
        setLocalWordOptions(data.options);
        if (data.difficulties) {
          setLocalWordDifficulties(data.difficulties);
        }
      }
    };
    socket.on('skribbl_word_options', onDirectWordOptions);
    return () => {
      socket.off('skribbl_word_options', onDirectWordOptions);
    };
  }, [socket]);

  // Active word options prioritizes prop or local state
  const activeWordOptions = (skribbl.wordOptions && skribbl.wordOptions.length > 0) ? skribbl.wordOptions : localWordOptions;
  const activeWordDifficulties = skribbl.wordOptionDifficulties || localWordDifficulties;

  // Automatically request word options from server if drawer hasn't received them yet
  useEffect(() => {
    if (isDrawer && skribbl.status === 'selecting_word' && (!activeWordOptions || activeWordOptions.length === 0)) {
      if (socket) {
        socket.emit('skribbl_request_words');
      }
      // 2-second safe fallback so the drawer is NEVER stuck on loading word choices
      const emergencyFallbackTimer = setTimeout(() => {
        if (!activeWordOptions || activeWordOptions.length === 0) {
          const fallbackList = ['SUN', 'BICYCLE', 'TIME MACHINE'];
          setLocalWordOptions(fallbackList);
          setLocalWordDifficulties({ 'SUN': 'easy', 'BICYCLE': 'medium', 'TIME MACHINE': 'hard' });
        }
      }, 2000);
      return () => clearTimeout(emergencyFallbackTimer);
    }
  }, [isDrawer, skribbl.status, activeWordOptions, socket]);

  // Re-render canvas from localStrokes with responsive normalized coordinates
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#11131f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    localStrokes.forEach((stroke) => {
      if (stroke.isFill) {
        if (stroke.points && stroke.points.length > 0) {
          const px = Math.round(stroke.points[0].x * canvas.width);
          const py = Math.round(stroke.points[0].y * canvas.height);
          floodFillCanvas(canvas, ctx, px, py, stroke.color);
        }
        return;
      }

      if (!stroke.points || stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? '#11131f' : stroke.color;
      ctx.fillStyle = stroke.isEraser ? '#11131f' : stroke.color;
      // Proportional brush scaling so drawing thickness matches across any screen size
      ctx.lineWidth = Math.max(1.5, (stroke.width / 800) * canvas.width);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        // Draw individual tap/dot
        const radius = Math.max(1, ((stroke.width / 800) * canvas.width) / 2);
        ctx.arc(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * canvas.width, stroke.points[i].y * canvas.height);
        }
        ctx.stroke();
      }
    });
  }, [localStrokes]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Handle window resizing and layout changes with ResizeObserver for crisp responsive canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const targetWidth = Math.round(rect.width);
      const targetHeight = Math.round(rect.height);
      if (targetWidth > 0 && targetHeight > 0 && (canvas.width !== targetWidth || canvas.height !== targetHeight)) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        redrawCanvas();
      }
    };

    updateSize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateSize();
      });
      ro.observe(canvas);
      if (canvas.parentElement) {
        ro.observe(canvas.parentElement);
      }
    }

    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [redrawCanvas]);

  // Auto-scroll dedicated in-game chat to bottom
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Normalized coordinate helper (0.0000 to 1.0000)
  const getNormalizedCoords = (clientX: number, clientY: number): DrawingPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const clampedY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return {
      x: Math.round((clampedX / rect.width) * 10000) / 10000,
      y: Math.round((clampedY / rect.height) * 10000) / 10000,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || skribbl.status !== 'drawing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const pt = getNormalizedCoords(e.clientX, e.clientY);

    // If Fill tool is active, perform flood fill tap/click
    if (activeTool === 'fill') {
      const fillStroke: DrawingStroke = {
        id: `fill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        points: [pt],
        color,
        width: 0,
        isFill: true,
      };

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          floodFillCanvas(canvas, ctx, Math.round(pt.x * canvas.width), Math.round(pt.y * canvas.height), color);
        }
      }

      setLocalStrokes(prev => [...prev, fillStroke]);
      onDrawStroke(fillStroke);
      return;
    }

    isDrawingRef.current = true;
    currentPointsRef.current = [pt];
    throttleBufferRef.current = [];

    const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    currentStrokeIdRef.current = strokeId;

    // Draw initial dot immediately onto canvas so a tap or click creates a mark instantly
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.fillStyle = isEraser ? '#11131f' : color;
        const radius = Math.max(1.5, ((brushWidth / 800) * canvas.width) / 2);
        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (socket) {
      socket.emit('skribbl_stroke_start', {
        strokeId,
        point: pt,
        color,
        width: brushWidth,
        isEraser,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawer || skribbl.status !== 'drawing') return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      handlePointerUp(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getNormalizedCoords(e.clientX, e.clientY);
    const lastPt = currentPointsRef.current[currentPointsRef.current.length - 1] || pt;
    currentPointsRef.current.push(pt);
    throttleBufferRef.current.push(pt);

    // Draw segment immediately
    ctx.beginPath();
    ctx.strokeStyle = isEraser ? '#11131f' : color;
    ctx.lineWidth = Math.max(1.5, (brushWidth / 800) * canvas.width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPt.x * canvas.width, lastPt.y * canvas.height);
    ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
    ctx.stroke();

    // Stream buffered points every 16ms to prevent network lag while drawing smoothly
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        if (socket && currentStrokeIdRef.current && throttleBufferRef.current.length > 0) {
          socket.emit('skribbl_stroke_chunk', {
            strokeId: currentStrokeIdRef.current,
            points: [...throttleBufferRef.current],
          });
          throttleBufferRef.current = [];
        }
        throttleTimerRef.current = null;
      }, 16);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawer) return;
    isDrawingRef.current = false;

    try {
      if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    if (socket && currentStrokeIdRef.current && throttleBufferRef.current.length > 0) {
      socket.emit('skribbl_stroke_chunk', {
        strokeId: currentStrokeIdRef.current,
        points: [...throttleBufferRef.current],
      });
      throttleBufferRef.current = [];
    }

    if (currentPointsRef.current.length > 0 && currentStrokeIdRef.current) {
      const finalPoints = currentPointsRef.current.length === 1
        ? [currentPointsRef.current[0], currentPointsRef.current[0]]
        : [...currentPointsRef.current];

      const newStroke: DrawingStroke = {
        id: currentStrokeIdRef.current,
        points: finalPoints,
        color,
        width: brushWidth,
        isEraser,
      };

      setLocalStrokes((prev) => [...prev, newStroke]);
      onDrawStroke(newStroke);

      if (socket) {
        socket.emit('skribbl_stroke_end', {
          strokeId: currentStrokeIdRef.current,
          stroke: newStroke,
        });
      }
    }

    currentPointsRef.current = [];
    throttleBufferRef.current = [];
    currentStrokeIdRef.current = null;
  };

  const handleUndo = () => {
    if (!isDrawer || localStrokes.length === 0) return;
    const nextStrokes = localStrokes.slice(0, -1);
    setLocalStrokes(nextStrokes);
    if (socket) {
      socket.emit('skribbl_undo_stroke');
    }
  };

  const handleGameGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || isDrawer || hasGuessed) return;
    const trimmed = guessInput.trim();
    setGuessInput('');
    onSendChatGuess(trimmed);
  };

  const handleGeneralChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalInput.trim()) return;
    const trimmed = generalInput.trim();
    setGeneralInput('');
    if (onSendChatMessage) {
      onSendChatMessage(trimmed);
    }
  };

  // ---------------------------------------------------------------------------
  // Lobby Screen
  // ---------------------------------------------------------------------------
  if (skribbl.status === 'lobby') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0a0c16] text-center select-none overflow-y-auto">
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20 shadow-xl shadow-indigo-500/10">
          <Palette size={40} />
        </div>

        <h2 className="text-3xl font-black tracking-tight text-white mb-2">
          Scribble & Guess
        </h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          Draw words in real time with your friends, take turns guessing, and race the countdown clock to top the scoreboard!
        </p>

        {/* Difficulty Selection Card (Host Only or Read-Only for Guests) */}
        <div className="w-full max-w-xl bg-white/[0.03] border border-white/10 rounded-3xl p-5 mb-8 shadow-2xl text-left">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Zap size={14} className="text-indigo-400" />
              <span>Word Difficulty</span>
            </span>
            {isHost ? (
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Host Controls
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                Set by room host
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {DIFFICULTY_CONFIG.map((d) => {
              const Icon = d.icon;
              const isSelected = currentDiff === d.id;
              return (
                <button
                  key={d.id}
                  disabled={!isHost}
                  onClick={() => onSetDifficulty && onSetDifficulty(d.id)}
                  aria-label={`Select difficulty ${d.name}`}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? d.activeColor
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  } ${isHost ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}
                >
                  <Icon size={18} className="mb-1.5" />
                  <p className="font-bold text-xs text-white">{d.name}</p>
                </button>
              );
            })}
          </div>

          {/* Active Difficulty Details */}
          {(() => {
            const activeCfg = DIFFICULTY_CONFIG.find(c => c.id === currentDiff) || DIFFICULTY_CONFIG[3];
            return (
              <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-xs text-slate-400">
                <p className="text-slate-300 font-medium mb-0.5">{activeCfg.desc}</p>
                <p className="text-[11px] text-slate-500 italic">Examples: {activeCfg.examples}</p>
              </div>
            );
          })()}
        </div>

        {/* Live Drawing Reactions & Scoring Rules Card */}
        <div className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3.5 mb-6 text-xs text-slate-300 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
            <ThumbsUp size={16} />
          </div>
          <div>
            <p className="font-bold text-white text-xs mb-1">Live Drawing Reactions & Scoring Rules</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              During each drawing turn, players can react to the artwork!
              A <span className="text-emerald-400 font-bold">Like 👍 adds +5 points</span> to the drawer.
              A <span className="text-rose-400 font-bold">Dislike 👎 subtracts -2 points</span>.
              Total scores never drop below 0.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isHost ? (
            <button
              onClick={onStartGame}
              aria-label="Start Skribbl game"
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Play size={18} fill="currentColor" />
              <span>Start Game</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-sm">
              <Sparkles size={16} className="text-indigo-400 animate-spin" />
              <span>Waiting for host to launch the game...</span>
            </div>
          )}

          <button
            onClick={onExitGame}
            aria-label="Leave Skribbl and return to Hangout"
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Exit to Hangout</span>
          </button>
        </div>

        <div className="mt-8 flex items-center gap-4 text-xs text-slate-400">
          <span>👥 {participants.length} Players</span>
          <span>•</span>
          <span>⏱️ 100s Turns</span>
          <span>•</span>
          <span>🏆 3 Rounds</span>
          <span>•</span>
          <span>🎨 350+ Words</span>
        </div>
      </div>
    );
  }

  const activeDiffConfig = DIFFICULTY_CONFIG.find(c => c.id === currentDiff) || DIFFICULTY_CONFIG[3];

  // Dynamic sorted leaderboard
  const sortedParticipants = [...participants].sort(
    (a, b) => (skribbl.scores[b.id] || 0) - (skribbl.scores[a.id] || 0)
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090b14] overflow-hidden select-none">
      {/* Top Game Header Bar */}
      <div className="h-14 border-b border-white/10 bg-[#0e101b] px-3 md:px-5 flex items-center justify-between z-20 shrink-0">
        {/* Left: Round & Exit */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={handleRequestExit}
            aria-label="Exit Skribbl game"
            title="Exit Game (returns to Hangout)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-slate-300 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-300">
            <span className="text-slate-500">ROUND</span>
            <span className="text-indigo-300 font-bold">{skribbl.currentRound}</span>
            <span className="text-slate-500">/</span>
            <span>{skribbl.totalRounds}</span>
          </div>

          <div className={`hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border ${activeDiffConfig.tagColor}`}>
            <span className="text-slate-500">DIFF:</span>
            <span className="font-bold uppercase">{activeDiffConfig.name}</span>
          </div>

          <div className="text-xs text-slate-300 hidden md:flex items-center gap-1.5">
            <span className="text-slate-500">DRAWER:</span>
            <span className="font-semibold text-white truncate max-w-[100px]">
              {isDrawer ? 'You 🎨' : skribbl.drawerName}
            </span>
          </div>
        </div>

        {/* Center: Secret Word (Drawer) or Masked Hint (Guesser) */}
        <div className="flex items-center gap-2">
          {isDrawer ? (
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 px-3 md:px-5 py-1 rounded-xl text-center shadow-lg">
              <span className="text-[9px] md:text-[10px] text-amber-300 uppercase tracking-widest font-semibold block">
                YOUR SECRET WORD
              </span>
              <span className="text-xs md:text-sm font-black text-white tracking-widest">
                {skribbl.secretWord || 'SELECTING...'}
              </span>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 px-3 md:px-5 py-1 rounded-xl text-center">
              <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-widest font-medium block">
                GUESS THE WORD
              </span>
              <span className="text-sm md:text-base font-black font-mono text-indigo-300 tracking-[0.25em]">
                {skribbl.maskedHint || '_ _ _ _'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Round Timer */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-xs font-bold ${
              skribbl.timeLeft <= 10
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse'
                : 'bg-white/5 border border-white/10 text-slate-200'
            }`}
          >
            <Clock size={14} />
            <span>{skribbl.timeLeft}s</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-white/5 w-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${
            skribbl.timeLeft <= 10 ? 'bg-red-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, (skribbl.timeLeft / 100) * 100))}%` }}
        />
      </div>

      {/* Word Selection Overlay for Drawer (Offers 3 distinct choices) */}
      {skribbl.status === 'selecting_word' && isDrawer && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131524] border border-indigo-500/30 rounded-3xl p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-white mb-1">Pick a Word to Draw</h3>
            <p className="text-xs text-slate-400 mb-6">
              Choose one of three words to draw for your friends.
            </p>
            {activeWordOptions && activeWordOptions.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {activeWordOptions.map((word, idx) => {
                  const diff = activeWordDifficulties?.[word] || (idx === 0 ? 'easy' : idx === 1 ? 'medium' : 'hard');
                  const diffCfg = DIFFICULTY_CONFIG.find(c => c.id === diff) || DIFFICULTY_CONFIG[0];
                  return (
                    <button
                      key={word}
                      onClick={() => onSelectWord(word)}
                      aria-label={`Select word ${word}`}
                      className="px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-violet-600 border border-white/10 hover:border-transparent text-white font-bold tracking-wider text-sm transition-all hover:scale-[1.02] cursor-pointer flex items-center justify-between shadow-lg"
                    >
                      <span>{word}</span>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${diffCfg.tagColor}`}>
                        {diff}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center gap-3">
                <Sparkles size={24} className="text-indigo-400 animate-spin" />
                <p className="text-xs text-slate-400">Loading word choices...</p>
                <button
                  type="button"
                  onClick={() => socket?.emit('skribbl_request_words')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg"
                >
                  Refresh Words
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Word Selection Waiting for Guessers */}
      {skribbl.status === 'selecting_word' && !isDrawer && (
        <div className="absolute top-16 inset-x-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-[#121424]/90 border border-white/10 px-5 py-2 rounded-2xl shadow-xl text-xs text-slate-300 flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-400 animate-spin" />
            <span>{skribbl.drawerName} is selecting a secret word...</span>
          </div>
        </div>
      )}

      {/* Close Guess Toast */}
      {closeGuessToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-slate-950 font-black px-4 py-1.5 rounded-full text-xs shadow-2xl animate-bounce border border-amber-300">
          ⚠️ {closeGuessToast}
        </div>
      )}

      {/* 3D Correct Guess Visual Celebration Splash */}
      {correctGuessCelebration && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 text-white font-black text-xs sm:text-sm px-6 py-2.5 rounded-2xl shadow-2xl border-2 border-emerald-300 flex items-center gap-2.5 animate-in zoom-in-90 slide-in-from-top-4 duration-300 perspective-1000">
          <Sparkles size={18} className="text-yellow-300 animate-spin" />
          <span>Correct! +{correctGuessCelebration.score} Points</span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
            Rank Up!
          </span>
        </div>
      )}

      {/* Round End Overlay */}
      {skribbl.status === 'round_end' && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131524] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
            <Trophy size={40} className="text-amber-400 mx-auto mb-3" />
            <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Round Complete
            </h3>
            <p className="text-xl font-black text-white mb-4">
              The word was <span className="text-indigo-400">{skribbl.secretWord}</span>
            </p>
            <div className="text-xs text-slate-400 bg-white/5 p-3 rounded-xl">
              Next drawer is rotating in 3 seconds...
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen - Dedicated Top 3 Podium */}
      {skribbl.status === 'game_over' && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[#131524] border border-amber-500/40 rounded-3xl p-5 sm:p-8 max-w-xl w-full text-center shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles size={20} className="text-amber-400 animate-spin" />
              <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">
                Game Completed
              </span>
              <Sparkles size={20} className="text-amber-400 animate-spin" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
              🏆 Scribble Champions!
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Final scores and podium standings for Room Round {skribbl.totalRounds}
            </p>

            {/* TOP 3 PODIUM STAGE */}
            <div className="flex items-end justify-center gap-2 sm:gap-4 mb-6 pt-6 px-2 min-h-[200px]">
              {/* 2nd Place: Silver (Left) */}
              {sortedParticipants[1] && (
                <div className="flex-1 flex flex-col items-center max-w-[120px] sm:max-w-[140px] animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className="text-2xl sm:text-3xl mb-1">{sortedParticipants[1].avatar}</div>
                  <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full px-1">
                    {sortedParticipants[1].name}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-300 mb-2">
                    {skribbl.scores[sortedParticipants[1].id] || 0} pts
                  </span>
                  <div className="w-full h-24 sm:h-28 rounded-t-2xl bg-gradient-to-t from-slate-700 to-slate-500 border-t-2 border-slate-300 flex flex-col items-center justify-start pt-2 shadow-lg">
                    <span className="text-lg font-black text-slate-200">2nd</span>
                    <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Silver</span>
                  </div>
                </div>
              )}

              {/* 1st Place: Gold (Center - Tallest) */}
              {sortedParticipants[0] && (
                <div className="flex-1 flex flex-col items-center max-w-[130px] sm:max-w-[160px] animate-in fade-in slide-in-from-bottom-8 duration-700 z-10">
                  <Crown size={28} className="text-amber-400 animate-bounce mb-1" />
                  <div className="text-3xl sm:text-4xl mb-1">{sortedParticipants[0].avatar}</div>
                  <span className="text-xs sm:text-base font-black text-amber-300 truncate max-w-full px-1">
                    {sortedParticipants[0].name}
                  </span>
                  <span className="text-xs font-mono font-black text-amber-200 mb-2">
                    {skribbl.scores[sortedParticipants[0].id] || 0} pts
                  </span>
                  <div className="w-full h-32 sm:h-36 rounded-t-2xl bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-400 border-t-2 border-yellow-200 flex flex-col items-center justify-start pt-2 shadow-xl shadow-amber-500/20">
                    <span className="text-2xl font-black text-amber-950">1st</span>
                    <span className="text-[10px] uppercase font-black text-amber-950 tracking-wider">Winner</span>
                  </div>
                </div>
              )}

              {/* 3rd Place: Bronze (Right) */}
              {sortedParticipants[2] && (
                <div className="flex-1 flex flex-col items-center max-w-[120px] sm:max-w-[140px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-2xl sm:text-3xl mb-1">{sortedParticipants[2].avatar}</div>
                  <span className="text-xs sm:text-sm font-bold text-white truncate max-w-full px-1">
                    {sortedParticipants[2].name}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-amber-300 mb-2">
                    {skribbl.scores[sortedParticipants[2].id] || 0} pts
                  </span>
                  <div className="w-full h-18 sm:h-20 rounded-t-2xl bg-gradient-to-t from-amber-900 to-amber-700 border-t-2 border-amber-500 flex flex-col items-center justify-start pt-2 shadow-lg">
                    <span className="text-base font-black text-amber-200">3rd</span>
                    <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Bronze</span>
                  </div>
                </div>
              )}
            </div>

            {/* Remaining Runners-Up Ranking List */}
            {sortedParticipants.length > 3 && (
              <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-3 max-h-36 overflow-y-auto space-y-1.5 text-left text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Other Players:
                </span>
                {sortedParticipants.slice(3).map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-500 text-xs">
                        #{idx + 4}
                      </span>
                      <span className="text-sm">{p.avatar}</span>
                      <span className="font-semibold text-slate-200">{p.name}</span>
                    </div>
                    <span className="font-mono font-bold text-indigo-300 text-xs">
                      {skribbl.scores[p.id] || 0} pts
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Call Preservation Notice */}
            <div className="mb-6 py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LiveKit video and audio call remains active and connected.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              {isHost && (
                <button
                  onClick={onStartGame}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Play size={14} />
                  <span>Play Again</span>
                </button>
              )}
              <button
                onClick={onExitGame}
                className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Return to Lounge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-ROW STACKED LAYOUT: Drawing Area (Top Half) + Game Information (Bottom Half) */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
        {/* TOP HALF — DRAWING AREA */}
        <div className="flex-1 flex flex-col min-h-0 relative bg-[#11131f] overflow-hidden">
          {/* Drawing Canvas Surface */}
          <div 
            style={{ touchAction: 'none' }}
            className="flex-1 w-full h-full relative overflow-hidden select-none bg-[#11131f]"
          >
            <canvas
              ref={canvasRef}
              data-testid="skribbl-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ touchAction: 'none' }}
              className={`w-full h-full touch-none select-none ${
                isDrawer && skribbl.status === 'drawing' ? 'cursor-crosshair' : 'cursor-default'
              }`}
            />

            {/* Non-drawer Guess Banner if already guessed */}
            {hasGuessed && !isDrawer && (
              <div className="absolute top-3 left-3 bg-emerald-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 animate-in fade-in z-10">
                <CheckCircle2 size={14} />
                <span>You guessed the word!</span>
              </div>
            )}

            {/* Non-drawer Drawing Reaction Controls (Likes & Dislikes) */}
            {!isDrawer && skribbl.status === 'drawing' && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                <button
                  type="button"
                  onClick={() => handleReactDrawing('like')}
                  aria-label="Like drawing"
                  title="Like drawing (+5 pts to drawer)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-lg backdrop-blur-md cursor-pointer ${
                    isLiked
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-600/40 scale-105 ring-2 ring-emerald-400/50'
                      : 'bg-[#131524]/85 hover:bg-[#1a1c30] border-white/10 text-slate-200 hover:text-white'
                  }`}
                >
                  <ThumbsUp size={14} className={isLiked ? 'fill-current' : ''} />
                  <span>{likeCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleReactDrawing('dislike')}
                  aria-label="Dislike drawing"
                  title="Dislike drawing (-2 pts from drawer)"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-lg backdrop-blur-md cursor-pointer ${
                    isDisliked
                      ? 'bg-rose-600 border-rose-400 text-white shadow-rose-600/40 scale-105 ring-2 ring-rose-400/50'
                      : 'bg-[#131524]/85 hover:bg-[#1a1c30] border-white/10 text-slate-200 hover:text-white'
                  }`}
                >
                  <ThumbsDown size={14} className={isDisliked ? 'fill-current' : ''} />
                  <span>{dislikeCount}</span>
                </button>
              </div>
            )}

            {/* Drawer Active Live Reaction Tally */}
            {isDrawer && skribbl.status === 'drawing' && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-[#131524]/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Reactions:</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ThumbsUp size={13} className="fill-current" />
                  {likeCount}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-rose-400 flex items-center gap-1">
                  <ThumbsDown size={13} className="fill-current" />
                  {dislikeCount}
                </span>
              </div>
            )}
          </div>

          {/* Drawer Toolbar (Only visible when user is the active drawer) */}
          {isDrawer && skribbl.status === 'drawing' && (
            <div className="h-14 sm:h-16 border-t border-white/10 bg-[#0e101b] px-2 sm:px-4 flex items-center justify-between gap-1.5 sm:gap-3 z-20 shrink-0">
              {/* Colors - Authentic Skribbl.io 2-row palette */}
              <div className="grid grid-rows-2 grid-flow-col gap-1 overflow-x-auto py-1 px-1 max-w-[240px] sm:max-w-[340px] md:max-w-none scrollbar-none">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      if (activeTool === 'eraser') {
                        setActiveTool('brush');
                      }
                    }}
                    aria-label={`Select color ${c}`}
                    className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-md border transition-transform cursor-pointer shrink-0 ${
                      color === c && activeTool !== 'eraser'
                        ? 'scale-110 border-white ring-2 ring-indigo-400 shadow-md z-10'
                        : 'border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Brush Sizes */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5 sm:p-1 shrink-0">
                {BRUSH_SIZES.map((b) => (
                  <button
                    key={b.size}
                    onClick={() => {
                      setBrushWidth(b.size);
                      if (activeTool !== 'brush') {
                        setActiveTool('brush');
                      }
                    }}
                    aria-label={`Brush size ${b.label}`}
                    className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-lg text-[10px] sm:text-xs font-mono font-bold transition-colors cursor-pointer ${
                      brushWidth === b.size && activeTool === 'brush'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {/* Drawing Tools: Brush, Fill (Paint Bucket), Eraser, Undo, Clear */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => setActiveTool('brush')}
                  aria-label="Brush tool"
                  title="Brush Tool"
                  className={`p-1.5 sm:p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                    activeTool === 'brush'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Paintbrush size={14} className="sm:w-4 sm:h-4" />
                </button>

                <button
                  onClick={() => setActiveTool('fill')}
                  aria-label="Fill tool (paint bucket)"
                  title="Paint Bucket / Flood Fill Tool"
                  className={`p-1.5 sm:p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                    activeTool === 'fill'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <PaintBucket size={14} className="sm:w-4 sm:h-4" />
                </button>

                <button
                  onClick={() => setActiveTool(activeTool === 'eraser' ? 'brush' : 'eraser')}
                  aria-label="Toggle eraser"
                  title="Eraser"
                  className={`p-1.5 sm:p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                    activeTool === 'eraser'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Eraser size={14} className="sm:w-4 sm:h-4" />
                </button>

                <button
                  onClick={handleUndo}
                  aria-label="Undo last stroke"
                  title="Undo"
                  className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} className="sm:w-4 sm:h-4" />
                </button>

                <button
                  onClick={onClearCanvas}
                  aria-label="Clear drawing canvas"
                  title="Clear Canvas"
                  className="p-1.5 sm:p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs transition-colors cursor-pointer"
                >
                  <Trash2 size={14} className="sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM HALF — GAME INFORMATION (Chat & Persistent Live Leaderboard) */}
        <div className="h-56 sm:h-64 md:h-72 lg:h-80 border-t border-white/10 bg-[#0c0e18] flex flex-col md:flex-row shrink-0 z-10 overflow-hidden">
          {/* Mobile Persistent Leaderboard Strip (Always visible directly above chat on mobile) */}
          <div className="md:hidden shrink-0 border-b border-white/10 px-2.5 py-1.5 bg-[#0a0c16] flex items-center gap-2 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider shrink-0">
              <Trophy size={12} />
              <span>Rankings:</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {sortedParticipants.map((p, idx) => {
                const isCurrentDrawer = p.id === skribbl.drawerId;
                const pGuessed = skribbl.correctGuessers.includes(p.id);
                const score = skribbl.scores[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] shrink-0 border ${
                      pGuessed
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : isCurrentDrawer
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="font-mono font-bold text-slate-400">#{idx + 1}</span>
                    <span>{p.avatar}</span>
                    <span className="font-semibold truncate max-w-[65px]">{p.name}</span>
                    {isCurrentDrawer && <span title="Drawing">🎨</span>}
                    {pGuessed && <CheckCircle2 size={10} className="text-emerald-400" />}
                    <span className="font-mono font-bold text-white ml-0.5">{score}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Left: Persistent Live Leaderboard (Always visible side-by-side with chat) */}
          <div className="hidden md:flex w-64 lg:w-72 border-r border-white/10 flex-col bg-[#090b14]/80 shrink-0">
            <div className="p-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Trophy size={13} className="text-amber-400" />
                <span>Live Leaderboard</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {participants.length} players
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
              {sortedParticipants.map((p, rankIdx) => {
                const isCurrentDrawer = p.id === skribbl.drawerId;
                const pGuessed = skribbl.correctGuessers.includes(p.id);
                const score = skribbl.scores[p.id] || 0;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                      pGuessed
                        ? 'bg-emerald-500/15 border border-emerald-500/30'
                        : isCurrentDrawer
                        ? 'bg-indigo-500/15 border border-indigo-500/30'
                        : 'bg-white/5 border border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate max-w-[170px]">
                      <span className={`font-mono text-[11px] font-bold ${
                        rankIdx === 0 ? 'text-amber-400' : rankIdx === 1 ? 'text-slate-300' : rankIdx === 2 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        #{rankIdx + 1}
                      </span>
                      <span className="text-sm">{p.avatar}</span>
                      <div className="truncate">
                        <p className="font-semibold text-white truncate text-xs">
                          {p.name} {p.id === currentParticipantId && '(You)'}
                        </p>
                        <div className="flex items-center gap-1">
                          {isCurrentDrawer && (
                            <span className="text-[9px] text-indigo-400 font-mono font-bold flex items-center gap-0.5">
                              🎨 Drawing
                            </span>
                          )}
                          {pGuessed && (
                            <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-0.5">
                              <CheckCircle2 size={9} /> Guessed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-black text-indigo-300 text-xs">
                      {score} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guessing Chat Section (Dedicated Primary Game Chat with Permanent Input & Send Button) */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0c0e18]">
            {/* Inline Chat Tabs: Game Chat (Default) vs General Chat */}
            <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02] shrink-0">
              <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveChatTab('game')}
                  aria-label="Switch to Game Guesses chat"
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeChatTab === 'game'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🎯 Game Chat</span>
                  {skribbl.status === 'drawing' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChatTab('general')}
                  aria-label="Switch to General Lounge chat"
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeChatTab === 'general'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>💬 General</span>
                </button>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {activeChatTab === 'game' 
                  ? `${chat.filter(m => m.channel === 'skribbl' || m.isSystem || m.isCorrectGuess).length} guesses` 
                  : `${chat.filter(m => m.channel === 'general' || (!m.isSystem && !m.isCorrectGuess && m.channel !== 'skribbl')).length} msgs`}
              </span>
            </div>

            {/* Independent Scrollable Message Area */}
            <div className="flex-1 p-2.5 overflow-y-auto space-y-1.5 text-xs min-h-0">
              {(() => {
                const gameMessages = chat.filter(m => m.channel === 'skribbl' || m.isSystem || m.isCorrectGuess);
                const generalMessages = chat.filter(m => m.channel === 'general' || (!m.isSystem && !m.isCorrectGuess && m.channel !== 'skribbl'));
                const list = activeChatTab === 'game' ? gameMessages : generalMessages;

                if (list.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-3">
                      <HelpCircle size={20} className="mb-1 opacity-50" />
                      {activeChatTab === 'game' ? (
                        <>
                          <p className="font-semibold text-slate-400 text-xs">Type your guesses below!</p>
                          <p className="text-[10px] text-slate-600">Correct guesses earn points automatically.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-400 text-xs">Ordinary lounge chat</p>
                          <p className="text-[10px] text-slate-600">Messages here will never trigger game guesses.</p>
                        </>
                      )}
                    </div>
                  );
                }

                return list.map((msg) => {
                  if (msg.isSystem || msg.isCorrectGuess) {
                    return (
                      <div
                        key={msg.id}
                        className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-2 rounded-xl text-center font-bold text-xs shadow-sm animate-in fade-in"
                      >
                        {msg.text}
                      </div>
                    );
                  }

                  const isMe = msg.senderId === currentParticipantId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1 mb-0.5 text-[10px] text-slate-400">
                        <span>{msg.senderAvatar}</span>
                        <span className="font-semibold text-slate-300">{msg.senderName}</span>
                      </div>
                      <div
                        className={`px-2.5 py-1 rounded-2xl max-w-[85%] break-words text-xs ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white/10 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                });
              })()}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Dedicated Guess / Chat Input Bar (Permanently accessible at bottom of chat panel) */}
            <div className="p-2 sm:p-2.5 border-t border-white/10 bg-[#0e101b] shrink-0">
              {activeChatTab === 'game' ? (
                /* Game Chat Input */
                isDrawer ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center text-xs text-amber-300 font-medium">
                    🎨 You are drawing! Guessing chat is disabled for the drawer to keep the secret word safe.
                  </div>
                ) : hasGuessed ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2 text-center text-xs text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>You guessed correctly! Enjoy watching.</span>
                  </div>
                ) : (
                  <form onSubmit={handleGameGuessSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={guessInput}
                      onChange={(e) => setGuessInput(e.target.value)}
                      placeholder="Type your guess here..."
                      className="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Send guess"
                      disabled={!guessInput.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer flex items-center gap-1 shadow-md shadow-indigo-600/30 shrink-0"
                    >
                      <Send size={13} />
                      <span>Guess</span>
                    </button>
                  </form>
                )
              ) : (
                /* General Chat Input */
                <form onSubmit={handleGeneralChatSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={generalInput}
                    onChange={(e) => setGeneralInput(e.target.value)}
                    placeholder="Message everyone in room..."
                    className="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Send general message"
                    disabled={!generalInput.trim()}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer flex items-center gap-1 shadow-md shadow-indigo-600/30 shrink-0"
                  >
                    <Send size={13} />
                    <span>Send</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exit Game Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#131524] border border-white/10 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Exit Active Game?</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              A round is currently in progress. Exiting will return you to the Hangout lounge.
              <strong className="block text-indigo-300 mt-1">Your video call will remain connected!</strong>
            </p>
            {isHost ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    if (onHostEndGame) onHostEndGame();
                    else onExitGame();
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5"
                >
                  <Crown size={14} />
                  <span>Return Entire Room to Hangout</span>
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    onExitGame();
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Exit Just for Me
                </button>
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full py-2 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Stay in Game
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Stay & Play
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    onExitGame();
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-lg shadow-red-600/30"
                >
                  Exit Game
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
