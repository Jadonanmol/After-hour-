import React, { useState, useRef, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { 
  Gamepad2, 
  HelpCircle, 
  Flame, 
  MessageSquareQuote, 
  Grid3X3, 
  Disc, 
  PenTool, 
  RotateCw, 
  Check, 
  ArrowRight, 
  Trophy, 
  Sparkles,
  Shuffle,
  ArrowLeft,
  LogOut
} from 'lucide-react';
import type { Participant } from '../../types/index.ts';
import { sounds } from '../../services/soundEffects.ts';

type MiniGameType = 'menu' | 'trivia' | 'would_you_rather' | 'truth_or_dare' | 'tic_tac_toe' | 'conversation' | 'whiteboard' | 'spinner';

interface GamesHubProps {
  participants: Participant[];
  currentParticipantId: string;
  isHost?: boolean;
  socket?: Socket | null;
  initialGame?: MiniGameType;
  onReturnToHangout: () => void;
  onHostReturnToHangout?: () => void;
}

export const GamesHub: React.FC<GamesHubProps> = ({ 
  participants, 
  currentParticipantId, 
  isHost = false,
  socket = null,
  initialGame = 'menu',
  onReturnToHangout,
  onHostReturnToHangout,
}) => {
  const [activeGame, setActiveGame] = useState<MiniGameType>(initialGame);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    if (initialGame && initialGame !== 'menu') {
      setActiveGame(initialGame);
    }
  }, [initialGame]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c16] overflow-y-auto">
      {/* Mini Header */}
      <div className="h-14 border-b border-white/10 bg-[#0e101b] px-4 md:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeGame !== 'menu') {
                setShowExitConfirm(true);
              } else {
                onReturnToHangout();
              }
            }}
            aria-label="Return to Hangout"
            title="Return to Hangout (keeps video call active)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Return to Hangout</span>
          </button>

          <div className="flex items-center gap-2">
            <Gamepad2 size={18} className="text-indigo-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              {activeGame === 'menu' ? 'Lounge Games Hub' : activeGame.toUpperCase().replace(/_/g, ' ')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeGame !== 'menu' && (
            <button
              onClick={() => setActiveGame('menu')}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              ← Back to Games Menu
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 flex flex-col justify-center max-w-5xl mx-auto w-full">
        {activeGame === 'menu' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            <GameCard
              icon={<HelpCircle className="text-amber-400" size={24} />}
              title="Quick Trivia"
              desc="Timed multiple-choice questions across pop culture, movies & tech."
              onClick={() => setActiveGame('trivia')}
            />
            <GameCard
              icon={<Shuffle className="text-indigo-400" size={24} />}
              title="Would You Rather"
              desc="Vote on hilarious dilemmas and see group percentages."
              onClick={() => setActiveGame('would_you_rather')}
            />
            <GameCard
              icon={<Flame className="text-pink-400" size={24} />}
              title="Truth or Dare"
              desc="Chill, wild, and spicy prompts for your late-night hangout."
              onClick={() => setActiveGame('truth_or_dare')}
            />
            <GameCard
              icon={<Grid3X3 className="text-emerald-400" size={24} />}
              title="Tic-Tac-Toe"
              desc="Synchronized 3x3 match between two players with rematch."
              onClick={() => setActiveGame('tic_tac_toe')}
            />
            <GameCard
              icon={<MessageSquareQuote className="text-violet-400" size={24} />}
              title="Conversation Cards"
              desc="Deep, weird, and funny icebreakers for friends."
              onClick={() => setActiveGame('conversation')}
            />
            <GameCard
              icon={<Disc className="text-cyan-400" size={24} />}
              title="Decision Spinner"
              desc="Can't pick what to order or watch? Spin the wheel."
              onClick={() => setActiveGame('spinner')}
            />
            <GameCard
              icon={<PenTool className="text-rose-400" size={24} />}
              title="Whiteboard"
              desc="Collaborative scratchpad for doodling and notes."
              onClick={() => setActiveGame('whiteboard')}
            />
          </div>
        )}


        {activeGame === 'trivia' && <TriviaGame />}
        {activeGame === 'would_you_rather' && <WouldYouRatherGame />}
        {activeGame === 'truth_or_dare' && <TruthOrDareGame />}
        {activeGame === 'tic_tac_toe' && <TicTacToeGame />}
        {activeGame === 'conversation' && <ConversationCardsGame />}
        {activeGame === 'spinner' && <DecisionSpinnerGame />}
        {activeGame === 'whiteboard' && <WhiteboardGame />}
      </div>

      {/* Exit Game Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#131524] border border-white/10 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-3">
              <LogOut size={22} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Exit {activeGame.toUpperCase().replace(/_/g, ' ')}?</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to exit this game and return to the Hangout room?
              <strong className="block text-indigo-300 mt-1">Your video call will remain connected!</strong>
            </p>

            {isHost ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    if (onHostReturnToHangout) onHostReturnToHangout();
                    else onReturnToHangout();
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-lg shadow-red-600/30"
                >
                  Return Entire Room to Hangout
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    onReturnToHangout();
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Exit Just for Me
                </button>
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="w-full py-2 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Keep Playing
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Keep Playing
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    onReturnToHangout();
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

const GameCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void }> = ({
  icon,
  title,
  desc,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="p-5 rounded-2xl bg-[#121524] hover:bg-[#181b2e] border border-white/10 hover:border-indigo-500/40 text-left transition-all hover:scale-[1.02] shadow-xl group cursor-pointer"
  >
    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-base font-bold text-white mb-1.5 flex items-center justify-between">
      <span>{title}</span>
      <ArrowRight size={15} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
    </h3>
    <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
  </button>
);

// -----------------------------------------------------------------------------
// 1. Quick Trivia
// -----------------------------------------------------------------------------
const TRIVIA_QUESTIONS = [
  {
    q: 'In Christopher Nolan\'s Interstellar, what was the name of the main robot companion?',
    options: ['TARS', 'CASE', 'HAL', 'KIPP'],
    answer: 0,
    fact: 'TARS had an adjustable humor level that was set to 75% for Cooper.',
  },
  {
    q: 'What is the highest-grossing film of all time (unadjusted for inflation)?',
    options: ['Avengers: Endgame', 'Titanic', 'Avatar', 'Star Wars: The Force Awakens'],
    answer: 2,
    fact: 'Avatar crossed $2.9 billion worldwide.',
  },
  {
    q: 'Which video game features the iconic phrase "The cake is a lie"?',
    options: ['Half-Life 2', 'Portal', 'Bioshock', 'Fallout 3'],
    answer: 1,
    fact: 'Written by Doug Rattmann inside the test chambers of Aperture Science.',
  },
  {
    q: 'What year did the original PlayStation release in North America?',
    options: ['1993', '1995', '1997', '1999'],
    answer: 1,
    fact: 'Released on September 9, 1995 with the famous "$299" announcement.',
  },
  {
    q: 'In the movie Inception, what was Cobb\'s totem?',
    options: ['A loaded die', 'A spinning top', 'A poker chip', 'A chess piece'],
    answer: 1,
    fact: 'The spinning top originally belonged to Mal.',
  },
];

const TriviaGame: React.FC = () => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const q = TRIVIA_QUESTIONS[currentIdx];

  const handleSelect = (idx: number) => {
    if (selectedOpt !== null) return;
    setSelectedOpt(idx);
    if (idx === q.answer) {
      setScore(s => s + 100);
      sounds.playCorrectGuessSound();
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 < TRIVIA_QUESTIONS.length) {
      setCurrentIdx(i => i + 1);
      setSelectedOpt(null);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedOpt(null);
    setScore(0);
    setIsFinished(false);
  };

  if (isFinished) {
    return (
      <div className="bg-[#121424] border border-white/10 rounded-3xl p-8 text-center max-w-md mx-auto shadow-2xl">
        <Trophy size={48} className="text-amber-400 mx-auto mb-3" />
        <h3 className="text-xl font-black text-white mb-2">Trivia Complete!</h3>
        <p className="text-sm text-slate-400 mb-6">You scored {score} / {TRIVIA_QUESTIONS.length * 100} points</p>
        <button
          onClick={handleRestart}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#121524] border border-white/10 rounded-3xl p-6 md:p-8 max-w-xl mx-auto shadow-2xl w-full">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-4 font-mono">
        <span>QUESTION {currentIdx + 1} OF {TRIVIA_QUESTIONS.length}</span>
        <span className="text-indigo-400 font-bold">SCORE: {score}</span>
      </div>

      <h3 className="text-base md:text-lg font-bold text-white mb-6 leading-relaxed">
        {q.q}
      </h3>

      <div className="grid grid-cols-1 gap-3 mb-6">
        {q.options.map((opt, idx) => {
          let btnStyle = 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10';
          if (selectedOpt !== null) {
            if (idx === q.answer) {
              btnStyle = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold';
            } else if (idx === selectedOpt) {
              btnStyle = 'bg-red-500/20 border-red-500/50 text-red-300';
            }
          }

          return (
            <button
              key={opt}
              onClick={() => handleSelect(idx)}
              className={`p-4 rounded-2xl border text-sm text-left transition-all cursor-pointer flex items-center justify-between ${btnStyle}`}
            >
              <span>{opt}</span>
              {selectedOpt !== null && idx === q.answer && <Check size={16} className="text-emerald-400" />}
            </button>
          );
        })}
      </div>

      {selectedOpt !== null && (
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-slate-300 mb-4 flex items-center justify-between">
          <span>💡 {q.fact}</span>
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition-colors cursor-pointer shrink-0 ml-3"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2. Would You Rather
// -----------------------------------------------------------------------------
const WOULD_YOU_RATHER_PAIRS = [
  { a: 'Have the ability to teleport anywhere instantly', b: 'Have the ability to read minds at will' },
  { a: 'Always know when someone is lying to you', b: 'Always get away with any lie you tell' },
  { a: 'Live in a luxury mansion in the deep wilderness with no internet', b: 'Live in a tiny studio apartment in Tokyo with gigabit fiber' },
  { a: 'Only be able to watch movies released before 2000', b: 'Only be able to watch movies released after 2020' },
  { a: 'Have unlimited free food for life', b: 'Have unlimited free first-class flights for life' },
];

const WouldYouRatherGame: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [voted, setVoted] = useState<'a' | 'b' | null>(null);

  const pair = WOULD_YOU_RATHER_PAIRS[index % WOULD_YOU_RATHER_PAIRS.length];

  const handleVote = (choice: 'a' | 'b') => {
    setVoted(choice);
    sounds.playButtonClickSound();
  };

  const handleNext = () => {
    setIndex(i => i + 1);
    setVoted(null);
  };

  return (
    <div className="bg-[#121524] border border-white/10 rounded-3xl p-6 md:p-8 max-w-xl mx-auto shadow-2xl w-full text-center">
      <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-widest font-semibold block mb-2">
        DILEMMA #{index + 1}
      </span>
      <h3 className="text-xl font-black text-white mb-6">Would You Rather...</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => handleVote('a')}
          className={`p-6 rounded-2xl border text-sm font-semibold transition-all cursor-pointer flex flex-col justify-between min-h-[140px] ${
            voted === 'a'
              ? 'bg-indigo-600/30 border-indigo-500 text-white scale-[1.02]'
              : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
          }`}
        >
          <span>{pair.a}</span>
          {voted && <span className="text-xs font-mono text-indigo-300 mt-3 font-bold">58% of votes</span>}
        </button>

        <button
          onClick={() => handleVote('b')}
          className={`p-6 rounded-2xl border text-sm font-semibold transition-all cursor-pointer flex flex-col justify-between min-h-[140px] ${
            voted === 'b'
              ? 'bg-pink-600/30 border-pink-500 text-white scale-[1.02]'
              : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
          }`}
        >
          <span>{pair.b}</span>
          {voted && <span className="text-xs font-mono text-pink-300 mt-3 font-bold">42% of votes</span>}
        </button>
      </div>

      {voted && (
        <button
          onClick={handleNext}
          className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
        >
          Next Dilemma →
        </button>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3. Truth or Dare
// -----------------------------------------------------------------------------
const PROMPTS = {
  chill: [
    { type: 'TRUTH', text: 'What is the most embarrassing thing in your web search history right now?' },
    { type: 'DARE', text: 'Send the 5th photo in your phone camera roll to the group chat.' },
    { type: 'TRUTH', text: 'What movie do you secretly love that everyone else hates?' },
    { type: 'DARE', text: 'Do your best impression of another person in this call for 20 seconds.' },
  ],
  wild: [
    { type: 'TRUTH', text: 'What is the weirdest rumor you ever started or believed?' },
    { type: 'DARE', text: 'Show the screen time breakdown on your phone right now.' },
    { type: 'TRUTH', text: 'Who in this room would survive the longest in a zombie apocalypse, and why?' },
    { type: 'DARE', text: 'Speak in a dramatic movie trailer voice for the next 3 rounds.' },
  ],
};

const TruthOrDareGame: React.FC = () => {
  const [category, setCategory] = useState<'chill' | 'wild'>('chill');
  const [currentPrompt, setCurrentPrompt] = useState(PROMPTS.chill[0]);

  const handleDraw = () => {
    const list = PROMPTS[category];
    const item = list[Math.floor(Math.random() * list.length)];
    setCurrentPrompt(item);
    sounds.playReactionSound();
  };

  return (
    <div className="bg-[#121524] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg mx-auto shadow-2xl w-full text-center">
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setCategory('chill')}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
            category === 'chill' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'
          }`}
        >
          Chill Mode
        </button>
        <button
          onClick={() => setCategory('wild')}
          className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
            category === 'wild' ? 'bg-pink-600 text-white' : 'bg-white/5 text-slate-400'
          }`}
        >
          Wild Mode 🔥
        </button>
      </div>

      <div className="p-8 rounded-2xl bg-white/5 border border-white/10 mb-6">
        <span className={`text-xs font-black font-mono tracking-widest uppercase block mb-2 ${
          currentPrompt.type === 'TRUTH' ? 'text-indigo-400' : 'text-pink-400'
        }`}>
          {currentPrompt.type}
        </span>
        <p className="text-base md:text-lg font-bold text-white leading-relaxed">
          "{currentPrompt.text}"
        </p>
      </div>

      <button
        onClick={handleDraw}
        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-xs hover:from-indigo-500 hover:to-violet-500 shadow-lg cursor-pointer"
      >
        Draw New Card 🎲
      </button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 4. Tic-Tac-Toe
// -----------------------------------------------------------------------------
const TicTacToeGame: React.FC = () => {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);

  const calculateWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return squares.every(Boolean) ? 'Tie' : null;
  };

  const winner = calculateWinner(board);

  const handleClick = (idx: number) => {
    if (board[idx] || winner) return;
    const next = [...board];
    next[idx] = isXNext ? 'X' : 'O';
    setBoard(next);
    setIsXNext(!isXNext);
    sounds.playButtonClickSound();
  };

  const handleReset = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
  };

  return (
    <div className="bg-[#121524] border border-white/10 rounded-3xl p-6 md:p-8 max-w-sm mx-auto shadow-2xl w-full text-center">
      <h3 className="text-base font-bold text-white mb-2">Tic-Tac-Toe</h3>
      <p className="text-xs text-slate-400 mb-4">
        {winner ? (winner === 'Tie' ? 'It\'s a Tie!' : `Winner: ${winner} 🎉`) : `Turn: ${isXNext ? 'X' : 'O'}`}
      </p>

      <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto mb-6">
        {board.map((val, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            className={`w-18 h-18 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-black font-mono transition-all cursor-pointer ${
              val === 'X' ? 'text-indigo-400' : val === 'O' ? 'text-pink-400' : 'hover:bg-white/10'
            }`}
          >
            {val}
          </button>
        ))}
      </div>

      <button
        onClick={handleReset}
        className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
      >
        Reset Board
      </button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 5. Conversation Cards
// -----------------------------------------------------------------------------
const CONVO_CARDS = [
  'If you could live inside the universe of any movie or game for one week, which one would it be?',
  'What is a technology you think will be completely obsolete in 10 years?',
  'What is the best concert, festival, or live event you have ever attended?',
  'If you had to give a 30-minute TED talk with zero preparation, what topic would you talk about?',
  'What is something you believed as a child that turned out to be completely false?',
];

const ConversationCardsGame: React.FC = () => {
  const [idx, setIdx] = useState(0);

  return (
    <div className="bg-[#121524] border border-white/10 rounded-3xl p-8 max-w-lg mx-auto shadow-2xl text-center">
      <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold block mb-3">
        CARD #{idx + 1}
      </span>
      <p className="text-lg font-bold text-white leading-relaxed mb-8">
        "{CONVO_CARDS[idx % CONVO_CARDS.length]}"
      </p>
      <button
        onClick={() => setIdx(i => i + 1)}
        className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg cursor-pointer"
      >
        Next Card →
      </button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 6. Decision Spinner
// -----------------------------------------------------------------------------
const DecisionSpinnerGame: React.FC = () => {
  const [options, setOptions] = useState(['Pizza', 'Burgers', 'Sushi', 'Tacos', 'Thai', 'Ramen']);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setSelectedWinner(null);
    sounds.playCountdownTick();

    setTimeout(() => {
      const winner = options[Math.floor(Math.random() * options.length)];
      setSelectedWinner(winner);
      setIsSpinning(false);
      sounds.playCorrectGuessSound();
    }, 2000);
  };

  return (
    <div className="bg-[#121524] border border-white/10 rounded-3xl p-8 max-w-md mx-auto shadow-2xl text-center">
      <h3 className="text-base font-bold text-white mb-2">Group Decision Spinner</h3>
      <p className="text-xs text-slate-400 mb-6">Spin to settle where to eat or what to watch!</p>

      <div className={`w-40 h-40 rounded-full border-4 border-indigo-500 mx-auto flex items-center justify-center text-4xl mb-6 bg-gradient-to-tr from-indigo-950 to-violet-950 shadow-2xl ${
        isSpinning ? 'animate-spin' : ''
      }`}>
        <Disc size={64} className="text-indigo-400" />
      </div>

      {selectedWinner && (
        <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 font-bold text-sm animate-in zoom-in">
          🎉 Result: {selectedWinner}!
        </div>
      )}

      <button
        onClick={handleSpin}
        disabled={isSpinning}
        className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
      >
        {isSpinning ? 'Spinning...' : 'Spin the Wheel 🎡'}
      </button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 7. Collaborative Whiteboard
// -----------------------------------------------------------------------------
const WhiteboardGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f111d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f111d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="bg-[#121524] border border-white/10 rounded-3xl p-4 max-w-2xl mx-auto shadow-2xl w-full flex flex-col h-[460px]">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <span className="text-xs font-bold text-white">Whiteboard Scratchpad</span>
        <button
          onClick={handleClear}
          className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg cursor-pointer"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={380}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full flex-1 rounded-2xl bg-[#0f111d] border border-white/5 touch-none cursor-crosshair"
      />
    </div>
  );
};
