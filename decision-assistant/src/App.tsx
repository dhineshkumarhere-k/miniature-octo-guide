/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  BrainCircuit, 
  Scale, 
  Star, 
  AlertCircle,
  Lightbulb,
  BarChart3,
  Dna,
  Shuffle,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { getDecisionInsights, getSuggestedFactors, getCommunityWisdom, type DecisionData } from './lib/gemini';

// --- Types ---
interface Option {
  id: string;
  name: string;
}

interface Factor {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

type Ratings = Record<string, Record<string, number>>; // optionId -> factorId -> rating

// --- Constants ---
const STAGES = [
  'Define',
  'Options',
  'Decision Matrix',
  'Insights'
];

const COMMON_FACTORS = [
  'Salary / Income',
  'Growth Potential',
  'Work-Life Balance',
  'Location',
  'Stability',
  'Social Impact',
  'Stress Level',
  'Culture / Fit'
];

export default function App() {
  const [step, setStep] = useState(0);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [options, setOptions] = useState<Option[]>([
    { id: '1', name: '' },
    { id: '2', name: '' }
  ]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [ratings, setRatings] = useState<Ratings>({});
  
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [redditData, setRedditData] = useState<{ summary: string, discussions: any[] } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [loadingReddit, setLoadingReddit] = useState(false);

  // --- Derived Data ---
  const scores = useMemo(() => {
    const res: Record<string, number> = {};
    options.forEach(opt => {
      let total = 0;
      factors.forEach(f => {
        const rating = ratings[opt.id]?.[f.id] || 0;
        total += rating * f.weight;
      });
      res[opt.id] = total;
    });
    return res;
  }, [options, factors, ratings]);

  const winningOption = useMemo(() => {
    let max = -1;
    let winner = null;
    let isDraw = false;

    Object.entries(scores).forEach(([id, score]) => {
      const s = score as number;
      if (s > max) {
        max = s;
        winner = id;
        isDraw = false;
      } else if (s === max && max > 0) {
        isDraw = true;
      }
    });

    return { id: winner, isDraw };
  }, [scores]);

  const chartData = useMemo(() => {
    return factors.map(f => {
      const entry: any = { factor: f.name, fullMark: 5 };
      options.forEach(o => {
        entry[o.name] = ratings[o.id]?.[f.id] || 0;
      });
      return entry;
    });
  }, [factors, options, ratings]);

  const barChartData = useMemo(() => {
    return options.map(o => ({
      name: o.name || 'Untitled',
      score: scores[o.id]
    }));
  }, [options, scores]);

  // --- Actions ---
  const handleNext = async () => {
    if (step === 1 && factors.length === 0) {
      // Transitioning to Factors stage - suggest factors if currently empty
      suggestFactors();
    }
    setStep(s => Math.min(s + 1, STAGES.length - 1));
  };

  const suggestFactors = async () => {
    setLoadingFactors(true);
    try {
      const suggested = await getSuggestedFactors(
        decisionTitle, 
        options.map(o => o.name).filter(n => n.trim() !== '')
      );
      if (suggested && suggested.length > 0) {
        setFactors(suggested.map((f: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: f.name,
          weight: f.weight,
          description: f.description
        })));
      }
    } catch (err) {
      console.error("Failed to suggest factors", err);
    } finally {
      setLoadingFactors(false);
    }
  };
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const resetDecision = () => {
    setStep(0);
    setDecisionTitle('');
    setOptions([
      { id: '1', name: '' },
      { id: '2', name: '' }
    ]);
    setFactors([]);
    setRatings({});
    setAiInsights(null);
    setRedditData(null);
  };

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, { id: Math.random().toString(36).substr(2, 9), name: '' }]);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter(o => o.id !== id));
    }
  };

  const addFactor = (name = '', description = '') => {
    setFactors([...factors, { id: Math.random().toString(36).substr(2, 9), name, weight: 3, description }]);
  };

  const removeFactor = (id: string) => {
    if (factors.length > 1) {
      setFactors(factors.filter(f => f.id !== id));
    }
  };

  const updateRating = (optionId: string, factorId: string, value: number) => {
    setRatings(prev => ({
      ...prev,
      [optionId]: {
        ...(prev[optionId] || {}),
        [factorId]: value
      }
    }));
  };

  useEffect(() => {
    if (step === 3 && !aiInsights && !loadingInsights) {
      const data: DecisionData = {
        title: decisionTitle,
        options,
        factors,
        ratings,
        scores
      };
      setLoadingInsights(true);
      setLoadingReddit(true);
      
      getDecisionInsights(data).then(res => {
        setAiInsights(res);
        setLoadingInsights(false);
      });

      getCommunityWisdom(decisionTitle).then(res => {
        setRedditData(res);
        setLoadingReddit(false);
      });
    }
  }, [step, decisionTitle, options, factors, ratings, scores, aiInsights, loadingInsights]);

  // --- Render Helpers ---
  const isStepValid = () => {
    if (step === 0) return decisionTitle.trim().length > 0;
    if (step === 1) return options.every(o => o.name.trim().length > 0) && options.length >= 2;
    if (step === 2) {
      const factorsFilled = factors.every(f => f.name.trim().length > 0) && factors.length >= 1;
      const ratingsFilled = options.every(o => factors.every(f => (ratings[o.id]?.[f.id] || 0) > 0));
      return factorsFilled && ratingsFilled;
    }
    return true;
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Sleek Header */}
      <header className="h-[72px] bg-white border-b border-border-main px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 font-extrabold text-xl text-brand-primary">
          <BrainCircuit size={24} strokeWidth={3} />
          <span>DecisionAssistant</span>
        </div>
        
        <div className="hidden md:flex gap-8 text-sm font-semibold text-text-sub">
          {STAGES.map((label, idx) => (
            <span 
              key={label} 
              className={`transition-colors cursor-default ${step === idx ? 'step-active-tab' : step > idx ? 'text-brand-primary/60' : ''}`}
            >
              {idx + 1}. {label}
            </span>
          ))}
        </div>
        
        <div className="w-40 hidden sm:block"></div>
      </header>

      <main className="flex-grow flex flex-col items-center py-8 px-4 sm:py-12">
        {/* Main Content Area */}
        <div className={`w-full ${step === 3 ? 'max-w-6xl px-4' : 'max-w-3xl'} flex flex-col`}>
          
          <AnimatePresence mode="wait">
            {step < 3 ? (
              <motion.div
                key="input-steps"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="sleek-card overflow-hidden min-h-[500px] flex flex-col"
              >
                <div className="p-4 sm:p-10 flex-grow">
                  {/* Step headers match the "decision-header" class from theme */}
                  <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-text-main mb-1">
                      {step === 0 && "What decision are you making?"}
                      {step === 1 && "What are your options?"}
                      {step === 2 && "Score Matrix"}
                    </h1>
                    <p className="text-text-sub">
                      {step === 0 && "State your choice clearly to keep it as your north star."}
                      {step === 1 && "Add the competing paths you're considering."}
                      {step === 2 && "Assign importance and rate your options for each factor."}
                    </p>
                  </div>

                  {step === 0 && (
                    <div className="space-y-6">
                      <div className="relative group flex flex-col items-end">
                        <textarea
                          value={decisionTitle}
                          onChange={e => setDecisionTitle(e.target.value.slice(0, 1000))}
                          placeholder="e.g. Job Switch: GlobalTech vs. Stay at Current. Details about why this is a tough choice..."
                          className="w-full bg-slate-50 border border-border-main rounded-xl py-5 px-6 text-xl min-h-[160px] resize-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all placeholder:text-slate-300"
                          autoFocus
                          maxLength={1000}
                        />
                        <span className="mt-2 text-[10px] font-bold text-text-sub uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                          {decisionTitle.length} / 1000
                        </span>
                      </div>
                      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex gap-4">
                        <div className="text-blue-500 shrink-0 mt-1">
                          <BrainCircuit size={20} />
                        </div>
                        <p className="text-blue-900 text-sm leading-relaxed">
                          <strong>Pro tip:</strong> Frame your decision with the core dilemma. This focus makes comparison much easier.
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div className="space-y-4">
                      {options.map((opt, idx) => (
                        <div key={opt.id} className="flex gap-3">
                          <div className="flex-grow relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-text-sub/40 font-mono text-[10px] uppercase tracking-widest font-bold">
                              Opt {String.fromCharCode(65 + idx)}
                            </span>
                            <input
                              type="text"
                              value={opt.name}
                              onChange={e => {
                                const newOptions = [...options];
                                newOptions[idx].name = e.target.value;
                                setOptions(newOptions);
                              }}
                              placeholder={`Enter option ${idx + 1}...`}
                              className="w-full bg-slate-50 border border-border-main rounded-xl py-4 pl-24 pr-6 focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all"
                              autoFocus={idx === options.length - 1}
                            />
                          </div>
                          {options.length > 2 && (
                            <button 
                              onClick={() => removeOption(opt.id)}
                              className="shrink-0 p-4 text-text-sub/50 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      ))}
                      {options.length < 5 && (
                        <button 
                          onClick={addOption}
                          className="w-full py-4 border-2 border-dashed border-border-main rounded-xl text-text-sub/60 hover:text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 transition-all font-semibold flex items-center justify-center gap-2 group"
                        >
                          <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                          Add another option
                        </button>
                      )}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${loadingFactors ? 'bg-blue-200 animate-pulse' : 'bg-blue-100'} text-blue-600`}>
                            <BrainCircuit size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">AI Suggestions</p>
                            <p className="text-[11px] text-blue-700 font-medium">Criteria tailored to your decision</p>
                          </div>
                        </div>
                        <button 
                          onClick={suggestFactors}
                          disabled={loadingFactors}
                          className="px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50"
                        >
                          {loadingFactors ? "Generating..." : "Regenerate"}
                        </button>
                      </div>

                      <div className="space-y-4">
                        {loadingFactors && factors.length === 0 && (
                          <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="bg-slate-50 p-6 rounded-xl border border-border-main space-y-4 animate-pulse">
                                <div className="h-6 bg-slate-200 rounded w-1/3" />
                                <div className="flex items-center gap-4">
                                  <div className="h-2 bg-slate-200 rounded flex-grow" />
                                  <div className="h-6 bg-slate-200 rounded w-8" />
                                </div>
                              </div>
                            ))}
                            <p className="text-center text-[11px] text-text-sub font-bold uppercase tracking-widest py-4">Tailoring criteria to your choices...</p>
                          </div>
                        )}

                        {!loadingFactors && factors.length === 0 && (
                          <div className="text-center py-12 border-2 border-dashed border-border-main rounded-xl">
                            <p className="text-text-sub text-sm font-medium mb-4">No factors added yet.</p>
                            <button 
                              onClick={suggestFactors}
                              className="px-6 py-2 bg-brand-primary text-white rounded-lg font-bold text-xs shadow-lg shadow-brand-primary/20"
                            >
                              Explore AI Suggestions
                            </button>
                          </div>
                        )}

                        {factors.map((f, idx) => (
                          <div key={f.id} className="bg-slate-50 p-6 rounded-xl border border-border-main space-y-6">
                            <div className="flex gap-4 justify-between items-start">
                              <div className="flex-grow space-y-1">
                                <input
                                  type="text"
                                  value={f.name}
                                  onChange={e => {
                                    const newFactors = [...factors];
                                    newFactors[idx].name = e.target.value;
                                    setFactors(newFactors);
                                  }}
                                  placeholder="Factor name..."
                                  className="w-full bg-transparent font-bold text-lg text-text-main focus:outline-none placeholder:text-text-sub/30"
                                />
                                  <textarea
                                    value={f.description || ''}
                                    onChange={e => {
                                      const newFactors = [...factors];
                                      newFactors[idx].description = e.target.value;
                                      setFactors(newFactors);
                                    }}
                                    placeholder="Brief explanation of this factor..."
                                    className="w-full bg-transparent text-[11px] text-text-sub leading-tight font-medium focus:outline-none resize-none placeholder:text-text-sub/20"
                                    rows={1}
                                  />
                              </div>
                              <button 
                                onClick={() => removeFactor(f.id)}
                                className="text-text-sub/30 hover:text-red-500 transition-colors pt-1"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-4 py-2 border-y border-slate-200/50">
                              <span className="text-[10px] font-extrabold text-text-sub uppercase tracking-wider w-24 shrink-0">Importance</span>
                              <input 
                                type="range"
                                min="1"
                                max="5"
                                value={f.weight}
                                onChange={e => {
                                  const newFactors = [...factors];
                                  newFactors[idx].weight = parseInt(e.target.value);
                                  setFactors(newFactors);
                                }}
                                className="flex-grow h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                              />
                              <span className="score-pill">x{f.weight}</span>
                            </div>

                            <div className="space-y-4">
                              <span className="text-[10px] font-extrabold text-text-sub uppercase tracking-wider block">Rate Options</span>
                              <div className="grid gap-4 sm:grid-cols-2">
                                {options.map(opt => (
                                  <div key={opt.id} className="bg-white p-3 rounded-xl border border-border-main flex items-center justify-between gap-3">
                                    <span className="text-xs font-bold text-text-main truncate max-w-[100px]">{opt.name}</span>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map(val => {
                                        const isActive = (ratings[opt.id]?.[f.id] || 0) === val;
                                        return (
                                          <button
                                            key={val}
                                            onClick={() => updateRating(opt.id, f.id, val)}
                                            className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                                              isActive 
                                                ? 'bg-brand-primary text-white scale-110 shadow-sm'
                                                : 'bg-slate-50 text-text-sub hover:bg-slate-100'
                                            }`}
                                          >
                                            {val}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <button 
                          onClick={() => addFactor()}
                          className="w-full py-4 border-2 border-dashed border-border-main rounded-xl text-text-sub/60 hover:text-brand-primary hover:border-brand-primary transition-all font-semibold flex items-center justify-center gap-2"
                        >
                          <Plus size={18} />
                          Custom Factor
                        </button>

                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Nav inside Card for steps */}
                <div className="p-8 border-t border-border-main bg-slate-50/50 flex justify-between items-center gap-4 mt-auto">
                  <button
                    onClick={handleBack}
                    disabled={step === 0}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                      step === 0 
                        ? 'opacity-0 pointer-events-none' 
                        : 'text-text-sub hover:text-text-main hover:bg-white border border-transparent hover:border-border-main shadow-sm'
                    }`}
                  >
                    <ArrowLeft size={18} />
                    Back
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={!isStepValid()}
                    className={`flex items-center gap-3 px-10 py-4 rounded-xl font-bold transition-all ${
                      isStepValid()
                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:translate-y-[-2px] active:translate-y-0'
                        : 'bg-slate-200 text-text-sub/40 cursor-not-allowed'
                    }`}
                  >
                    {step === 2 ? "Generate Results" : "Next Step"}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Step 3: Results Dashboard with Centered Prominence */
              <motion.div
                key="step3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8 pb-24"
              >
                {/* Header & Main Recommendation - Horizontal 2:1 Split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  {/* Decision Title - 2/3 width */}
                  <div className="lg:col-span-2 text-left space-y-2">
                    <div className="flex items-center gap-3 text-text-sub/50 mb-1">
                      <div className="h-px w-8 bg-slate-200" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Active Decision</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-text-main leading-tight">
                      {decisionTitle}
                    </h1>
                  </div>

                  {/* Recommendation Hero - 1/3 width, Compact Tile */}
                  <div className="lg:col-span-1">
                    <div className="bg-brand-primary rounded-2xl p-5 text-white shadow-xl shadow-brand-primary/20 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <Scale size={48} />
                      </div>
                      <div className="relative z-10 space-y-3">
                        <div className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80 bg-white/10 px-2 py-0.5 rounded-full inline-block">Best Path</div>
                        <div className="flex items-end justify-between gap-4">
                          <div className="text-lg font-black leading-tight truncate">
                            {winningOption.id ? (winningOption.isDraw ? "It's a Tie!" : options.find(o => o.id === winningOption.id)?.name) : "N/A"}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-3xl font-black leading-none">
                              {Math.max(...(Object.values(scores) as number[]).concat(0))}
                            </div>
                            <div className="text-[7px] opacity-60 font-bold uppercase tracking-widest mt-1">Score</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Core Advice Grid - Should now be mostly visible in viewport */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* AI Strategy Advisor */}
                  <div className="ai-container space-y-6 shadow-sm flex flex-col h-full lg:col-span-1">
                    <div className="flex items-center gap-2 font-bold text-blue-800 text-sm tracking-wide border-b border-blue-100 pb-3">
                      <BrainCircuit size={18} />
                      AI Strategy Advisor
                    </div>

                    {loadingInsights ? (
                      <div className="py-8 space-y-4">
                        <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-blue-500 w-1/3"
                            animate={{ x: ['0%', '200%', '0%'] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          />
                        </div>
                        <p className="text-[13px] text-blue-800 animate-pulse text-center font-medium">Synthesizing data points...</p>
                      </div>
                    ) : aiInsights ? (
                      <div className="space-y-6 flex-grow">
                        <p className="text-sm italic leading-relaxed font-semibold text-blue-900/80">
                          "{aiInsights.summary}"
                        </p>
                        <ul className="space-y-4 text-[13px] font-medium">
                          {aiInsights.tradeOffs.slice(0, 2).map((t: string, i: number) => (
                            <li key={i} className="flex gap-3">
                              <span className="text-blue-500 font-bold">→</span>
                              <span className="leading-tight text-slate-700"><strong>Trade-off:</strong> {t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  {/* Community Wisdom */}
                  <div className="sleek-card border-slate-200 shadow-sm overflow-hidden flex flex-col h-full lg:col-span-1">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={16} className="text-orange-500" />
                        <span className="text-sm font-bold text-slate-800">Community Wisdom</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">r/Reddit</span>
                    </div>
                    <div className="p-6 space-y-4 flex-grow">
                      {loadingReddit ? (
                        <div className="space-y-3 py-2">
                          <div className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                          {[1, 2].map(i => (
                            <div key={i} className="h-8 bg-slate-50 rounded-lg animate-pulse" />
                          ))}
                        </div>
                      ) : redditData ? (
                        <div className="space-y-5">
                          <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50">
                            <p className="text-[12px] text-orange-900 leading-relaxed font-semibold">
                              {redditData.summary}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[9px] text-text-sub font-black uppercase tracking-widest mb-2 px-1">Deep Dive Discussions</p>
                            <div className="space-y-2">
                              {redditData.discussions.slice(0, 3).map((link, i) => (
                                <a 
                                  key={i}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl text-[12px] font-semibold text-text-main hover:border-orange-200 hover:bg-orange-50/10 transition-all group"
                                >
                                  <span className="truncate pr-2">{link.label}</span>
                                  <ExternalLink size={14} className="shrink-0 text-slate-300 group-hover:text-orange-500 transition-colors" />
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-text-sub font-medium italic">Searching Reddit archives...</p>
                      )}
                    </div>
                  </div>

                  {/* Quick Reflection & Actions */}
                  <div className="flex flex-col gap-6 lg:col-span-1">
                    <div className="sleek-card shadow-sm h-full flex flex-col">
                      <div className="p-6 border-b border-slate-50 flex items-center gap-2">
                        <Lightbulb size={18} className="text-amber-500" />
                        <h4 className="font-bold text-sm">Quick Reflection</h4>
                      </div>
                      <div className="p-6 flex-grow flex flex-col justify-between space-y-6">
                        <p className="text-sm text-text-sub leading-relaxed font-medium">
                          Does this winner feel intuitive? Sometimes your subconscious weights factors differently than your logical matrix. Listen to that nudge.
                        </p>
                        <div className="space-y-3">
                          <button 
                            onClick={() => { setStep(0); setAiInsights(null); }}
                            className="w-full py-4 bg-white border border-border-main rounded-xl text-text-main font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm border-dashed"
                          >
                            <Plus size={16} /> Edit Data
                          </button>
                          <button 
                            onClick={resetDecision}
                            className="w-full py-4 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-slate-200"
                          >
                            <Shuffle size={16} /> New Decision
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secondary Data Section - Visual Comparison */}
                <div className="space-y-8 pt-12 border-t border-slate-200">
                  <div className="flex items-center gap-4">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-sub shrink-0 px-4 py-1.5 bg-slate-100 rounded-full">Supporting Data</h2>
                    <div className="h-px bg-slate-100 flex-grow" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Detailed Factor Table */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-2">
                        <BarChart3 size={16} className="text-text-sub" />
                        <h3 className="font-bold text-sm text-text-main">Factor Score Comparison</h3>
                      </div>
                      <div className="sleek-card p-0 overflow-hidden border-slate-200 shadow-sm">
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] p-5 border-b border-border-main bg-slate-50 text-[10px] font-extrabold uppercase tracking-widest text-text-sub/70">
                          <span>Decision Factor</span>
                          <span>Wt</span>
                          {options.slice(0, 2).map(o => (
                            <span key={o.id} className="text-center truncate">{o.name}</span>
                          ))}
                        </div>

                        <div className="divide-y divide-slate-100">
                          {factors.map((f) => (
                            <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] p-5 items-center hover:bg-slate-50/50 transition-colors">
                              <div className="flex flex-col">
                                <span className="font-bold text-[13px] text-text-main truncate">{f.name}</span>
                                <span className="text-[10px] text-text-sub font-medium opacity-60">Priority: {f.weight}</span>
                              </div>
                              <div><span className="text-[11px] font-bold text-text-sub bg-slate-100 px-2 py-0.5 rounded">x{f.weight}</span></div>
                              {options.slice(0, 2).map(o => {
                                const val = ratings[o.id]?.[f.id] || 0;
                                return (
                                  <div key={o.id} className="flex justify-center">
                                    <div className={`rating-chip scale-90 ${val >= 4 ? 'rating-high' : val >= 3 ? 'rating-mid' : 'rating-low'}`}>
                                      {val}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Radar Visual */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-2">
                        <Dna size={16} className="text-text-sub" />
                        <h3 className="font-bold text-sm text-text-main">Value DNA Visualization</h3>
                      </div>
                      <div className="sleek-card h-[380px] border-slate-200 shadow-sm flex items-center justify-center p-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="factor" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 5]} hide />
                            {options.map((opt, i) => (
                              <Radar
                                key={opt.id}
                                name={opt.name}
                                dataKey={opt.name}
                                stroke={['#6366f1', '#10b981', '#f59e0b', '#ef4444'][i % 4]}
                                fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444'][i % 4]}
                                fillOpacity={0.2}
                              />
                            ))}
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '10px 10px 20px -5px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="mt-auto px-8 py-6 border-t border-border-main flex flex-col sm:flex-row justify-between items-center text-text-sub text-[10px] font-extrabold uppercase tracking-[0.1em] gap-4">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 grayscale opacity-50">
              <BrainCircuit size={14} />
              <span>Decision Logic v2.4</span>
            </div>
            <div className="flex items-center gap-1.5 grayscale opacity-50">
              <Scale size={14} />
              <span>Weighted Sum Model</span>
            </div>
        </div>
        <p>© 2026 Decision Assistant • Built for Clarity</p>
      </footer>
    </div>
  );
}

