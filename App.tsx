
import React, { useState, useMemo, useEffect } from 'react';
import { AppStep, ImageFile, Garment, Background, TryOnResult, SelectionMode } from './types';
import { SAMPLE_GARMENTS, SAMPLE_BACKGROUNDS } from './constants';
import { performVirtualTryOn, performCustomTryOn, fetchImageAsImageFile, generate360Video } from './services/geminiService';
import QRScanner from './components/QRScanner';

const SUGGESTIONS = [
  "Avant-garde silver metallic trench coat",
  "Minimalist off-white linen co-ord set",
  "Cyberpunk techwear vest with neon strips",
  "Luxury midnight velvet evening jacket"
];

const COLORS = [
  { name: 'None', hex: 'transparent' },
  { name: 'Obsidian Black', hex: '#000000' },
  { name: 'Alabaster White', hex: '#F2F2F2' },
  { name: 'Bordeaux Red', hex: '#6D0E0E' },
  { name: 'Cobalt Blue', hex: '#0047AB' },
  { name: 'Sage Green', hex: '#9CA986' },
  { name: 'Champagne Gold', hex: '#F1E5AC' }
];

const CATEGORIES: (Garment['category'] | 'All')[] = ['All', 'Traditional', 'Underwear', 'Top', 'Bottom', 'Dress', 'Outerwear', 'Shoes', 'Accessory', 'Companion'];

// Fix: Removed local declarations of 'aistudio' and 'AIStudio' to avoid conflicts with global definitions.
// Property 'aistudio' is assumed to be pre-configured and accessible on window.

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD_PERSON);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('collection');
  const [activeCategory, setActiveCategory] = useState<(Garment['category'] | 'All')>('All');
  
  const [personImage, setPersonImage] = useState<ImageFile | null>(null);
  const [selectedGarments, setSelectedGarments] = useState<Garment[]>([]);
  const [uploadedGarments, setUploadedGarments] = useState<ImageFile[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<Background | null>(null);
  const [uploadedBackground, setUploadedBackground] = useState<ImageFile | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const [customPrompt, setCustomPrompt] = useState("");
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSampleTags, setShowSampleTags] = useState(false);
  const [showMobileSync, setShowMobileSync] = useState(false);
  const [stylistInsight, setStylistInsight] = useState("Your canvas is ready. Select a base piece to begin the story.");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const filteredGarments = useMemo(() => {
    if (activeCategory === 'All') return SAMPLE_GARMENTS;
    return SAMPLE_GARMENTS.filter(g => g.category === activeCategory);
  }, [activeCategory]);

  const totalSelected = selectedGarments.length + uploadedGarments.length + (customPrompt.trim() && selectionMode === 'custom' ? 1 : 0);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  useEffect(() => {
    if (totalSelected === 0) {
      setStylistInsight("Your canvas is ready. Select a base piece to begin the story.");
      return;
    }
    const vibes = [
      "The silhouette is taking shape. Consider adding a companion or accessory to balance the weight.",
      "A bold choice. The textures you've selected suggest a refined, editorial aesthetic.",
      "Proportions look perfect. That layering will catch the light beautifully in the render.",
      "Sophisticated. This combination challenges traditional forms in the best way possible.",
      "This look is speaking. It's giving high-fashion minimalism with a sharp edge."
    ];
    setStylistInsight(vibes[Math.min(totalSelected, vibes.length - 1)]);
  }, [totalSelected]);

  const installApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const shareData = {
      title: 'My StyleAI Editorial Look',
      text: `Check out this AI-generated outfit I created in StyleAI Virtual Studio! ${result.advice}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setSuccessMessage("Shared successfully!");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setSuccessMessage("Link copied to clipboard!");
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'person' | 'garment' | 'background') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = (reader.result as string).split(',')[1];
        const imgFile = {
          data,
          mimeType: file.type,
          preview: reader.result as string
        };
        if (target === 'person') {
          setPersonImage(imgFile);
          setStep(AppStep.SELECT_GARMENT);
        } else if (target === 'garment') {
          setUploadedGarments(prev => [...prev, imgFile]);
        } else if (target === 'background') {
          setUploadedBackground(imgFile);
          setSelectedBackground(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const toggleCollectionGarment = (garment: Garment) => {
    setSelectedGarments(prev => 
      prev.find(g => g.id === garment.id) 
        ? prev.filter(g => g.id !== garment.id) 
        : [...prev, garment]
    );
  };

  const curateForMe = () => {
    const top = SAMPLE_GARMENTS.filter(g => g.category === 'Top')[Math.floor(Math.random() * 3)];
    const bot = SAMPLE_GARMENTS.filter(g => g.category === 'Bottom')[Math.floor(Math.random() * 3)];
    const shoe = SAMPLE_GARMENTS.filter(g => g.category === 'Shoes')[Math.floor(Math.random() * 3)];
    setSelectedGarments([top, bot, shoe]);
    setSuccessMessage("AI Curation Applied: Minimalist Chic");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleQRScan = (scannedData: string) => {
    const matchedGarment = SAMPLE_GARMENTS.find(g => g.id === scannedData || g.name.toLowerCase() === scannedData.toLowerCase());
    if (matchedGarment) {
      if (!selectedGarments.find(g => g.id === matchedGarment.id)) {
        setSelectedGarments(prev => [...prev, matchedGarment]);
        setSuccessMessage(`Tag Recognized: ${matchedGarment.name}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
      setStep(AppStep.SELECT_GARMENT);
    } else {
      setError("Unrecognized tag.");
      setStep(AppStep.SELECT_GARMENT);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleTryOn = async () => {
    if (!personImage) return;
    setIsProcessing(true);
    setStep(AppStep.GENERATING);
    setProcessingStage(0);

    const stages = [
      "Analyzing Anatomy & Pose...",
      "Simulating Fabric Physics...",
      "Transferring Textures...",
      "Finalizing Global Illumination..."
    ];

    const timer = setInterval(() => {
      setProcessingStage(prev => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      let bgFile: ImageFile | undefined = undefined;
      if (uploadedBackground) {
        bgFile = uploadedBackground;
      } else if (selectedBackground) {
        bgFile = await fetchImageAsImageFile(selectedBackground.imageUrl);
      }

      const activeColor = selectedColor === 'None' ? undefined : selectedColor;

      let data;
      if (selectionMode === 'collection') {
        const garmentFiles = await Promise.all(selectedGarments.map(g => fetchImageAsImageFile(g.imageUrl)));
        data = await performVirtualTryOn(personImage, garmentFiles, bgFile, activeColor || undefined);
      } else if (selectionMode === 'upload') {
        const garmentFiles = [...uploadedGarments];
        data = await performVirtualTryOn(personImage, garmentFiles, bgFile, activeColor || undefined);
      } else {
        const referenceFiles = await Promise.all(selectedGarments.map(g => fetchImageAsImageFile(g.imageUrl)));
        data = await performCustomTryOn(personImage, customPrompt, referenceFiles, bgFile, activeColor || undefined);
      }

      clearInterval(timer);
      setResult({
        id: Math.random().toString(36).substr(2, 9),
        imageUrl: data.imageUrl,
        createdAt: Date.now(),
        advice: data.advice,
        customPrompt: selectionMode === 'custom' ? customPrompt : undefined,
      });
      setStep(AppStep.RESULT);
    } catch (err: any) {
      clearInterval(timer);
      setError("AI transformation failed. Ensure your photo has a clear subject.");
      setStep(AppStep.SELECT_GARMENT);
    } finally {
      setIsProcessing(false);
    }
  };

  const handle360View = async () => {
    if (!result) return;
    
    // Fix: Access pre-configured 'aistudio' via window casting to avoid TypeScript declaration conflicts.
    const aistudio = (window as any).aistudio;
    const hasKey = await aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await aistudio.openSelectKey();
    }

    setStep(AppStep.GENERATING_VIDEO);
    setProcessingStage(0);

    const videoStages = [
      "Simulating Camera Orbit...",
      "Building 3D Manifold...",
      "Interpolating Fabric Motion...",
      "Refining Cinematic Lighting..."
    ];

    const timer = setInterval(() => {
      setProcessingStage(prev => (prev < videoStages.length - 1 ? prev + 1 : prev));
    }, 10000);

    try {
      const videoUrl = await generate360Video(result.imageUrl);
      setResult(prev => prev ? { ...prev, videoUrl } : null);
      setStep(AppStep.RESULT);
    } catch (err: any) {
      // Fix: Handle key reset if entity not found, using casted window access.
      if (err?.message?.includes("Requested entity was not found.")) {
        await (window as any).aistudio.openSelectKey();
      }
      setError("Cinematic rendering failed. Please try again.");
      setStep(AppStep.RESULT);
    } finally {
      clearInterval(timer);
    }
  };

  const reset = () => {
    setPersonImage(null);
    setSelectedGarments([]);
    setUploadedGarments([]);
    setSelectedBackground(null);
    setUploadedBackground(null);
    setSelectedColor(null);
    setCustomPrompt("");
    setResult(null);
    setStep(AppStep.UPLOAD_PERSON);
  };

  const appUrl = window.location.href;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-white selection:text-black safe-pt">
      <header className="bg-black/50 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center space-x-4 md:space-x-6 cursor-pointer" onClick={reset}>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center text-black shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              <span className="font-bold text-lg md:text-xl tracking-tighter">S</span>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-[0.2em] uppercase leading-none">StyleAI</h1>
              <p className="text-[8px] md:text-[10px] text-white/30 uppercase tracking-[0.5em] mt-1">Virtual Studio</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <button onClick={() => setShowMobileSync(true)} className="text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 md:py-3 rounded-full border border-white/10 hover:bg-white/5 transition-all flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2-2v14a2 2 0 002 2z" /></svg>
              <span>Mobile</span>
            </button>
            <button onClick={reset} className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] px-4 md:px-6 py-2 md:py-3 rounded-full border border-white/10 hover:bg-white hover:text-black transition-all">
              New Session
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 md:py-12">
        {showMobileSync && (
          <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6" onClick={() => setShowMobileSync(false)}>
            <div className="bg-neutral-900 border border-white/10 rounded-[40px] md:rounded-[60px] max-w-lg w-full p-8 md:p-16 space-y-8 animate-in zoom-in-95 text-center" onClick={e => e.stopPropagation()}>
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl serif italic">Studio Connect</h2>
                <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em]">Scan to open on mobile</p>
              </div>
              
              <div className="bg-white p-6 md:p-10 rounded-[40px] shadow-[0_0_50px_rgba(255,255,255,0.1)] inline-block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}&bgcolor=ffffff&color=000000`} 
                  className="w-48 h-48 md:w-64 md:h-64" 
                  alt="App QR Code" 
                />
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-center space-x-2 text-[9px] font-black uppercase tracking-widest text-green-400">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                  <span>Mobile Ready</span>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(appUrl);
                    setSuccessMessage("Link Copied");
                    setTimeout(() => setSuccessMessage(null), 2000);
                  }}
                  className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                >
                  Copy Link Instead
                </button>
              </div>

              <button onClick={() => setShowMobileSync(false)} className="w-full py-5 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-[0.4em]">Close</button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 p-6 bg-red-500/10 border border-red-500/50 text-red-200 rounded-3xl flex items-center space-x-4 animate-in slide-in-from-top-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-red-500 rounded-full flex items-center justify-center">!</div>
            <span className="text-xs md:text-sm font-bold uppercase tracking-widest">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-white text-black px-6 md:px-8 py-3 md:py-4 rounded-full shadow-2xl animate-in slide-in-from-top-8 flex items-center space-x-3">
             <div className="w-2 h-2 bg-black rounded-full animate-ping" />
             <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">{successMessage}</span>
          </div>
        )}

        {step === AppStep.SCAN_TAG && (
          <QRScanner onScan={handleQRScan} onClose={() => setStep(AppStep.SELECT_GARMENT)} />
        )}

        {showSampleTags && (
          <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 md:p-8" onClick={() => setShowSampleTags(false)}>
            <div className="bg-neutral-900 border border-white/10 rounded-[40px] md:rounded-[60px] max-w-3xl w-full p-8 md:p-16 space-y-8 md:space-y-12 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="text-center space-y-4">
                <h2 className="text-3xl md:text-4xl serif italic">The Studio Registry</h2>
                <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em]">Scan boutique codes</p>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-4 md:gap-8">
                {[
                  { id: 't1', name: 'Traditional' },
                  { id: 'g1', name: 'Silk Gown' },
                  { id: 'g2', name: 'Blazer' },
                  { id: 's1', name: 'Stilettos' },
                  { id: 'i1', name: 'Underwear' }
                ].map(tag => (
                  <div key={tag.id} className="flex flex-col items-center space-y-2 md:space-y-4 group">
                    <div className="bg-white p-2 md:p-3 rounded-2xl md:rounded-3xl shadow-2xl group-hover:scale-110 transition-transform">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${tag.id}`} className="w-16 h-16 md:w-20 md:h-20 grayscale" alt={tag.name} />
                    </div>
                    <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">{tag.name}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowSampleTags(false)} className="w-full py-4 md:py-5 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-[0.4em]">Back to Selection</button>
            </div>
          </div>
        )}

        {step === AppStep.UPLOAD_PERSON && (
          <section className="max-w-4xl mx-auto py-12 md:py-20 space-y-12 md:space-y-16 animate-in fade-in duration-1000">
            <div className="text-center space-y-4 md:space-y-6">
              <h2 className="text-5xl md:text-8xl serif italic tracking-tighter leading-tight">Define your<br/>Aesthetic.</h2>
              <p className="text-neutral-500 font-black uppercase tracking-[0.3em] text-[10px]">High-fidelity AI Virtual Studio</p>
            </div>
            
            <div className="relative group max-w-sm md:max-w-xl mx-auto cursor-pointer">
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'person')} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
              <div className="aspect-[3/4] rounded-[40px] md:rounded-[60px] border border-white/10 bg-neutral-900 flex flex-col items-center justify-center transition-all group-hover:border-white/40 group-hover:shadow-[0_0_100px_rgba(255,255,255,0.05)]">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 md:mb-8 border border-white/5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em] text-white/40">Upload Portrait</span>
                <p className="text-[7px] md:text-[9px] text-white/20 mt-4 uppercase tracking-widest italic px-4 text-center">Clear features & neutral background</p>
              </div>
            </div>
          </section>
        )}

        {step === AppStep.SELECT_GARMENT && (
          <div className="grid lg:grid-cols-12 gap-8 md:gap-20 items-start animate-in fade-in duration-700">
            <div className="lg:col-span-4 space-y-8 md:space-y-10 lg:sticky lg:top-32">
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Active Subject</h3>
                  <button onClick={() => setStep(AppStep.UPLOAD_PERSON)} className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors">Switch</button>
                </div>
                <div className="aspect-[3/4] rounded-[30px] md:rounded-[40px] overflow-hidden border border-white/10 relative shadow-2xl">
                  <img src={personImage?.preview} className="w-full h-full object-cover grayscale opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
                  <div className="absolute bottom-4 md:bottom-6 inset-x-4 md:inset-x-6 flex items-end justify-between">
                     <div>
                        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.3em] text-white/40">Layers Active</p>
                        <p className="text-xl md:text-2xl serif italic">{totalSelected}</p>
                     </div>
                     <button onClick={curateForMe} className="w-8 h-8 md:w-10 md:h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                     </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Environment</h3>
                </div>
                <div className="flex overflow-x-auto pb-2 space-x-3 scrollbar-hide">
                    {uploadedBackground && (
                      <button onClick={() => setSelectedBackground(null)} className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-white ring-2 ring-white/10">
                        <img src={uploadedBackground.preview} className="w-full h-full object-cover" />
                      </button>
                    )}
                    {SAMPLE_BACKGROUNDS.map((bg) => (
                      <button key={bg.id} onClick={() => { setSelectedBackground(bg); setUploadedBackground(null); }} className={`flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border transition-all ${selectedBackground?.id === bg.id ? 'border-white scale-90' : 'border-white/5 opacity-40'}`}>
                        <img src={bg.imageUrl} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    <label className="flex-shrink-0 w-12 h-12 rounded-xl border border-dashed border-white/20 flex items-center justify-center cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'background')} className="hidden" />
                    </label>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-white/5 rounded-[30px] md:rounded-[40px] border border-white/5 space-y-3">
                 <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Stylist Insight</span>
                 </div>
                 <p className="text-xs md:text-sm serif italic text-white/80 leading-relaxed">"{stylistInsight}"</p>
              </div>

              <div className="space-y-4 md:space-y-6">
                <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Palette</h3>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c.name === 'None' ? null : c.name)}
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all ${
                        (selectedColor === c.name || (selectedColor === null && c.name === 'None')) 
                          ? 'border-white ring-4 ring-white/5 scale-110 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                          : 'border-white/10 hover:border-white/30'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {c.name === 'None' && <span className="text-[8px] text-white/20">/</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-8 md:space-y-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex space-x-1 bg-white/5 p-1 rounded-full border border-white/5">
                  {(['collection', 'upload', 'custom'] as SelectionMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSelectionMode(mode)}
                      className={`px-4 md:px-8 py-2 md:py-3 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] transition-all ${selectionMode === mode ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:text-white'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                
                <div className="flex space-x-3">
                  <button onClick={() => setShowSampleTags(true)} className="px-4 py-2 rounded-full bg-white/5 text-[8px] font-black uppercase tracking-[0.1em] border border-white/5">Tags</button>
                  <button onClick={() => setStep(AppStep.SCAN_TAG)} className="px-4 py-2 rounded-full bg-white text-black text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                    <span>Scanner</span>
                  </button>
                </div>
              </div>

              <div className="min-h-[400px]">
                {selectionMode === 'collection' && (
                  <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex overflow-x-auto pb-2 space-x-2 md:space-x-4 scrollbar-hide">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className={`px-4 md:px-8 py-2 md:py-3 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] whitespace-nowrap transition-all border ${activeCategory === cat ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-white/40'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                      {filteredGarments.map((g) => {
                        const isSelected = selectedGarments.find(item => item.id === g.id);
                        return (
                          <button 
                            key={g.id} 
                            onClick={() => toggleCollectionGarment(g)} 
                            className={`relative aspect-[3/4] rounded-2xl md:rounded-[32px] overflow-hidden border transition-all duration-300 group ${isSelected ? 'border-white scale-95' : 'border-white/5 opacity-80'}`}
                          >
                            <img src={g.imageUrl} className="w-full h-full object-cover" alt={g.name} />
                            {isSelected && (
                              <div className="absolute top-4 right-4 w-6 h-6 md:w-8 md:h-8 bg-white rounded-full flex items-center justify-center shadow-2xl text-black animate-in zoom-in">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black p-3 md:p-6 text-left">
                               <p className="text-[6px] md:text-[7px] font-black text-white/40 uppercase tracking-[0.4em] mb-1">{g.category}</p>
                               <p className="text-white text-[9px] md:text-[11px] font-bold uppercase tracking-widest leading-tight">{g.name}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectionMode === 'upload' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 text-center">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                      <div className="relative group aspect-[3/4]">
                        <input type="file" multiple accept="image/*" onChange={(e) => handleFileUpload(e, 'garment')} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                        <div className="h-full border-2 border-dashed border-white/10 bg-neutral-900 rounded-3xl md:rounded-[40px] flex flex-col items-center justify-center">
                          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Add Flatlay</span>
                        </div>
                      </div>
                      {uploadedGarments.map((g, i) => (
                        <div key={i} className="relative aspect-[3/4] rounded-3xl md:rounded-[40px] overflow-hidden border border-white/10 group shadow-2xl">
                          <img src={g.preview} className="w-full h-full object-cover" />
                          <button onClick={() => setUploadedGarments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 bg-black/80 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all text-xs">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectionMode === 'custom' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                    <textarea 
                      value={customPrompt} 
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. A floor-length organza saree..."
                      className="w-full h-40 md:h-60 p-6 md:p-12 bg-neutral-900 border border-white/5 rounded-3xl md:rounded-[50px] focus:ring-1 focus:ring-white outline-none transition-all resize-none text-lg md:text-2xl serif italic placeholder:text-white/10 shadow-inner"
                    />
                    <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                      {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => setCustomPrompt(s)} className="px-4 md:px-8 py-2 md:py-4 bg-white/5 border border-white/10 rounded-full text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-8 md:pt-12 border-t border-white/5 safe-pb">
                <button
                  disabled={totalSelected === 0}
                  onClick={handleTryOn}
                  className="group relative w-full py-6 md:py-8 rounded-full overflow-hidden disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
                >
                  <div className="absolute inset-0 bg-white" />
                  <span className="relative z-10 text-black font-black uppercase tracking-[0.5em] md:tracking-[0.8em] text-[10px] md:text-xs">Assemble Editorial</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {(step === AppStep.GENERATING || step === AppStep.GENERATING_VIDEO) && (
          <div className="max-w-4xl mx-auto py-20 md:py-32 text-center space-y-12 md:space-y-20 animate-in fade-in duration-1000">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-48 h-48 md:w-64 md:h-64 border-2 border-white/5 rounded-full" />
              <div className="absolute w-48 h-48 md:w-64 md:h-64 border-t-2 border-white rounded-full animate-[spin_4s_linear_infinite]" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="space-y-1">
                   <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] text-white animate-pulse">Wait</p>
                   <p className="text-2xl md:text-4xl serif italic">
                     {Math.round((processingStage + 1) / 4 * 100)}%
                   </p>
                 </div>
              </div>
            </div>

            <div className="space-y-6 md:space-y-8">
              <h2 className="text-3xl md:text-6xl serif italic tracking-tighter leading-tight transition-all duration-1000">
                {step === AppStep.GENERATING_VIDEO ? [
                  "Simulating Orbit...",
                  "Building Manifold...",
                  "Interpolating Motion...",
                  "Refining Light..."
                ][processingStage] : [
                  "Analyzing Anatomy...",
                  "Simulating Physics...",
                  "Transferring Textures...",
                  "Finalizing Light..."
                ][processingStage]}
              </h2>
              <div className="max-w-xs mx-auto h-0.5 bg-white/5 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-white transition-all ease-in-out" 
                   style={{ 
                     width: `${(processingStage + 1) * 25}%`,
                     transitionDuration: step === AppStep.GENERATING_VIDEO ? '10s' : '2.5s'
                   }} 
                 />
              </div>
            </div>
          </div>
        )}

        {step === AppStep.RESULT && result && (
          <div className="animate-in fade-in duration-1500 space-y-12 md:space-y-24">
            <div className="grid lg:grid-cols-12 gap-8 md:gap-20 items-stretch">
              <div className="lg:col-span-8 group relative rounded-[40px] md:rounded-[60px] overflow-hidden bg-neutral-900 border-[10px] md:border-[20px] border-neutral-900 shadow-2xl">
                {result.videoUrl ? (
                  <video src={result.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={result.imageUrl} className="w-full h-full object-cover" alt="Editorial Result" />
                )}
                
                <div className="absolute inset-0 pointer-events-none p-6 md:p-16 flex flex-col justify-between items-start">
                   <div className="w-full flex justify-between items-start">
                      <div className="space-y-1">
                        <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-none mix-blend-difference text-white">STYLEAI</h2>
                      </div>
                      <div className="text-right">
                         <p className="text-[8px] md:text-[10px] font-black tracking-[0.2em] text-white/40 uppercase">AESTHETIC UNIT</p>
                         <p className="text-lg md:text-2xl serif italic text-white/80">#{result.id.toUpperCase()}</p>
                      </div>
                   </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col justify-between py-6 md:py-12">
                <div className="space-y-12 md:space-y-16">
                  <div className="space-y-4 md:space-y-6">
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Stylist Feedback</span>
                    <p className="text-lg md:text-xl text-white/60 leading-relaxed italic serif">"{result.advice}"</p>
                  </div>

                  {!result.videoUrl && (
                    <div className="p-6 md:p-8 bg-white/5 rounded-3xl md:rounded-[40px] border border-white/5 space-y-4">
                      <p className="text-[8px] md:text-[9px] text-cyan-400 font-bold uppercase tracking-widest">Generate 360° turntable view</p>
                      <button onClick={handle360View} className="w-full py-3 md:py-4 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black uppercase tracking-[0.2em] text-[8px] md:text-[9px] hover:bg-cyan-500 hover:text-black transition-all">
                        Start Cinematic View
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4 md:space-y-6 mt-8">
                  <button 
                    onClick={handleShare}
                    className="w-full py-5 md:py-6 rounded-full bg-neutral-100 text-neutral-900 font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl flex items-center justify-center space-x-3 hover:scale-[1.02] transition-transform"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    <span>Share Look</span>
                  </button>
                  <button onClick={() => {
                       const link = document.createElement('a');
                       link.href = result.videoUrl || result.imageUrl;
                       link.download = `styleai-editorial-${result.id}.${result.videoUrl ? 'mp4' : 'png'}`;
                       link.click();
                    }} className="w-full py-5 md:py-6 rounded-full bg-white/5 border border-white/10 text-white font-black uppercase tracking-[0.3em] text-[10px] hover:bg-white hover:text-black transition-all">
                    Export Asset
                  </button>
                  <button onClick={() => setStep(AppStep.SELECT_GARMENT)} className="w-full py-5 md:py-6 rounded-full bg-transparent border border-white/10 text-white/40 font-black uppercase tracking-[0.3em] text-[10px] hover:text-white transition-colors">
                    Re-style Subject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 md:py-24 border-t border-white/5 safe-pb">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="text-[8px] md:text-[10px] font-black tracking-[0.5em] uppercase text-white/20">
            StyleAI Studio &copy; {new Date().getFullYear()} • Production Build 2.0
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
