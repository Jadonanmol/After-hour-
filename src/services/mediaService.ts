import {
  Room as LiveKitRoom,
  RoomEvent,
  Track,
  TrackEvent,
  RemoteTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  VideoPresets,
} from 'livekit-client';
import type { MediaErrorInfo, MediaToggleResult, CameraHealthStatus } from '../types/index.ts';

export interface MediaDeviceState {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedAudioInputId: string;
  selectedVideoInputId: string;
}

export interface InitMediaResult {
  stream: MediaStream | null;
  videoError?: MediaErrorInfo;
  audioError?: MediaErrorInfo;
}

export interface RemoteParticipantMedia {
  participantId: string;
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  screenStream: MediaStream | null;
  isSpeaking: boolean;
  isVideoMuted: boolean;
  isAudioMuted: boolean;
}

export function parseMediaError(err: any, kind: 'camera' | 'microphone'): MediaErrorInfo {
  const errName = err?.name || '';
  const errMsg = err?.message || String(err);

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return {
      kind,
      errorKind: 'permission_denied',
      title: `${kind === 'camera' ? 'Camera' : 'Microphone'} Permission Blocked`,
      message: `Your browser has blocked access to your ${kind}. To turn it on, allow permission in your browser site settings.`,
      instructions: [
        'Look at the address bar at the top of your browser.',
        'Click the Site Settings / Lock icon (🔒 or 🎛️) next to the website URL.',
        `Find "${kind === 'camera' ? 'Camera' : 'Microphone'}" and change it from "Block" to "Allow".`,
        `Click the ${kind === 'camera' ? 'Camera' : 'Mic'} button in AFTERHOURS again to activate your device.`,
      ],
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      kind,
      errorKind: 'not_found',
      title: `No ${kind === 'camera' ? 'Camera' : 'Microphone'} Detected`,
      message: `No physical ${kind} was found on your computer or device.`,
      instructions: [
        `Ensure your ${kind === 'camera' ? 'webcam' : 'microphone/headset'} is firmly connected.`,
        'Check if your laptop has a physical privacy slider or function key toggle.',
        'If using an external USB device, unplug and plug it back in.',
      ],
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return {
      kind,
      errorKind: 'device_busy',
      title: `${kind === 'camera' ? 'Camera' : 'Microphone'} is Busy`,
      message: `Another application is currently using your ${kind} (e.g. Zoom, Google Meet, Teams, or another browser tab).`,
      instructions: [
        'Close other video call apps (Zoom, Teams, FaceTime, Skype).',
        'Close other browser tabs that may be using your camera or mic.',
        `Press the ${kind === 'camera' ? 'Camera' : 'Mic'} button again to retry.`,
      ],
    };
  }

  if (errName === 'OverconstrainedError') {
    return {
      kind,
      errorKind: 'overconstrained',
      title: `${kind === 'camera' ? 'Camera' : 'Microphone'} Settings Unsupported`,
      message: 'The requested video resolution or device configuration is not supported by your hardware.',
      instructions: [
        'Try selecting a standard device from Settings.',
        'AFTERHOURS will attempt falling back to default resolution.',
      ],
    };
  }

  return {
    kind,
    errorKind: 'unknown',
    title: `Could Not Access ${kind === 'camera' ? 'Camera' : 'Microphone'}`,
    message: errMsg || `An unexpected error occurred while initializing your ${kind}.`,
    instructions: [
      'Ensure your browser has permissions granted in system preferences.',
      'Check if your browser needs to be updated or restarted.',
    ],
  };
}

export class MediaService {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private livekitRoom: LiveKitRoom | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speechDetectionInterval: NodeJS.Timeout | null = null;

  // Track attached audio elements for cleanup
  private attachedAudioElements = new Map<string, HTMLAudioElement>();

  // Map of remote participants' active media streams
  public remoteStreams = new Map<string, RemoteParticipantMedia>();

  public isLiveKitConnected = false;
  public audioPlaybackBlocked = false;
  public connectionState = 'disconnected';

  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onRemoteStreamsChange?: (streams: Map<string, RemoteParticipantMedia>) => void;
  public onAudioPlaybackBlockedChange?: (blocked: boolean) => void;
  public onConnectionStateChange?: (state: string) => void;
  public onDevicesChanged?: () => void;
  public onCameraHealthChange?: (status: CameraHealthStatus, message?: string) => void;
  public onLocalStreamChange?: (stream: MediaStream | null) => void;

  // Camera health and automatic freeze recovery state
  public cameraHealth: CameraHealthStatus = 'healthy';
  public isRecoveringCamera = false;
  public cameraRecoveryAttempts = 0;
  private readonly maxRecoveryAttempts = 3;
  private lastRecoveryAttemptTime = 0;
  private cameraCheckInterval: NodeJS.Timeout | null = null;
  private trackMuteTimeout: NodeJS.Timeout | null = null;
  private isCameraIntentionallyOff = false;
  private consecutiveFrozenChecks = 0;

  constructor() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        if (this.onDevicesChanged) {
          this.onDevicesChanged();
        }
      });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', this.handleVisibilityChange);
      window.addEventListener('online', () => {
        console.log('[MediaService] Network online restored, checking audio/video state');
        setTimeout(() => {
          this.handleVisibilityChange();
        }, 500);
      });
    }
  }

  /**
   * Initializes media stream gracefully for landing page preview and call setup.
   * Reuses existing healthy tracks if already acquired to avoid redundant hardware prompts.
   */
  async initLocalMedia(video = true, audio = true): Promise<InitMediaResult> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('[MediaService] getUserMedia is not supported');
      return { stream: null };
    }

    let videoError: MediaErrorInfo | undefined;
    let audioError: MediaErrorInfo | undefined;

    const acquiredTracks: MediaStreamTrack[] = [];

    // Check if we already have healthy tracks in this.localStream
    const existingAudio = this.localStream?.getAudioTracks().find(t => t.readyState === 'live');
    const existingVideo = this.localStream?.getVideoTracks().find(t => t.readyState === 'live');

    let needAudio = audio;
    if (existingAudio) {
      if (audio) {
        existingAudio.enabled = true;
        acquiredTracks.push(existingAudio);
        needAudio = false;
      } else {
        existingAudio.enabled = false;
      }
    }

    let needVideo = video;
    if (existingVideo) {
      if (video) {
        existingVideo.enabled = true;
        acquiredTracks.push(existingVideo);
        needVideo = false;
      } else {
        existingVideo.enabled = false;
      }
    }

    // If both desired tracks are already live and ready, return immediately without delay
    if (!needAudio && !needVideo && acquiredTracks.length > 0) {
      this.localStream = new MediaStream(acquiredTracks);
      this.bindTrackHealthListeners();
      this.setupSpeakingDetector(this.localStream);
      return { stream: this.localStream };
    }

    const safeGetUserMedia = (constraints: MediaStreamConstraints, timeoutMs = 2500): Promise<MediaStream> => {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Media access timed out'));
          }
        }, timeoutMs);

        navigator.mediaDevices.getUserMedia(constraints)
          .then(stream => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(stream);
            } else {
              stream.getTracks().forEach(t => t.stop());
            }
          })
          .catch(err => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(err);
            }
          });
      });
    };

    // Attempt audio if needed
    if (needAudio) {
      try {
        const audioStream = await safeGetUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const track = audioStream.getAudioTracks()[0];
        if (track) acquiredTracks.push(track);
      } catch (err) {
        console.warn('[MediaService] Audio init error:', err);
        audioError = parseMediaError(err, 'microphone');
      }
    }

    // Attempt video if needed
    if (needVideo) {
      try {
        const videoStream = await safeGetUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
        const track = videoStream.getVideoTracks()[0];
        if (track) acquiredTracks.push(track);
      } catch (err) {
        console.warn('[MediaService] Video init error:', err);
        videoError = parseMediaError(err, 'camera');
      }
    }

    if (acquiredTracks.length > 0) {
      this.localStream = new MediaStream(acquiredTracks);
      this.bindTrackHealthListeners();
      this.setupSpeakingDetector(this.localStream);
    } else {
      this.localStream = null;
    }

    return {
      stream: this.localStream,
      videoError,
      audioError,
    };
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  getRemoteVideoStream(participantId: string): MediaStream | null {
    const entry = this.remoteStreams.get(participantId);
    if (!entry) return null;
    return entry.screenStream || entry.videoStream;
  }

  getRemoteScreenStream(participantId: string): MediaStream | null {
    return this.remoteStreams.get(participantId)?.screenStream || null;
  }

  /**
   * Toggle or enable/disable microphone.
   */
  async toggleMicrophone(mute: boolean): Promise<MediaToggleResult> {
    if (mute) {
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      if (this.livekitRoom && this.isLiveKitConnected) {
        try {
          await this.livekitRoom.localParticipant.setMicrophoneEnabled(false);
        } catch (err) {
          console.warn('[MediaService] LiveKit mic mute error:', err);
        }
      }
      return { success: true, stream: this.localStream };
    }

    // Unmuting: If LiveKit is connected, let LiveKit acquire and manage the microphone
    if (this.livekitRoom && this.isLiveKitConnected) {
      try {
        await this.livekitRoom.localParticipant.setMicrophoneEnabled(true);
        const lkTrack = this.livekitRoom.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack?.mediaStreamTrack;
        if (lkTrack) {
          if (!this.localStream) {
            this.localStream = new MediaStream([lkTrack]);
          } else {
            this.localStream.getAudioTracks().forEach(t => this.localStream!.removeTrack(t));
            this.localStream.addTrack(lkTrack);
          }
          this.setupSpeakingDetector(this.localStream);
        }
        return { success: true, stream: this.localStream };
      } catch (err) {
        console.warn('[MediaService] LiveKit mic unmute error:', err);
        const errorInfo = parseMediaError(err, 'microphone');
        return { success: false, stream: this.localStream, error: errorInfo };
      }
    }

    // Local fallback when LiveKit is not connected
    const existingAudioTrack = this.localStream?.getAudioTracks().find(t => t.readyState === 'live');
    if (existingAudioTrack) {
      existingAudioTrack.enabled = true;
      return { success: true, stream: this.localStream };
    }

    // Acquire microphone locally
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const newTrack = stream.getAudioTracks()[0];
      if (!newTrack) {
        throw new Error('No audio track returned');
      }

      if (!this.localStream) {
        this.localStream = new MediaStream([newTrack]);
      } else {
        this.localStream.addTrack(newTrack);
      }

      this.setupSpeakingDetector(this.localStream);
      return { success: true, stream: this.localStream };
    } catch (err) {
      console.warn('[MediaService] Failed to recover microphone:', err);
      const errorInfo = parseMediaError(err, 'microphone');
      return { success: false, stream: this.localStream, error: errorInfo };
    }
  }

  /**
   * Toggle or enable/disable camera.
   */
  async toggleCamera(off: boolean): Promise<MediaToggleResult> {
    if (off) {
      this.isCameraIntentionallyOff = true;
      this.stopCameraHealthMonitor();
      this.setCameraHealth('healthy');

      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
      if (this.livekitRoom && this.isLiveKitConnected) {
        try {
          await this.livekitRoom.localParticipant.setCameraEnabled(false);
        } catch (err) {
          console.warn('[MediaService] LiveKit camera disable error:', err);
        }
      }
      return { success: true, stream: this.localStream };
    }

    // Turn camera ON: Reset attempts and restart health monitor
    this.isCameraIntentionallyOff = false;
    this.cameraRecoveryAttempts = 0;

    // If LiveKit is connected, let LiveKit acquire and manage camera track
    if (this.livekitRoom && this.isLiveKitConnected) {
      try {
        await this.livekitRoom.localParticipant.setCameraEnabled(true, {
          resolution: VideoPresets.h720.resolution,
          facingMode: 'user',
        });
        const lkTrack = this.livekitRoom.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack?.mediaStreamTrack;
        if (lkTrack) {
          if (!this.localStream) {
            this.localStream = new MediaStream([lkTrack]);
          } else {
            this.localStream.getVideoTracks().forEach(t => this.localStream!.removeTrack(t));
            this.localStream.addTrack(lkTrack);
          }
        }
        this.startCameraHealthMonitor();
        this.setCameraHealth('healthy');
        return { success: true, stream: this.localStream };
      } catch (err) {
        console.warn('[MediaService] LiveKit camera publish error:', err);
        const errorInfo = parseMediaError(err, 'camera');
        return { success: false, stream: this.localStream, error: errorInfo };
      }
    }

    // Local fallback when LiveKit is not connected
    const existingVideoTrack = this.localStream?.getVideoTracks().find(t => t.readyState === 'live');
    if (existingVideoTrack) {
      existingVideoTrack.enabled = true;
      this.startCameraHealthMonitor();
      this.setCameraHealth('healthy');
      return { success: true, stream: this.localStream };
    }

    // Prompt browser for camera access
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) {
        throw new Error('No video track returned');
      }

      if (!this.localStream) {
        this.localStream = new MediaStream([newTrack]);
      } else {
        this.localStream.addTrack(newTrack);
      }

      this.startCameraHealthMonitor();
      this.setCameraHealth('healthy');
      return { success: true, stream: this.localStream };
    } catch (err) {
      console.warn('[MediaService] Failed to recover camera:', err);
      const errorInfo = parseMediaError(err, 'camera');
      return { success: false, stream: this.localStream, error: errorInfo };
    }
  }

  async startScreenShare(): Promise<MediaStream | null> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        return null;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as any,
        audio: true,
      });

      this.screenStream = stream;

      stream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      if (this.livekitRoom && this.isLiveKitConnected) {
        try {
          await this.livekitRoom.localParticipant.setScreenShareEnabled(true, {
            resolution: VideoPresets.h1080.resolution,
          });
        } catch (err) {
          console.warn('[MediaService] LiveKit screen share warning:', err);
        }
      }

      return stream;
    } catch (err) {
      console.warn('[MediaService] Screen sharing cancelled or denied');
      return null;
    }
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    if (this.livekitRoom && this.isLiveKitConnected) {
      try {
        await this.livekitRoom.localParticipant.setScreenShareEnabled(false);
      } catch (err) {
        console.warn('[MediaService] LiveKit stop screen share warning:', err);
      }
    }
  }

  /**
   * Connects to LiveKit SFU, subscribes to all tracks, and handles playback.
   */
  async connectLiveKit(
    url: string,
    token: string,
    initialMediaState: { isAudioMuted: boolean; isVideoOff: boolean } = { isAudioMuted: false, isVideoOff: false }
  ): Promise<boolean> {
    try {
      console.log('[MediaService] Connecting to LiveKit:', url);
      const room = new LiveKitRoom({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
          facingMode: 'user',
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        publishDefaults: {
          simulcast: true,
          videoSimulcastLayers: [
            VideoPresets.h180,
            VideoPresets.h360,
            VideoPresets.h720,
          ],
        },
      });

      this.livekitRoom = room;

      // Handle Connection State
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        console.log('[MediaService] LiveKit Connection State:', state);
        this.connectionState = state;
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(state);
        }
      });

      // Handle Reconnecting and Reconnected seamlessly
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[MediaService] LiveKit reconnecting...');
        this.connectionState = 'reconnecting';
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange('reconnecting');
        }
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log('[MediaService] LiveKit reconnected!');
        this.isLiveKitConnected = true;
        this.connectionState = 'connected';
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange('connected');
        }
        // Resubscribe / refresh any active publications
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.isSubscribed && pub.track) {
              this.handleRemoteTrackSubscribed(pub.track, pub, participant);
            }
          });
        });
        if (this.onRemoteStreamsChange) {
          this.onRemoteStreamsChange(new Map(this.remoteStreams));
        }
      });

      // Handle Track Stream State changes (e.g. paused / active / low-bandwidth)
      room.on(RoomEvent.TrackStreamStateChanged, (pub, streamState) => {
        console.log(`[MediaService] TrackStreamStateChanged: ${pub.trackSid} -> ${streamState || (pub as any).streamState}`);
        if (this.onRemoteStreamsChange) {
          this.onRemoteStreamsChange(new Map(this.remoteStreams));
        }
      });

      // Ensure newly published tracks are auto-subscribed
      room.on(RoomEvent.TrackPublished, (pub) => {
        if (!pub.isSubscribed) {
          pub.setSubscribed(true);
        }
      });

      // Handle Autoplay Blocked Status
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        this.audioPlaybackBlocked = !room.canPlaybackAudio;
        console.log('[MediaService] Audio playback permitted:', room.canPlaybackAudio);
        if (this.onAudioPlaybackBlockedChange) {
          this.onAudioPlaybackBlockedChange(this.audioPlaybackBlocked);
        }
      });

      // Handle Track Subscribed (Both Audio and Video)
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log(`[MediaService] TrackSubscribed: kind=${track.kind}, source=${publication.source}, from=${participant.identity}`);
        this.handleRemoteTrackSubscribed(track, publication, participant);
      });

      // Handle Track Unsubscribed
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log(`[MediaService] TrackUnsubscribed: kind=${track.kind}, from=${participant.identity}`);
        this.handleRemoteTrackUnsubscribed(track, publication, participant);
      });

      // Handle Track Muted / Unmuted
      room.on(RoomEvent.TrackMuted, (publication, participant) => {
        this.updateParticipantMuteStatus(participant.identity, publication.kind, true);
      });

      room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
        this.updateParticipantMuteStatus(participant.identity, publication.kind, false);
      });

      // Handle Active Speakers
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakingIdentities = new Set(speakers.map(s => s.identity));
        let changed = false;
        this.remoteStreams.forEach((media, id) => {
          const isSpk = speakingIdentities.has(id);
          if (media.isSpeaking !== isSpk) {
            media.isSpeaking = isSpk;
            changed = true;
          }
        });
        if (changed && this.onRemoteStreamsChange) {
          this.onRemoteStreamsChange(new Map(this.remoteStreams));
        }
      });

      // Handle Participant Disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('[MediaService] Remote participant disconnected:', participant.identity);
        this.cleanupRemoteParticipant(participant.identity);
      });

      // Connect to the room
      await room.connect(url, token);
      this.isLiveKitConnected = true;
      this.connectionState = 'connected';
      console.log('[MediaService] LiveKit connected successfully! Room name:', room.name);

      // Check if browser allows audio playback
      if (!room.canPlaybackAudio) {
        this.audioPlaybackBlocked = true;
        if (this.onAudioPlaybackBlockedChange) {
          this.onAudioPlaybackBlockedChange(true);
        }
      }

      // Process any tracks that were already published before this client connected
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          if (pub.isSubscribed && pub.track) {
            this.handleRemoteTrackSubscribed(pub.track, pub, participant);
          }
        });
      });

      // Publish local tracks according to requested initial media state
      try {
        if (!initialMediaState.isAudioMuted) {
          await room.localParticipant.setMicrophoneEnabled(true);
        }
        if (!initialMediaState.isVideoOff) {
          await room.localParticipant.setCameraEnabled(true);
        }

        // Sync localStream reference to LiveKit published tracks
        const lTracks: MediaStreamTrack[] = [];
        room.localParticipant.trackPublications.forEach(pub => {
          if (pub.track?.mediaStreamTrack) {
            lTracks.push(pub.track.mediaStreamTrack);
          }
        });
        if (lTracks.length > 0) {
          this.localStream = new MediaStream(lTracks);
          this.setupSpeakingDetector(this.localStream);
        }
      } catch (pubErr) {
        console.warn('[MediaService] Local track publish error during connect:', pubErr);
      }

      return true;
    } catch (err) {
      console.error('[MediaService] LiveKit connection error:', err);
      this.isLiveKitConnected = false;
      this.connectionState = 'failed';
      return false;
    }
  }

  /**
   * Handles newly subscribed remote video or audio track.
   */
  private handleRemoteTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    const id = participant.identity;
    let entry = this.remoteStreams.get(id);
    if (!entry) {
      entry = {
        participantId: id,
        videoStream: null,
        audioStream: null,
        screenStream: null,
        isSpeaking: participant.isSpeaking,
        isVideoMuted: false,
        isAudioMuted: false,
      };
      this.remoteStreams.set(id, entry);
    }

    if (track.kind === Track.Kind.Video) {
      const videoTrack = track as RemoteVideoTrack;
      const stream = new MediaStream([videoTrack.mediaStreamTrack]);
      if (publication.source === Track.Source.ScreenShare) {
        entry.screenStream = stream;
      } else {
        entry.videoStream = stream;
      }
      entry.isVideoMuted = track.isMuted;
    } else if (track.kind === Track.Kind.Audio) {
      const audioTrack = track as RemoteAudioTrack;
      entry.audioStream = new MediaStream([audioTrack.mediaStreamTrack]);
      entry.isAudioMuted = track.isMuted;

      const audioElKey = `${id}-${track.sid}`;

      // Clean up any stale audio elements for this participant to avoid echo / duplicate audio
      this.attachedAudioElements.forEach((el, key) => {
        if (key.startsWith(`${id}-`) && key !== audioElKey) {
          try { el.remove(); } catch {}
          this.attachedAudioElements.delete(key);
        }
      });

      // Attach audio element to document for playback
      let audioEl = this.attachedAudioElements.get(audioElKey);
      if (!audioEl) {
        audioEl = audioTrack.attach();
        audioEl.id = `lk-audio-${id}`;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        this.attachedAudioElements.set(audioElKey, audioEl);
      }
    }

    if (this.onRemoteStreamsChange) {
      this.onRemoteStreamsChange(new Map(this.remoteStreams));
    }
  }

  /**
   * Handles remote track unsubscribed.
   */
  private handleRemoteTrackUnsubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    const id = participant.identity;
    const entry = this.remoteStreams.get(id);
    if (!entry) return;

    if (track.kind === Track.Kind.Video) {
      if (publication.source === Track.Source.ScreenShare) {
        entry.screenStream = null;
      } else {
        entry.videoStream = null;
      }
    } else if (track.kind === Track.Kind.Audio) {
      entry.audioStream = null;
      const audioElKey = `${id}-${track.sid}`;
      const audioEl = this.attachedAudioElements.get(audioElKey);
      if (audioEl) {
        track.detach(audioEl);
        audioEl.remove();
        this.attachedAudioElements.delete(audioElKey);
      }
    }

    if (this.onRemoteStreamsChange) {
      this.onRemoteStreamsChange(new Map(this.remoteStreams));
    }
  }

  private updateParticipantMuteStatus(id: string, kind: string | undefined, isMuted: boolean) {
    const entry = this.remoteStreams.get(id);
    if (!entry) return;

    if (kind === 'video') {
      entry.isVideoMuted = isMuted;
    } else if (kind === 'audio') {
      entry.isAudioMuted = isMuted;
    }

    if (this.onRemoteStreamsChange) {
      this.onRemoteStreamsChange(new Map(this.remoteStreams));
    }
  }

  private cleanupRemoteParticipant(id: string) {
    // Remove attached audio elements
    this.attachedAudioElements.forEach((el, key) => {
      if (key.startsWith(`${id}-`)) {
        el.remove();
        this.attachedAudioElements.delete(key);
      }
    });

    this.remoteStreams.delete(id);
    if (this.onRemoteStreamsChange) {
      this.onRemoteStreamsChange(new Map(this.remoteStreams));
    }
  }

  /**
   * Unblocks audio playback when browser blocked autoplay.
   */
  async unblockAudio(): Promise<boolean> {
    if (!this.livekitRoom) return false;
    try {
      await this.livekitRoom.startAudio();
      this.audioPlaybackBlocked = !this.livekitRoom.canPlaybackAudio;
      if (this.onAudioPlaybackBlockedChange) {
        this.onAudioPlaybackBlockedChange(this.audioPlaybackBlocked);
      }
      return true;
    } catch (e) {
      console.warn('[MediaService] Failed to unblock audio:', e);
      return false;
    }
  }

  async disconnect() {
    this.stopCameraHealthMonitor();
    this.stopLocalMedia();
    this.stopScreenShare();

    // Remove all attached audio elements
    this.attachedAudioElements.forEach(el => el.remove());
    this.attachedAudioElements.clear();
    this.remoteStreams.clear();

    if (this.livekitRoom) {
      try {
        await this.livekitRoom.disconnect();
      } catch (err) {
        // ignore
      }
      this.livekitRoom = null;
      this.isLiveKitConnected = false;
      this.connectionState = 'disconnected';
    }

    if (this.speechDetectionInterval) {
      clearInterval(this.speechDetectionInterval);
      this.speechDetectionInterval = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
  }

  private stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
  }

  private setupSpeakingDetector(stream: MediaStream) {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }

      const source = this.audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let wasSpeaking = false;

      if (this.speechDetectionInterval) clearInterval(this.speechDetectionInterval);
      this.speechDetectionInterval = setInterval(() => {
        if (!this.analyser || !audioTrack.enabled) {
          if (wasSpeaking) {
            wasSpeaking = false;
            if (this.onSpeakingChange) this.onSpeakingChange(false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 25;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          if (this.onSpeakingChange) this.onSpeakingChange(isSpeaking);
        }
      }, 150);
    } catch (e) {
      console.warn('[MediaService] Speaking detector setup failed:', e);
    }
  }

  async getDevices(): Promise<MediaDeviceState> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return { audioInputs: [], videoInputs: [], selectedAudioInputId: '', selectedVideoInputId: '' };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      return {
        audioInputs,
        videoInputs,
        selectedAudioInputId: audioInputs[0]?.deviceId || '',
        selectedVideoInputId: videoInputs[0]?.deviceId || '',
      };
    } catch (e) {
      return { audioInputs: [], videoInputs: [], selectedAudioInputId: '', selectedVideoInputId: '' };
    }
  }

  // ---------------------------------------------------------------------------
  // Camera Freeze Detection & Automatic Recovery Engine (Part B Requirements 6 & 7)
  // ---------------------------------------------------------------------------

  /**
   * Starts periodic camera health monitoring and track listener bindings.
   */
  public startCameraHealthMonitor() {
    this.isCameraIntentionallyOff = false;
    this.stopCameraHealthMonitor();

    this.bindTrackHealthListeners();

    // Check camera health every 2.5 seconds
    this.cameraCheckInterval = setInterval(() => {
      this.checkCameraHealth();
    }, 2500);
  }

  /**
   * Stops camera health monitoring.
   */
  public stopCameraHealthMonitor() {
    if (this.cameraCheckInterval) {
      clearInterval(this.cameraCheckInterval);
      this.cameraCheckInterval = null;
    }
    if (this.trackMuteTimeout) {
      clearTimeout(this.trackMuteTimeout);
      this.trackMuteTimeout = null;
    }
    this.consecutiveFrozenChecks = 0;
  }

  /**
   * Binds mute and ended event listeners to the active local camera track.
   * Detects OS and hardware suspensions without relying only on track.enabled.
   */
  public bindTrackHealthListeners() {
    const videoTrack = this.localStream?.getVideoTracks().find(t => t.readyState === 'live');
    if (!videoTrack) return;

    videoTrack.onmute = () => {
      console.warn('[MediaService] Local camera track muted by browser/OS');
      if (this.isCameraIntentionallyOff || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
        return;
      }
      if (this.trackMuteTimeout) clearTimeout(this.trackMuteTimeout);
      this.trackMuteTimeout = setTimeout(() => {
        if (videoTrack.muted && !this.isCameraIntentionallyOff && !this.isRecoveringCamera) {
          console.warn('[MediaService] Camera track muted for > 2.5s, initiating automatic recovery');
          this.recoverCamera('track_muted_timeout');
        }
      }, 2500);
    };

    videoTrack.onunmute = () => {
      console.log('[MediaService] Local camera track unmuted');
      if (this.trackMuteTimeout) {
        clearTimeout(this.trackMuteTimeout);
        this.trackMuteTimeout = null;
      }
      if (this.cameraHealth === 'recovering') {
        this.setCameraHealth('healthy');
      }
    };

    videoTrack.onended = () => {
      console.warn('[MediaService] Local camera track ended unexpectedly');
      if (!this.isCameraIntentionallyOff && !this.isRecoveringCamera) {
        this.recoverCamera('track_ended');
      }
    };
  }

  /**
   * Verifies camera stream health and detects stalls.
   */
  public async checkCameraHealth() {
    if (this.isCameraIntentionallyOff || this.isRecoveringCamera) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const videoTrack = this.localStream?.getVideoTracks()[0];
    if (!videoTrack) return;

    // 1. Check if track ended
    if (videoTrack.readyState === 'ended') {
      console.warn('[MediaService] Camera track ended in health check');
      this.recoverCamera('track_ended_in_check');
      return;
    }

    // 2. Check if track is muted
    if (videoTrack.muted) {
      this.consecutiveFrozenChecks++;
      if (this.consecutiveFrozenChecks >= 2) {
        console.warn('[MediaService] Camera track stuck muted for 2 consecutive checks');
        this.recoverCamera('track_stuck_muted');
      }
      return;
    }

    // 3. Check LiveKit local participant publication status if connected
    if (this.livekitRoom && this.isLiveKitConnected) {
      const pub = this.livekitRoom.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub && pub.isMuted && !this.isCameraIntentionallyOff) {
        this.consecutiveFrozenChecks++;
        if (this.consecutiveFrozenChecks >= 2) {
          console.warn('[MediaService] LiveKit camera publication muted unexpectedly');
          this.recoverCamera('livekit_pub_muted');
        }
        return;
      }
    }

    this.consecutiveFrozenChecks = 0;
  }

  /**
   * Reliable automatic recovery when a camera freeze or stall is detected.
   * Preserves two-way audio, microphone tracks, room membership, and game state.
   */
  public async recoverCamera(reason: string, isManual = false): Promise<boolean> {
    if (this.isRecoveringCamera) {
      console.log('[MediaService] Camera recovery already in progress, skipping duplicate call');
      return false;
    }
    if (this.isCameraIntentionallyOff) {
      console.log('[MediaService] Camera intentionally off, ignoring recovery');
      return false;
    }

    const now = Date.now();
    // Sliding 45s window resets attempts counter
    if (now - this.lastRecoveryAttemptTime > 45000) {
      this.cameraRecoveryAttempts = 0;
    }

    if (!isManual && this.cameraRecoveryAttempts >= this.maxRecoveryAttempts) {
      console.warn('[MediaService] Max automatic camera recovery attempts reached. Showing manual retry.');
      this.setCameraHealth('failed', 'Camera stream stalled. Tap "Retry Camera" to reconnect video.');
      return false;
    }

    if (isManual) {
      this.cameraRecoveryAttempts = 0;
    }

    this.isRecoveringCamera = true;
    this.cameraRecoveryAttempts++;
    this.lastRecoveryAttemptTime = now;
    this.setCameraHealth('recovering');

    console.log(`[MediaService] Starting camera recovery (attempt ${this.cameraRecoveryAttempts}/${this.maxRecoveryAttempts}, reason: ${reason})`);

    try {
      // Phase 1: Attempt safe non-destructive restart on existing LiveKit camera track
      if (this.livekitRoom && this.isLiveKitConnected) {
        const camPub = this.livekitRoom.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.videoTrack) {
          try {
            await (camPub.videoTrack as any).restart?.();
            await new Promise(r => setTimeout(r, 500));
            const currentTrack = camPub.videoTrack.mediaStreamTrack;
            if (currentTrack && currentTrack.readyState === 'live' && !currentTrack.muted) {
              console.log('[MediaService] Camera recovered via non-destructive restart!');
              this.syncLocalVideoTrack(currentTrack);
              this.setCameraHealth('healthy');
              this.isRecoveringCamera = false;
              return true;
            }
          } catch (restartErr) {
            console.warn('[MediaService] Phase 1 restart failed, proceeding to Phase 2 fresh track:', restartErr);
          }
        }
      }

      // Phase 2: Cleanly stop stale camera track and acquire fresh hardware stream
      // PRESERVE audio tracks completely to maintain continuous two-way audio!
      const existingAudioTracks = this.localStream ? this.localStream.getAudioTracks() : [];
      const oldVideoTracks = this.localStream ? this.localStream.getVideoTracks() : [];

      if (this.livekitRoom && this.isLiveKitConnected) {
        try {
          await this.livekitRoom.localParticipant.setCameraEnabled(false);
        } catch (unpubErr) {
          console.warn('[MediaService] Error disabling old camera track:', unpubErr);
        }

        // Clean up old video tracks
        oldVideoTracks.forEach(t => {
          try {
            t.onmute = null;
            t.onunmute = null;
            t.onended = null;
            t.stop();
          } catch {}
        });

        await new Promise(r => setTimeout(r, 250));

        // Re-enable camera track in LiveKit
        await this.livekitRoom.localParticipant.setCameraEnabled(true, {
          resolution: VideoPresets.h720.resolution,
          facingMode: 'user',
        });

        const newLkTrack = this.livekitRoom.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack?.mediaStreamTrack;
        if (!newLkTrack) {
          throw new Error('LiveKit returned no video track after re-enabling camera');
        }

        this.localStream = new MediaStream([...existingAudioTracks, newLkTrack]);
      } else {
        // Local mode fallback
        oldVideoTracks.forEach(t => {
          try {
            t.onmute = null;
            t.onunmute = null;
            t.onended = null;
            t.stop();
          } catch {}
        });

        await new Promise(r => setTimeout(r, 250));

        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const freshStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
          const freshVideoTrack = freshStream.getVideoTracks()[0];
          if (!freshVideoTrack) throw new Error('No fresh video track returned');
          this.localStream = new MediaStream([...existingAudioTracks, freshVideoTrack]);
        }
      }

      this.bindTrackHealthListeners();

      if (this.onLocalStreamChange) {
        this.onLocalStreamChange(this.localStream);
      }

      console.log('[MediaService] Camera successfully recovered and republished!');
      this.setCameraHealth('healthy');
      this.isRecoveringCamera = false;
      this.consecutiveFrozenChecks = 0;
      return true;
    } catch (err) {
      console.error('[MediaService] Camera recovery attempt failed:', err);
      this.isRecoveringCamera = false;

      if (this.cameraRecoveryAttempts >= this.maxRecoveryAttempts) {
        this.setCameraHealth('failed', 'Camera recovery failed. Tap "Retry Camera" to reconnect video.');
      } else {
        const delay = this.cameraRecoveryAttempts * 1000;
        setTimeout(() => {
          if (!this.isCameraIntentionallyOff && this.cameraHealth !== 'healthy') {
            this.recoverCamera('backoff_retry');
          }
        }, delay);
      }
      return false;
    }
  }

  private syncLocalVideoTrack(newTrack: MediaStreamTrack) {
    if (!this.localStream) {
      this.localStream = new MediaStream([newTrack]);
    } else {
      const audioTracks = this.localStream.getAudioTracks();
      this.localStream.getVideoTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      this.localStream = new MediaStream([...audioTracks, newTrack]);
    }
    this.bindTrackHealthListeners();
    if (this.onLocalStreamChange) {
      this.onLocalStreamChange(this.localStream);
    }
  }

  private setCameraHealth(status: CameraHealthStatus, message?: string) {
    this.cameraHealth = status;
    if (this.onCameraHealthChange) {
      this.onCameraHealthChange(status, message);
    }
  }

  private handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      console.log('[MediaService] App returned to foreground, checking camera & audio state');
      setTimeout(() => {
        if (!this.isCameraIntentionallyOff) {
          this.checkCameraHealth();
        }
        if (this.audioPlaybackBlocked && this.livekitRoom) {
          this.unblockAudio().catch(() => {});
        }
      }, 400);
    }
  };

  /**
   * Safe attachment helper for video elements with automatic recovery of stalled playback.
   * Handles tab switches, backgrounding, and stream state changes.
   */
  public attachVideoElement(
    videoEl: HTMLVideoElement | null,
    stream: MediaStream | null,
    isLocal: boolean
  ): () => void {
    if (!videoEl) return () => {};

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(e => {
        if (e.name !== 'AbortError') {
          console.warn('[MediaService] Video play warning:', e);
        }
      });
    } else {
      videoEl.srcObject = null;
    }

    const handleStalledOrWaiting = () => {
      if (videoEl && videoEl.srcObject && videoEl.paused) {
        videoEl.play().catch(() => {});
      }
    };

    videoEl.addEventListener('stalled', handleStalledOrWaiting);
    videoEl.addEventListener('waiting', handleStalledOrWaiting);

    return () => {
      videoEl.removeEventListener('stalled', handleStalledOrWaiting);
      videoEl.removeEventListener('waiting', handleStalledOrWaiting);
    };
  }
}

export const mediaService = new MediaService();
