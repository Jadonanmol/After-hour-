export interface Participant {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  joinedAt: number;
  score: number;
  color: string;
  isDisconnected?: boolean;
}

export type TabType = 'hangout' | 'watch' | 'skribbl' | 'games';

export type ActivityType = 
  | 'hangout'
  | 'watch'
  | 'skribbl'
  | 'trivia'
  | 'truth_or_dare'
  | 'would_you_rather'
  | 'tic_tac_toe';

export type MediaDeviceKind = 'camera' | 'microphone';

export type MediaErrorKind = 
  | 'permission_denied'
  | 'not_found'
  | 'device_busy'
  | 'overconstrained'
  | 'security_error'
  | 'unknown';

export interface MediaErrorInfo {
  kind: MediaDeviceKind;
  errorKind: MediaErrorKind;
  title: string;
  message: string;
  instructions: string[];
}

export interface MediaToggleResult {
  success: boolean;
  stream: MediaStream | null;
  error?: MediaErrorInfo;
}

export interface WatchPartyState {
  title: string;
  url: string;
  status: 'playing' | 'paused';
  currentTime: number;
  lastUpdated: number;
  hostId: string;
  countdown: number | null; // e.g. 3, 2, 1 for synchronized launch
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
  isEraser?: boolean;
  isFill?: boolean;
}

export type SkribblDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export interface SkribblReactions {
  likes: string[]; // participant IDs
  dislikes: string[]; // participant IDs
}

export interface SkribblScoringRules {
  likePoints: number; // e.g. 5
  dislikePoints: number; // e.g. 2
}

export interface SkribblState {
  status: 'lobby' | 'selecting_word' | 'drawing' | 'round_end' | 'game_over';
  difficulty?: SkribblDifficulty;
  drawerId: string | null;
  drawerName?: string;
  wordOptions?: string[];
  wordOptionDifficulties?: Record<string, 'easy' | 'medium' | 'hard'>;
  secretWord?: string; // Only delivered to drawer
  secretWordDifficulty?: 'easy' | 'medium' | 'hard';
  maskedHint: string;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  correctGuessers: string[]; // participant IDs who guessed correctly
  scores: Record<string, number>;
  reactions?: SkribblReactions;
  scoringRules?: SkribblScoringRules;
}

export type CameraHealthStatus = 'healthy' | 'recovering' | 'failed';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isCorrectGuess?: boolean;
  channel?: 'general' | 'skribbl';
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
}

export interface ActivityVoteSession {
  isActive: boolean;
  timeLeft: number;
  proposals: Record<ActivityType, {
    voterIds: string[];
    voterNames: string[];
  }>;
  status: 'voting' | 'tied' | 'concluded';
  tiedActivities?: ActivityType[];
  winningActivity?: ActivityType;
}

export interface ActivityAnnouncement {
  id: string;
  text: string;
  activity: ActivityType;
  timestamp: number;
}

export interface RoomState {
  code: string;
  name: string;
  isLocked: boolean;
  hostId: string;
  activeTab: TabType;
  activeActivity: ActivityType;
  activityVoteSession: ActivityVoteSession | null;
  activityAnnouncement: ActivityAnnouncement | null;
  participants: Participant[];
  watchParty: WatchPartyState;
  skribbl: SkribblState;
  chat: ChatMessage[];
}

export type CallLayoutMode = 'docked' | 'minimized' | 'full' | 'pip';
