import React from 'react';
import { 
  Tv, 
  Palette, 
  HelpCircle, 
  Flame, 
  Shuffle, 
  Grid3X3, 
  Sparkles, 
  Vote, 
  Play, 
  Clock, 
  X, 
  Check, 
  Users, 
  Crown,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import type { ActivityType, ActivityVoteSession, Participant } from '../../types/index.ts';

export interface ActivityDefinition {
  id: ActivityType;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  category: string;
  accentColor: string;
}

export const ACTIVITIES: ActivityDefinition[] = [
  {
    id: 'watch',
    name: 'Watch Together (FrameX TV)',
    tagline: 'Synchronized cinema streaming, FrameX TV player, sync countdown & screen share.',
    icon: <Tv size={20} className="text-pink-400" />,
    category: 'Watch Party',
    accentColor: 'from-pink-500/20 to-purple-500/20 border-pink-500/30',
  },
  {
    id: 'skribbl',
    name: 'Skribbl / Drawing Game',
    tagline: 'Multiplayer drawing and guessing battle with secret words and live scoreboard.',
    icon: <Palette size={20} className="text-amber-400" />,
    category: 'Multiplayer Game',
    accentColor: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
  },
  {
    id: 'trivia',
    name: 'Quick Trivia',
    tagline: 'Fast-paced timed multiple-choice questions across pop culture, movies & tech.',
    icon: <HelpCircle size={20} className="text-emerald-400" />,
    category: 'Party Quiz',
    accentColor: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
  },
  {
    id: 'truth_or_dare',
    name: 'Truth or Dare',
    tagline: 'Chill, spicy, and wild conversation prompts for your group lounge.',
    icon: <Flame size={20} className="text-red-400" />,
    category: 'Social Game',
    accentColor: 'from-red-500/20 to-rose-500/20 border-red-500/30',
  },
  {
    id: 'would_you_rather',
    name: 'Would You Rather',
    tagline: 'Vote on hilarious dilemmas and see instant group percentage results.',
    icon: <Shuffle size={20} className="text-indigo-400" />,
    category: 'Group Voting',
    accentColor: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30',
  },
  {
    id: 'tic_tac_toe',
    name: 'Tic-Tac-Toe',
    tagline: 'Quick 1v1 tactical match with real-time turns, reset, and spectator support.',
    icon: <Grid3X3 size={20} className="text-cyan-400" />,
    category: 'Classic Duel',
    accentColor: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
  },
  {
    id: 'hangout',
    name: 'Return to Hangout',
    tagline: 'Full-screen participant video & audio grid with lounge atmosphere.',
    icon: <Sparkles size={20} className="text-purple-400" />,
    category: 'Video Lounge',
    accentColor: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30',
  },
];

interface ActivityHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeActivity: ActivityType;
  voteSession: ActivityVoteSession | null;
  participants: Participant[];
  currentParticipantId: string;
  isHost: boolean;
  onSuggestOrVote: (activity: ActivityType) => void;
  onHostLaunch: (activity: ActivityType) => void;
  onHostStartVote: () => void;
  onHostResolveTie: (activity: ActivityType) => void;
  onHostCancelVote: () => void;
}

export const ActivityHubModal: React.FC<ActivityHubModalProps> = ({
  isOpen,
  onClose,
  activeActivity,
  voteSession,
  participants,
  currentParticipantId,
  isHost,
  onSuggestOrVote,
  onHostLaunch,
  onHostStartVote,
  onHostResolveTie,
  onHostCancelVote,
}) => {
  if (!isOpen) return null;

  // Determine which activity the current user has voted for
  let myVotedActivity: ActivityType | null = null;
  if (voteSession?.proposals) {
    for (const [actKey, prop] of Object.entries(voteSession.proposals)) {
      if (prop.voterIds.includes(currentParticipantId)) {
        myVotedActivity = actKey as ActivityType;
        break;
      }
    }
  }

  const isVotingActive = Boolean(voteSession?.isActive);
  const isTied = voteSession?.status === 'tied';

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-hub-title"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 perspective-1000"
    >
      <div className="w-full max-w-3xl bg-[#0f111c] border border-white/15 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200 preserve-3d">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Vote size={20} />
            </div>
            <div>
              <h2 id="activity-hub-title" className="text-lg font-black text-white flex items-center gap-2">
                Activity Hub
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-normal">
                  {participants.length} Friends
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isHost 
                  ? 'As the Host, you can launch activities immediately or start a group vote.' 
                  : 'Suggest activities or cast your vote. The Host controls room-wide launching.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Activity Hub"
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Voting Session Banner if active */}
        {isVotingActive && (
          <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-indigo-900/40 via-violet-900/40 to-indigo-900/40 border border-indigo-500/40 rounded-2xl shrink-0 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-mono font-bold text-xs animate-pulse">
                {voteSession?.timeLeft}s
              </div>
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Vote size={13} className="text-indigo-400" />
                  Room Vote in Progress!
                </p>
                <p className="text-[11px] text-slate-300">
                  Select your favorite activity below. You can change your vote anytime before the timer ends.
                </p>
              </div>
            </div>

            {isHost && (
              <button
                onClick={onHostCancelVote}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] font-semibold cursor-pointer shrink-0"
              >
                Cancel Vote
              </button>
            )}
          </div>
        )}

        {/* Tie-Breaker Banner for Host */}
        {isTied && voteSession?.tiedActivities && voteSession.tiedActivities.length > 0 && (
          <div className="mt-4 p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl shrink-0">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-200">
                  Voting Tied! Host Break the Tie:
                </p>
                <p className="text-[11px] text-amber-300/80 mb-2">
                  The vote resulted in a tie. As Host, choose which tied activity to launch:
                </p>
                <div className="flex flex-wrap gap-2">
                  {voteSession.tiedActivities.map(actKey => {
                    const actDef = ACTIVITIES.find(a => a.id === actKey);
                    return (
                      <button
                        key={actKey}
                        onClick={() => onHostResolveTie(actKey)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                      >
                        <Play size={12} />
                        <span>Launch {actDef?.name}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={onHostStartVote}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Restart Vote</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Cards List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {ACTIVITIES.map((act) => {
            const isActive = activeActivity === act.id;
            const proposal = voteSession?.proposals?.[act.id];
            const voteCount = proposal?.voterIds?.length || 0;
            const hasMyVote = myVotedActivity === act.id;
            const isTiedCandidate = isTied && voteSession?.tiedActivities?.includes(act.id);

            return (
              <div
                key={act.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isActive
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                    : isTiedCandidate
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-white/5 border-white/5 hover:border-white/15'
                }`}
              >
                {/* Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 shrink-0">
                    {act.icon}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="text-sm font-bold text-white truncate">
                        {act.name}
                      </h3>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                          ACTIVE NOW
                        </span>
                      )}
                      {hasMyVote && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold flex items-center gap-1">
                          <Check size={10} />
                          Your Vote
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {act.tagline}
                    </p>

                    {/* Voters list pill */}
                    {voteCount > 0 && proposal?.voterNames && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                          {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[260px]">
                          Voted: {proposal.voterNames.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  {/* Participant Vote Button */}
                  <button
                    type="button"
                    onClick={() => onSuggestOrVote(act.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      hasMyVote
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-white/10 hover:bg-white/20 text-slate-200'
                    }`}
                  >
                    <Vote size={13} />
                    <span>{hasMyVote ? 'Voted' : 'Vote / Suggest'}</span>
                  </button>

                  {/* Host Direct Launch Button */}
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => onHostLaunch(act.id)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <Play size={13} />
                      <span>{isActive ? 'Restart' : 'Launch'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Host Actions */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            {isHost ? (
              <span className="flex items-center gap-1 text-amber-300 font-semibold">
                <Crown size={14} />
                You are Host — your selection synchronizes the entire room.
              </span>
            ) : (
              <span>Your votes will count toward the group selection.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isHost && !isVotingActive && (
              <button
                type="button"
                onClick={onHostStartVote}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Clock size={13} />
                <span>Start 30s Room Vote</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
