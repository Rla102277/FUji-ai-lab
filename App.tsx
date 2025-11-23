
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Aperture, Download, Cpu, Sparkles, RefreshCw, Info, AlertCircle, Layers, Image as ImageIcon, FileImage, Sliders, Sun, Contrast, Thermometer, Pipette, RotateCcw, Droplet, Moon, Maximize, Monitor, Settings, BookOpen, Activity, Triangle, Zap, Gauge, Disc, Play, HelpCircle, FileQuestion, Terminal, Code } from 'lucide-react';
import { DropZone } from './components/DropZone';
import { CompareSlider } from './components/CompareSlider';
import { FujifilmRecipeGuide } from './components/FujifilmRecipeGuide';
import { analyzeSimulationProfile } from './services/geminiService';
import { parseCube, generateDNG, extractJpegFromRaf, extractMetadataFromJpeg, blobToImageData, imageDataToFloat, floatToImageData, processFloatImage, imageDataToBlob, renderLutVisualization, sRGBToLinear, estimateKelvinAndTint, parseFp1Settings, processRawWithWasm, createRetroSample, checkEngineAvailability } from './services/imageProcessor';
import { SimulationAnalysis, ProcessingState, LutData, DevelopSettings, DEFAULT_SETTINGS, ImageMetadata, FloatImage } from './types';

// Racing/Sport Style Range Slider
const RangeControl = ({ label, value, min, max, step, onChange, unit = '', icon: Icon }: any) => (
  <div className="space-y-1 group">
    <div className="flex justify-between items-center text-sm font-bold">
      <div className="flex items-center gap-2 text-zinc-800">
        {Icon && <Icon size={14} />}
        <span className="uppercase text-xs tracking-wider">{label}</span>
      </div>
      <span className="font-mono text-white bg-black px-2 py-0.5 min-w-[50px] text-right text-xs">
        {value > 0 && '+'}{value}{unit}
      </span>
    </div>
    <div className="relative h-6 flex items-center">
        {/* Center Line Track */}
        <div className="absolute w-full h-1 bg-black"></div>
        {/* Center Notch */}
        <div className="absolute left-1/2 w-1 h-3 bg-black -translate-x-1/2"></div>
        
        <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="relative w-full h-1 appearance-none bg-transparent cursor-pointer z-10 
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
            [&::-webkit-slider-thumb]:bg-[#009639] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black
            [&::-webkit-slider-thumb]:hover:bg-[#d5001c] [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:shadow-[2px_2px_0px_black]"
        />
    </div>
  </div>
);

const App: React.FC = () => {
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [simFile, setSimFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<SimulationAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [progress, setProgress] = useState(0);
  
  // Output State
  const [generatedDngUrl, setGeneratedDngUrl] = useState<string | null>(null);
  const [generatedJpegUrl, setGeneratedJpegUrl] = useState<string | null>(null);
  const [generatedHifUrl, setGeneratedHifUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{w: number, h: number} | null>(null);
  
  // Metadata State
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);

  // Comparison State
  const [beforeImageUrl, setBeforeImageUrl] = useState<string | null>(null);
  const [afterImageUrl, setAfterImageUrl] = useState<string | null>(null);
  const [lutVizUrl, setLutVizUrl] = useState<string | null>(null);
  
  // Development State
  const [developSettings, setDevelopSettings] = useState<DevelopSettings>(DEFAULT_SETTINGS);
  const [baseFloatData, setBaseFloatData] = useState<FloatImage | null>(null);
  const [lutData, setLutData] = useState<LutData | null>(null);
  
  // White Balance Picking State
  const [isPickingWB, setIsPickingWB] = useState(false);
  
  // Recipe Guide State
  const [isRecipeGuideOpen, setIsRecipeGuideOpen] = useState(false);
  
  // Processing Engine State
  const [engineMode, setEngineMode] = useState<'speed' | 'quality'>('speed');
  const [engineAvailable, setEngineAvailable] = useState(false);
  const [showDriverHelp, setShowDriverHelp] = useState(false);

  const [error, setError] = useState<string | null>(null);
  
  // Sample Image State
  const [isSampleMode, setIsSampleMode] = useState(false);

  // --- CLEANUP EFFECTS ---
  useEffect(() => {
    return () => { if (generatedDngUrl) URL.revokeObjectURL(generatedDngUrl); };
  }, [generatedDngUrl]);

  useEffect(() => {
    return () => { if (generatedJpegUrl) URL.revokeObjectURL(generatedJpegUrl); };
  }, [generatedJpegUrl]);

  useEffect(() => {
    return () => { if (generatedHifUrl) URL.revokeObjectURL(generatedHifUrl); };
  }, [generatedHifUrl]);

  useEffect(() => {
    return () => { if (beforeImageUrl) URL.revokeObjectURL(beforeImageUrl); };
  }, [beforeImageUrl]);

  useEffect(() => {
    return () => { if (afterImageUrl) URL.revokeObjectURL(afterImageUrl); };
  }, [afterImageUrl]);

  useEffect(() => {
    return () => { if (lutVizUrl) URL.revokeObjectURL(lutVizUrl); };
  }, [lutVizUrl]);

  // Check Engine on Mount
  useEffect(() => {
      checkEngineAvailability().then(available => {
          setEngineAvailable(available);
          if (!available && engineMode === 'quality') {
              setEngineMode('speed');
          }
      });
  }, []);

  // Analyze Simulation
  useEffect(() => {
    if (!simFile) {
      setAnalysis(null);
      setLutVizUrl(null);
      setLutData(null);
      return;
    }

    const analyze = async () => {
      setIsAnalyzing(true);
      setError(null);
      try {
        const ext = simFile.name.split('.').pop()?.toLowerCase();
        let type: 'FP1' | 'CUBE' = 'FP1';
        let content: string | null = null;

        if (ext === 'cube') {
          type = 'CUBE';
          content = await simFile.text();
          try {
            const lut = parseCube(content);
            setLutData(lut);
            setLutVizUrl(renderLutVisualization(lut));
          } catch (e) { console.warn("Could not parse LUT during analysis"); }
        } else if (ext === 'fp1') {
            type = 'FP1';
            content = await simFile.text(); 
            setLutData(null); 
            
            // Directly apply settings from FP1 if possible, bypassing AI guess for accuracy
            try {
                const settings = parseFp1Settings(content);
                setDevelopSettings(prev => ({
                    ...prev,
                    ...settings
                }));
            } catch (e) { console.warn("FP1 Parse failed, falling back to AI"); }
        }

        // --- AUTO SAMPLE LOADER ---
        // If we load a recipe but have no Raw File, auto-load the retro sample
        if (!rawFile) {
            console.log("Auto-loading Sample Image");
            setIsSampleMode(true);
            const sample = await createRetroSample();
            setRawFile(sample);
            // We need to trigger processing after this state updates. 
            // Since setState is async, we'll rely on the useEffect for rawFile to handle this if we were strictly reactive, 
            // but here we just set the file. The button will become clickable or we can auto-click it.
        }

        const result = await analyzeSimulationProfile(simFile.name, content, type);
        setAnalysis(result);

        // Only use AI suggestions if we didn't already get them from FP1 parsing
        if (type === 'CUBE' && result.suggestedSettings) {
           setDevelopSettings(prev => ({
             ...prev,
             ...result.suggestedSettings
           }));
        }

      } catch (err) {
        console.error(err);
        setError("Failed to analyze file.");
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyze();
  }, [simFile]);

  // Live Pipeline Update Effect
  useEffect(() => {
    if (!baseFloatData || processingState === ProcessingState.READING_FILES || processingState === ProcessingState.EXTRACTING_JPEG) return;
    
    const timer = setTimeout(async () => {
        try {
            // Run Float Pipeline
            const processedFloat = processFloatImage(baseFloatData, developSettings, lutData);
            // Convert back to displayable 8-bit for preview
            const displayData = floatToImageData(processedFloat);
            
            const blob = await imageDataToBlob(displayData, 'image/jpeg', 0.8);
            const url = URL.createObjectURL(blob);
            setAfterImageUrl((prev) => url);
        } catch (e) {
            console.error("Preview update failed", e);
        }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [developSettings, baseFloatData, lutData, processingState]);

  // Auto-process if entering Sample Mode
  useEffect(() => {
     if (isSampleMode && rawFile && simFile && processingState === ProcessingState.IDLE) {
         handleInitialProcess();
     }
  }, [isSampleMode, rawFile, simFile]);

  const handleInitialProcess = useCallback(async () => {
    if (!rawFile) return;

    setProcessingState(ProcessingState.READING_FILES);
    setProgress(5);
    setGeneratedDngUrl(null);
    setBeforeImageUrl(null);
    setAfterImageUrl(null);
    setImageDimensions(null);
    setMetadata(null);
    setError(null);

    try {
      if (!lutData && simFile && simFile.name.endsWith('.cube')) {
         setProcessingState(ProcessingState.PARSING_LUT);
         const text = await simFile.text();
         const parsed = parseCube(text);
         setLutData(parsed);
      }
      setProgress(20);

      // Check if it's our synthetic sample (JPEG) or a real RAF
      const isJpeg = rawFile.type === 'image/jpeg' || rawFile.name.endsWith('.jpg') || rawFile.name.endsWith('.jpeg');

      if (isJpeg) {
          // DIRECT JPEG LOAD
          setProcessingState(ProcessingState.EXTRACTING_JPEG);
          const blob = rawFile; 
          const beforeUrl = URL.createObjectURL(blob);
          setBeforeImageUrl(beforeUrl);
          
          setProcessingState(ProcessingState.CONVERTING_FLOAT);
          const imageData = await blobToImageData(blob);
          const floatImage = imageDataToFloat(imageData);
          setBaseFloatData(floatImage);
          setImageDimensions({ w: floatImage.width, h: floatImage.height });
          setProgress(60);

          setProcessingState(ProcessingState.PROCESSING_PIPELINE);
          const processedFloat = processFloatImage(floatImage, developSettings, lutData);
          const processedDisplay = floatToImageData(processedFloat);
          setProgress(80);

          const finalBlob = await imageDataToBlob(processedDisplay);
          setAfterImageUrl(URL.createObjectURL(finalBlob));
          setGeneratedJpegUrl(URL.createObjectURL(finalBlob));
          setProcessingState(ProcessingState.COMPLETE);
          setProgress(100);
      } else {
          // RAF PIPELINE
          // Always extract JPEG for Metadata and "Before" view
          setProcessingState(ProcessingState.EXTRACTING_JPEG);
          const extractedJpegBlob = await extractJpegFromRaf(rawFile);
          
          setProcessingState(ProcessingState.EXTRACTING_METADATA);
          const meta = await extractMetadataFromJpeg(extractedJpegBlob);
          setMetadata(meta);

          const beforeUrl = URL.createObjectURL(extractedJpegBlob);
          setBeforeImageUrl(beforeUrl);
          setProgress(40);

          let floatImage: FloatImage;

          if (engineMode === 'quality') {
              // --- WASM PATH ---
              setProcessingState(ProcessingState.CONVERTING_FLOAT);
              setProgress(50);
              try {
                  floatImage = await processRawWithWasm(rawFile);
              } catch(e: any) {
                  console.warn("Wasm Engine Failed. Falling back to Speed mode.", e);
                  setError("High-Res engine unavailable (LibRaw binaries missing). Switched to Speed Priority.");
                  setEngineMode('speed');
                  const imageData = await blobToImageData(extractedJpegBlob);
                  floatImage = imageDataToFloat(imageData);
              }
          } else {
              // --- JS (JPEG) PATH ---
              setProcessingState(ProcessingState.CONVERTING_FLOAT);
              const imageData = await blobToImageData(extractedJpegBlob);
              floatImage = imageDataToFloat(imageData);
          }
          
          setBaseFloatData(floatImage);
          setImageDimensions({ w: floatImage.width, h: floatImage.height });
          setProgress(60);

          setProcessingState(ProcessingState.PROCESSING_PIPELINE);
          const processedFloat = processFloatImage(floatImage, developSettings, lutData);
          const processedDisplay = floatToImageData(processedFloat);
          setProgress(80);

          const finalBlob = await imageDataToBlob(processedDisplay);
          setAfterImageUrl(URL.createObjectURL(finalBlob));
          setGeneratedJpegUrl(URL.createObjectURL(finalBlob));

          setProcessingState(ProcessingState.COMPLETE);
          setProgress(100);
      }

    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Processing failed.";
      if (msg.includes('LibRaw') || msg.includes('wasm') || msg.includes('libraw')) {
           msg = "Engine Error: LibRaw binaries not found. Please switch to Speed Priority mode.";
      }
      setError(msg);
      setProcessingState(ProcessingState.ERROR);
    }
  }, [rawFile, simFile, lutData, developSettings, engineMode]);

  const handleExportDng = async () => {
    if (!baseFloatData) return;
    const prevState = processingState;
    setProcessingState(ProcessingState.WRITING_DNG);
    try {
      const processedFloat = processFloatImage(baseFloatData, developSettings, lutData);
      
      const dngBlob = await generateDNG(
          processedFloat, 
          analysis?.name || "Custom",
          metadata || undefined
      );
      
      const url = URL.createObjectURL(dngBlob);
      setGeneratedDngUrl(url);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `developed_${rawFile?.name.replace(/\.raf$/i, '') || 'image'}.dng`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setProcessingState(ProcessingState.COMPLETE);
    } catch (e) {
      console.error(e);
      setProcessingState(prevState);
      setError("DNG Export failed");
    }
  };

  const handleExportHif = async () => {
    if (!baseFloatData) return;
    const prevState = processingState;
    setProcessingState(ProcessingState.WRITING_DNG);
    try {
      const processedFloat = processFloatImage(baseFloatData, developSettings, lutData);
      const processedDisplay = floatToImageData(processedFloat);
      
      let hifBlob;
      let usedExt = 'hif';
      
      try {
        hifBlob = await imageDataToBlob(processedDisplay, 'image/heic', 0.95);
        if (!hifBlob.type.includes('heic') && !hifBlob.type.includes('heif')) {
            throw new Error("Browser does not support native HEIC encoding");
        }
      } catch(e) {
         console.warn("HEIC export failed or unsupported, using JPEG fallback");
         hifBlob = await imageDataToBlob(processedDisplay, 'image/jpeg', 0.95);
         usedExt = 'jpg';
      }

      const url = URL.createObjectURL(hifBlob);
      setGeneratedHifUrl(url);

      const a = document.createElement('a');
      a.href = url;
      a.download = `developed_${rawFile?.name.replace(/\.raf$/i, '') || 'image'}.${usedExt}`; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setProcessingState(ProcessingState.COMPLETE);
      if (usedExt === 'jpg') {
          setError("Saved as JPEG (HEIC not supported by this browser)");
          setTimeout(() => setError(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setError("Export failed.");
      setProcessingState(prevState);
    }
  };

  const reset = () => {
    setRawFile(null);
    setSimFile(null);
    setAnalysis(null);
    setProcessingState(ProcessingState.IDLE);
    setGeneratedDngUrl(null);
    setGeneratedJpegUrl(null);
    setGeneratedHifUrl(null);
    setBeforeImageUrl(null);
    setAfterImageUrl(null);
    setLutVizUrl(null);
    setBaseFloatData(null);
    setImageDimensions(null);
    setMetadata(null);
    setDevelopSettings(DEFAULT_SETTINGS);
    setProgress(0);
    setError(null);
    setIsPickingWB(false);
    setIsSampleMode(false);
  };

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPickingWB || !baseFloatData) return;

    const rect = e.currentTarget.getBoundingClientRect();
    
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const containerAspect = rect.width / rect.height;
    const imageAspect = baseFloatData.width / baseFloatData.height;
    
    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > imageAspect) {
      renderHeight = rect.height;
      renderWidth = renderHeight * imageAspect;
      offsetX = (rect.width - renderWidth) / 2;
    } else {
      renderWidth = rect.width;
      renderHeight = renderWidth / imageAspect;
      offsetY = (rect.height - renderHeight) / 2;
    }

    if (clickX < offsetX || clickX > offsetX + renderWidth || clickY < offsetY || clickY > offsetY + renderHeight) {
      return; 
    }

    const relativeX = clickX - offsetX;
    const relativeY = clickY - offsetY;
    
    const imgX = Math.floor((relativeX / renderWidth) * baseFloatData.width);
    const imgY = Math.floor((relativeY / renderHeight) * baseFloatData.height);
    
    if (imgX >= 0 && imgX < baseFloatData.width && imgY >= 0 && imgY < baseFloatData.height) {
      const idx = (imgY * baseFloatData.width + imgX) * 4; 
      
      const linR = baseFloatData.data[idx];
      const linG = baseFloatData.data[idx + 1];
      const linB = baseFloatData.data[idx + 2];
      
      try {
        const newWB = estimateKelvinAndTint(linR, linG, linB);
        setDevelopSettings(prev => ({
          ...prev,
          temperature: newWB.temperature,
          tint: newWB.tint
        }));
      } catch (err) {
        console.error("Failed to estimate WB", err);
      }
      
      setIsPickingWB(false);
    }
  }, [isPickingWB, baseFloatData]);

  const handleApplyRecipe = (newSettings: DevelopSettings) => {
      setDevelopSettings(prev => ({
          ...prev,
          ...newSettings
      }));
  };

  const getStatusLabel = (state: ProcessingState) => {
    switch(state) {
      case ProcessingState.EXTRACTING_JPEG: return "DECODING SOURCE";
      case ProcessingState.CONVERTING_FLOAT: return "LINEARIZATION";
      case ProcessingState.EXTRACTING_METADATA: return "PARSING EXIF";
      case ProcessingState.PROCESSING_PIPELINE: return "APPLYING SIMULATION";
      case ProcessingState.WRITING_DNG: return "WRITING 16-BIT DNG";
      default: return "PROCESSING";
    }
  };

  const resetWB = () => {
    setDevelopSettings(s => ({ ...s, temperature: 6500, tint: 0 }));
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-[#009639] selection:text-white text-[#1a1a1a] overflow-x-hidden">
      
      <FujifilmRecipeGuide 
        isOpen={isRecipeGuideOpen} 
        onClose={() => setIsRecipeGuideOpen(false)}
        onApplyRecipe={handleApplyRecipe}
      />

      {/* Driver Help Modal */}
      {showDriverHelp && (
          <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white border-4 border-black shadow-hard-lg max-w-lg w-full relative animate-in slide-in-from-bottom-4">
                  <button onClick={() => setShowDriverHelp(false)} className="absolute top-4 right-4 p-1 hover:bg-[#d5001c] hover:text-white border-2 border-transparent hover:border-black transition-colors"><X size={20}/></button>
                  
                  <div className="bg-[#d5001c] p-4 text-white border-b-4 border-black">
                      <h3 className="font-black text-xl uppercase italic tracking-tighter flex items-center gap-2">
                          <AlertCircle className="animate-pulse" />
                          System Alert: Missing Drivers
                      </h3>
                  </div>
                  
                  <div className="p-8 space-y-6">
                      <p className="font-bold text-sm uppercase tracking-wide">
                          The 32-Bit Floating Point Engine requires external binaries to function.
                      </p>
                      
                      <div className="space-y-4 font-mono text-sm bg-zinc-100 p-4 border-2 border-zinc-300">
                           <div className="flex gap-3">
                               <span className="bg-black text-white px-2 font-bold">01</span>
                               <p>Download <span className="font-bold">libraw.js</span> & <span className="font-bold">libraw.wasm</span></p>
                           </div>
                           <div className="flex gap-3">
                               <span className="bg-black text-white px-2 font-bold">02</span>
                               <p>Place in your project's <span className="font-bold text-[#009639]">public/</span> folder.</p>
                           </div>
                           <div className="flex gap-3">
                               <span className="bg-black text-white px-2 font-bold">03</span>
                               <p>Reload the system.</p>
                           </div>
                      </div>

                      <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                          Until installed, the system will operate in <span className="text-[#009639]">TURBO MODE</span> (High-Speed JPEG Extraction).
                      </div>
                      
                      <button 
                        onClick={() => setShowDriverHelp(false)}
                        className="w-full py-3 bg-black text-white hover:bg-zinc-800 font-bold uppercase tracking-widest border-2 border-transparent"
                      >
                          Acknowledge
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Retro Racing Header */}
      <header className="sticky top-0 z-50 bg-white border-b-4 border-black shadow-hard">
        <div className="absolute top-0 left-0 right-0 h-1 bg-stripes"></div>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col leading-none">
              <span className="text-3xl font-black italic tracking-tighter transform -skew-x-12" style={{ fontFamily: 'Inter' }}>
                FUJI<span className="text-[#009639]">RAW</span>
              </span>
              <span className="text-[10px] tracking-[0.4em] font-bold bg-black text-white px-1 mt-1 text-center">DIGITAL LAB</span>
            </div>
            
            <div className="hidden md:flex items-center gap-3 ml-6">
               <span className={`text-xs font-bold uppercase border-2 border-black px-2 py-0.5 rounded-full shadow-[2px_2px_0px_black] ${engineAvailable ? 'bg-[#fcd800]' : 'bg-zinc-200 text-zinc-500'}`}>
                  {engineAvailable ? 'SYSTEM READY' : 'LIMITED MODE'}
               </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             {/* Metadata Display */}
             {metadata && (
                 <div className="hidden lg:flex items-center gap-4 text-xs font-bold font-mono bg-[#f4f4f4] px-4 py-2 border-2 border-black shadow-[2px_2px_0px_black]">
                     <span className="text-black">{metadata.model || 'CAMERA'}</span>
                     <span className="text-[#d5001c]">|</span>
                     <span>ISO {metadata.iso || '---'}</span>
                     <span className="text-[#d5001c]">|</span>
                     <span>{(metadata.exposureTime && metadata.exposureTime > 0) ? (metadata.exposureTime >= 1 ? metadata.exposureTime + 's' : '1/' + Math.round(1/metadata.exposureTime) + 's') : '--'}</span>
                     <span className="text-[#d5001c]">|</span>
                     <span>ƒ/{metadata.fNumber?.toFixed(1) || '--'}</span>
                 </div>
             )}

            <button
                onClick={() => setIsRecipeGuideOpen(true)}
                className="group flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#f4f4f4] text-black text-xs font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_black] hover:shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
                <BookOpen size={16} />
                Recipe Database
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 mt-4">
        
        {/* Left Column: Controls & Pipeline */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          
          {/* Input Stage */}
          {processingState !== ProcessingState.COMPLETE && (
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end px-1">
                  <div className="flex items-center gap-2">
                     <span className="w-3 h-3 bg-[#009639] border border-black"></span>
                     <h2 className="text-sm font-black uppercase tracking-widest">DECK A: SOURCE</h2>
                  </div>
                  {rawFile && <span className="text-white bg-[#009639] text-[10px] font-bold px-2 py-0.5 border border-black shadow-[2px_2px_0px_black]">MEDIA LOADED</span>}
                </div>
                <DropZone 
                  label="INSERT NEGATIVE"
                  subLabel=".RAF RAW FILE"
                  accept=".raf,.jpg,.jpeg"
                  file={rawFile}
                  onFileSelect={setRawFile}
                  onClear={() => { setRawFile(null); setIsSampleMode(false); }}
                  icon={<Camera size={32} />}
                  disabled={processingState !== ProcessingState.IDLE && processingState !== ProcessingState.ERROR}
                />
                
                {/* Engine Selector */}
                <div className="bg-white p-2 border-2 border-black mt-4 shadow-hard-sm">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">PROCESSING UNIT</label>
                        {!engineAvailable && (
                            <button onClick={() => setShowDriverHelp(true)} className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#d5001c] hover:underline">
                                <HelpCircle size={12} /> Missing Drivers?
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setEngineMode('speed')}
                            className={`p-3 border-2 text-left transition-all flex flex-col gap-1 relative overflow-hidden
                                ${engineMode === 'speed' 
                                    ? 'bg-[#009639] text-white border-black shadow-[2px_2px_0px_black]' 
                                    : 'bg-[#f4f4f4] border-zinc-300 text-zinc-500 hover:border-black'
                                }
                            `}
                        >
                            <div className="flex items-center gap-2">
                                <Zap size={16} />
                                <span className="text-xs font-bold uppercase">Turbo Mode</span>
                            </div>
                        </button>

                        <button 
                            onClick={() => {
                                if (engineAvailable) setEngineMode('quality');
                                else setShowDriverHelp(true);
                            }}
                            className={`p-3 border-2 text-left transition-all flex flex-col gap-1 relative overflow-hidden group
                                ${engineMode === 'quality' 
                                    ? 'bg-[#d5001c] text-white border-black shadow-[2px_2px_0px_black]' 
                                    : engineAvailable 
                                        ? 'bg-[#f4f4f4] border-zinc-300 text-zinc-500 hover:border-black'
                                        : 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed'
                                }
                            `}
                        >
                             <div className="flex items-center gap-2">
                                <Cpu size={16} />
                                <span className="text-xs font-bold uppercase">Pro Mode</span>
                                {!engineAvailable && <div className="ml-auto"><Code size={14}/></div>}
                            </div>
                        </button>
                    </div>
                </div>

              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end px-1">
                   <div className="flex items-center gap-2">
                     <span className="w-3 h-3 bg-[#d5001c] border border-black"></span>
                     <h2 className="text-sm font-black uppercase tracking-widest">DECK B: RECIPE</h2>
                  </div>
                  {simFile && <span className="text-white bg-[#d5001c] text-[10px] font-bold px-2 py-0.5 border border-black shadow-[2px_2px_0px_black]">DATA LOADED</span>}
                </div>
                <DropZone 
                  label="INSERT DATA CARD"
                  subLabel=".FP1 / .CUBE"
                  accept=".fp1,.cube"
                  file={simFile}
                  onFileSelect={setSimFile}
                  onClear={() => setSimFile(null)}
                  icon={<Aperture size={32} />}
                  disabled={processingState !== ProcessingState.IDLE && processingState !== ProcessingState.ERROR}
                />
              </div>
            </div>
          )}

          {/* Development Stage */}
          {processingState === ProcessingState.COMPLETE && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                <div className="flex items-center justify-between p-3 bg-white border-2 border-black shadow-hard">
                   <div className="flex items-center gap-3">
                     <Settings size={18} />
                     <div>
                       <h2 className="text-sm font-black uppercase tracking-widest">Parameter Control</h2>
                     </div>
                   </div>
                   <button 
                      onClick={() => setDevelopSettings(DEFAULT_SETTINGS)}
                      className="text-[10px] uppercase font-bold tracking-wider bg-zinc-100 hover:bg-zinc-200 border-2 border-black px-4 py-1.5 transition-colors shadow-sm"
                   >
                      Reset All
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 bg-white p-8 border-2 border-black shadow-hard relative">
                   
                   <div className="space-y-8 relative z-10">
                      <div className="pb-2 border-b-2 border-zinc-200 mb-4 flex items-center gap-2">
                          <Sliders size={14} className="text-[#009639]" />
                          <span className="text-xs font-bold uppercase">Tone EQ</span>
                      </div>
                      <RangeControl 
                        label="Exposure" 
                        icon={Sun}
                        value={developSettings.exposure} 
                        min={-3} max={3} step={0.1} 
                        unit=" EV"
                        onChange={(v: number) => setDevelopSettings(s => ({...s, exposure: v}))} 
                      />
                      <RangeControl 
                        label="Contrast" 
                        icon={Contrast}
                        value={developSettings.contrast} 
                        min={-50} max={50} step={1} 
                        onChange={(v: number) => setDevelopSettings(s => ({...s, contrast: v}))} 
                      />
                      <RangeControl 
                        label="H-Tone" 
                        icon={Sun}
                        value={developSettings.highlights} 
                        min={-100} max={100} step={1} 
                        onChange={(v: number) => setDevelopSettings(s => ({...s, highlights: v}))} 
                      />
                      <RangeControl 
                        label="S-Tone" 
                        icon={Moon}
                        value={developSettings.shadows} 
                        min={-100} max={100} step={1} 
                        onChange={(v: number) => setDevelopSettings(s => ({...s, shadows: v}))} 
                      />
                   </div>
                   
                   <div className="space-y-8 relative z-10">
                      <div className="flex justify-between items-end pb-2 border-b-2 border-zinc-200 mb-4">
                         <div className="flex items-center gap-2">
                            <Thermometer size={14} className="text-[#d5001c]" />
                            <span className="text-xs font-bold uppercase">Color Science</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <button 
                               onClick={() => setIsPickingWB(!isPickingWB)}
                               className={`
                                  p-1 transition-all border-2 border-black
                                  ${isPickingWB 
                                    ? 'bg-[#d5001c] text-white shadow-[2px_2px_0px_black]' 
                                    : 'bg-white text-black hover:bg-zinc-100'
                                  }
                               `}
                               title="WB Picker"
                            >
                               <Pipette size={14} />
                            </button>
                            <button 
                               onClick={resetWB}
