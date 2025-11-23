
import React, { useState, useMemo, useEffect } from 'react';
import { X, Heart, Mountain, MapPin, Sparkles, Zap, Camera, Copy, Download, Check, ArrowRight, Film, ChevronDown, ChevronUp, Plus, Brain, Save, Trash2, Globe, FileCode, Upload, Settings } from 'lucide-react';
import { DevelopSettings, FilmRecipe, RecipePack, CameraModel } from '../types';
import { generateAiRecipe, analyzeLutToRecipe } from '../services/geminiService';
import { saveRecipeToDb, getUserRecipePack, deleteRecipeFromDb } from '../services/recipePersistence';
import { recipeToFp1, SUPPORTED_CAMERAS } from '../services/imageProcessor';

// --- Data ---

const RECIPE_DB: RecipePack[] = [
  {
    id: 'vsco-01',
    name: 'VSCO Pack 01',
    author: 'Community',
    recipes: [
      {
        id: 'fuji-400h',
        name: 'Fuji Pro 400H',
        iso: 'ISO 400 / Auto',
        usedFor: 'Wedding, Portrait, Soft Daylight',
        characteristics: 'Pastel greens, soft contrast, airy highlights. The quintessential wedding film look.',
        category: ['Portrait', 'Professional'],
        tags: ['Pastel', 'Airy', 'Wedding'],
        settings: {
          filmSimulation: 'PRO Neg. Hi',
          dynamicRange: 'DR200',
          whiteBalance: 5600,
          tintShift: 2,
          wbShiftR: 2,
          wbShiftB: 3,
          colorChrome: 'Strong',
          colorChromeBlue: 'Weak',
          highlights: -1, // Mapped internal
          shadows: 1, // Mapped internal
          noiseReduction: -4,
          sharpness: -2,
          colorSaturation: 2,
          grainEffect: 'Weak',
        }
      },
      {
        id: 'kodak-portra-400',
        name: 'Kodak Portra 400',
        iso: 'ISO 400 / DR400',
        usedFor: 'General Purpose, Travel, Human Skin',
        characteristics: 'Warm, golden tones with excellent skin retention. slightly punchy contrast.',
        category: ['Travel', 'Portrait'],
        tags: ['Warm', 'Gold', 'Classic'],
        settings: {
          filmSimulation: 'Classic Chrome',
          dynamicRange: 'DR400',
          whiteBalance: 6100,
          tintShift: -15, 
          wbShiftR: 3,
          wbShiftB: -4,
          colorChrome: 'Strong',
          colorChromeBlue: 'Off',
          highlights: -1,
          shadows: -1,
          noiseReduction: -4,
          sharpness: 0,
          colorSaturation: 2,
          grainEffect: 'Strong/Small',
        }
      },
      {
        id: 'kodak-portra-800',
        name: 'Kodak Portra 800',
        iso: 'ISO 800-3200',
        usedFor: 'Low Light, Night Street, Concerts',
        characteristics: 'More saturation and grain than 400. Handles mixed lighting well.',
        category: ['Low-Light', 'Travel'],
        tags: ['Night', 'Vibrant', 'Grainy'],
        settings: {
          filmSimulation: 'Classic Chrome',
          dynamicRange: 'DR400',
          whiteBalance: 5100,
          tintShift: -10,
          wbShiftR: 4,
          wbShiftB: -5,
          colorChrome: 'Strong',
          colorChromeBlue: 'Strong',
          highlights: -2,
          shadows: 1,
          noiseReduction: -4,
          sharpness: 1,
          colorSaturation: 3,
          grainEffect: 'Strong/Large',
        }
      },
      {
        id: 'ilford-hp5',
        name: 'Ilford HP5 Plus',
        iso: 'ISO 1600',
        usedFor: 'Street Photography, Documentary',
        characteristics: 'Classic gritty black and white. Moderate contrast, good latitude.',
        category: ['B&W', 'Street'],
        tags: ['Monochrome', 'Gritty', 'Journalism'],
        settings: {
          filmSimulation: 'ACROS+R',
          dynamicRange: 'DR400',
          whiteBalance: 5500,
          tintShift: 0,
          wbShiftR: 0,
          wbShiftB: 0,
          colorChrome: 'Off',
          colorChromeBlue: 'Off',
          highlights: 2,
          shadows: 2,
          noiseReduction: -4,
          sharpness: 2,
          colorSaturation: 0, // B&W
          grainEffect: 'Strong/Large',
        }
      }
    ]
  },
  {
    id: 'osan-bilgi',
    name: 'Osan Bilgi Collection',
    author: 'Osan Bilgi',
    recipes: [
      {
        id: 'classic-cuban',
        name: 'Classic Cuban Neg',
        iso: 'ISO Auto',
        usedFor: 'Sunny Days, Street',
        characteristics: 'Deep nostalgic reds and teal skies. Looks like a 1950s postcard.',
        category: ['Travel', 'Street'],
        tags: ['Nostalgia', 'Teal', 'Red'],
        settings: {
          filmSimulation: 'Classic Neg',
          dynamicRange: 'DR400',
          whiteBalance: 6300,
          tintShift: 5,
          wbShiftR: 4,
          wbShiftB: -4,
          colorChrome: 'Weak',
          colorChromeBlue: 'Weak',
          highlights: -1,
          shadows: 1,
          noiseReduction: -4,
          sharpness: 0,
          colorSaturation: 1,
          grainEffect: 'Weak',
        }
      },
      {
        id: 'cuban-ace',
        name: 'Cuban Ace',
        iso: 'ISO 640',
        usedFor: 'High Contrast Scenes',
        characteristics: 'A punchier version of classic neg with crushed shadows.',
        category: ['Street', 'Professional'],
        tags: ['Punchy', 'Contrast', 'Bold'],
        settings: {
          filmSimulation: 'Classic Neg',
          dynamicRange: 'DR200',
          whiteBalance: 5800,
          tintShift: 0,
          wbShiftR: 2,
          wbShiftB: 2,
          colorChrome: 'Strong',
          colorChromeBlue: 'Weak',
          highlights: 1,
          shadows: 3,
          noiseReduction: -2,
          sharpness: 1,
          colorSaturation: -1,
          grainEffect: 'Strong',
        }
      },
      {
        id: 'summer-chrome',
        name: 'Summer Chrome',
        iso: 'ISO Auto',
        usedFor: 'Beach, Bright Sun',
        characteristics: 'Overexposed look with faded colors. Very vintage.',
        category: ['Landscape', 'Travel'],
        tags: ['Bright', 'Faded', 'Vintage'],
        settings: {
          filmSimulation: 'Classic Chrome',
          dynamicRange: 'DR400',
          whiteBalance: 6700,
          tintShift: 10,
          wbShiftR: 3,
          wbShiftB: -6,
          colorChrome: 'Off',
          colorChromeBlue: 'Strong',
          highlights: -2,
          shadows: -2,
          noiseReduction: -4,
          sharpness: -2,
          colorSaturation: 1,
          grainEffect: 'Off',
        }
      },
      {
        id: 'alpine-negative',
        name: 'Alpine Negative',
        iso: 'ISO 200',
        usedFor: 'Snow, Mountains, Cold',
        characteristics: 'Cool blue tones favored for stark landscapes.',
        category: ['Landscape', 'Nature'],
        tags: ['Cold', 'Blue', 'Crisp'],
        settings: {
          filmSimulation: 'Classic Neg',
          dynamicRange: 'DR200',
          whiteBalance: 4500,
          tintShift: 0,
          wbShiftR: -2,
          wbShiftB: 4,
          colorChrome: 'Weak',
          colorChromeBlue: 'Strong',
          highlights: 0,
          shadows: 1,
          noiseReduction: -3,
          sharpness: 2,
          colorSaturation: 2,
          grainEffect: 'Weak',
        }
      }
    ]
  },
  {
    id: 'mga-collection',
    name: 'MGA Collection',
    author: 'Matt G. A.',
    recipes: [
      {
        id: 'kodachrome-classic',
        name: 'Kodachrome 64',
        iso: 'ISO 200',
        usedFor: 'National Geographic Style',
        characteristics: 'Rich reds, deep blues, and high contrast. The legendary look.',
        category: ['Travel', 'Nature'],
        tags: ['Legendary', 'Rich', 'Contrast'],
        settings: {
          filmSimulation: 'Classic Chrome',
          dynamicRange: 'DR100',
          whiteBalance: 5900,
          tintShift: 15, // Magenta shift
          wbShiftR: 2,
          wbShiftB: -5,
          colorChrome: 'Strong',
          colorChromeBlue: 'Weak',
          highlights: 1,
          shadows: 2,
          noiseReduction: -4,
          sharpness: 1,
          colorSaturation: 1,
          grainEffect: 'Small',
        }
      },
      {
        id: 'mga-portra',
        name: 'Portra 400 (MGA)',
        iso: 'ISO 400',
        usedFor: 'Editorial',
        characteristics: 'A softer, more pink-skewed version of Portra for fashion.',
        category: ['Portrait', 'Professional'],
        tags: ['Fashion', 'Soft', 'Pink'],
        settings: {
          filmSimulation: 'Astia',
          dynamicRange: 'DR400',
          whiteBalance: 5400,
          tintShift: -5,
          wbShiftR: 1,
          wbShiftB: 1,
          colorChrome: 'Off',
          colorChromeBlue: 'Off',
          highlights: -1,
          shadows: -1,
          noiseReduction: -3,
          sharpness: -1,
          colorSaturation: 0,
          grainEffect: 'Off',
        }
      },
      {
        id: 'leica-m10',
        name: 'Leica M10 Monochrome',
        iso: 'ISO 3200',
        usedFor: 'Artistic B&W',
        characteristics: 'Smooth tonal transitions reminiscent of the Monochrom sensor.',
        category: ['B&W', 'Art'],
        tags: ['Smooth', 'Silky', 'Rich'],
        settings: {
          filmSimulation: 'ACROS',
          dynamicRange: 'DR200',
          whiteBalance: 5500,
          tintShift: 0,
          wbShiftR: 0,
          wbShiftB: 0,
          colorChrome: 'Off',
          colorChromeBlue: 'Off',
          highlights: 0,
          shadows: 0,
          noiseReduction: 0,
          sharpness: 0,
          colorSaturation: -4, // Monochrome
          grainEffect: 'Weak',
        }
      },
      {
        id: 'summer-glow',
        name: 'Summer Glow',
        iso: 'ISO 200',
        usedFor: 'Golden Hour',
        characteristics: 'Extremely warm, hazy look for sunsets.',
        category: ['Landscape', 'Nature'],
        tags: ['Warm', 'Haze', 'Sunset'],
        settings: {
          filmSimulation: 'Velvia',
          dynamicRange: 'DR400',
          whiteBalance: 7500,
          tintShift: 20,
          wbShiftR: 6,
          wbShiftB: -6,
          colorChrome: 'Strong',
          colorChromeBlue: 'Off',
          highlights: -2,
          shadows: 1,
          noiseReduction: -4,
          sharpness: -2,
          colorSaturation: -1,
          grainEffect: 'Off',
        }
      }
    ]
  }
];

const CATEGORIES = [
  { id: 'All', label: 'All Films', icon: Film },
  { id: 'Portrait', label: 'Portrait', icon: Heart },
  { id: 'Landscape', label: 'Landscape', icon: Mountain },
  { id: 'Travel', label: 'Travel', icon: MapPin },
  { id: 'B&W', label: 'Monochrome', icon: Sparkles },
  { id: 'Low-Light', label: 'Low Light', icon: Zap },
  { id: 'Professional', label: 'Professional', icon: Camera },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplyRecipe: (settings: DevelopSettings) => void;
}

type TabType = 'browse' | 'ai' | 'saved';

export const FujifilmRecipeGuide: React.FC<Props> = ({ isOpen, onClose, onApplyRecipe }) => {
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  
  // Browse State
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRecipe, setSelectedRecipe] = useState<FilmRecipe | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set(RECIPE_DB.map(p => p.id)));
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<FilmRecipe | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Saved State
  const [savedPack, setSavedPack] = useState<RecipePack>(getUserRecipePack());
  const [copied, setCopied] = useState(false);

  // FP1 Export State
  const [selectedCamera, setSelectedCamera] = useState<CameraModel>(SUPPORTED_CAMERAS[0]);
  const [exportLabel, setExportLabel] = useState('');
  const [customSerial, setCustomSerial] = useState('');
  const [showAdvancedExport, setShowAdvancedExport] = useState(false);

  // Refresh saved pack when tab opens
  useEffect(() => {
    if (isOpen) {
        setSavedPack(getUserRecipePack());
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (selectedRecipe) {
        setExportLabel(selectedRecipe.name);
    }
  }, [selectedRecipe]);

  const togglePack = (id: string) => {
    const next = new Set(expandedPacks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPacks(next);
  };

  const filteredPacks = useMemo(() => {
    if (selectedCategory === 'All') return RECIPE_DB;
    return RECIPE_DB.map(pack => ({
      ...pack,
      recipes: pack.recipes.filter(r => r.category.includes(selectedCategory))
    })).filter(pack => pack.recipes.length > 0);
  }, [selectedCategory]);

  const handleCopy = (recipe: FilmRecipe) => {
    const text = `
Recipe: ${recipe.name}
ISO: ${recipe.iso}
Sim: ${recipe.settings.filmSimulation}
DR: ${recipe.settings.dynamicRange}
WB: ${recipe.settings.whiteBalance}K
Highlight: ${recipe.settings.highlights}
Shadow: ${recipe.settings.shadows}
Color: ${recipe.settings.colorSaturation}
Sharpness: ${recipe.settings.sharpness}
NR: ${recipe.settings.noiseReduction}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFp1 = (recipe: FilmRecipe) => {
    const xml = recipeToFp1(recipe, {
        cameraModel: selectedCamera,
        label: exportLabel || recipe.name,
        customSerial: customSerial || undefined
    });

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(exportLabel || recipe.name).replace(/\s+/g, '_')}.FP1`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
        const recipe = await generateAiRecipe(aiPrompt);
        setGeneratedRecipe(recipe);
    } catch (e) {
        console.error(e);
        alert("Failed to generate recipe. Please try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleLutUpload = async (file: File) => {
     setIsGenerating(true);
     try {
         const content = await file.text();
         const recipe = await analyzeLutToRecipe(file.name, content);
         setGeneratedRecipe(recipe);
     } catch (e) {
         console.error(e);
         alert("Failed to convert LUT to recipe.");
     } finally {
         setIsGenerating(false);
         setDragActive(false);
     }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if(activeTab === 'ai') setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (activeTab === 'ai' && e.dataTransfer.files && e.dataTransfer.files[0]) {
          const file = e.dataTransfer.files[0];
          if (file.name.endsWith('.cube')) {
             handleLutUpload(file);
          } else {
             alert("Please upload a valid .cube file");
          }
      }
  };

  const handleSaveGenerated = () => {
      if (generatedRecipe) {
          saveRecipeToDb(generatedRecipe);
          setSavedPack(getUserRecipePack());
          setActiveTab('saved');
          setGeneratedRecipe(null);
          setAiPrompt('');
      }
  };
  
  const handleDelete = (id: string) => {
      if (confirm('Delete this recipe?')) {
          deleteRecipeFromDb(id);
          setSavedPack(getUserRecipePack());
      }
  };

  const handleDownloadAll = () => {
    let content = "FUJIFILM RECIPE LIBRARY EXPORT\n=============================\n\n";
    const allPacks = [...RECIPE_DB, savedPack];
    allPacks.forEach(pack => {
      if (pack.recipes.length === 0) return;
      content += `[${pack.name}]\n\n`;
      pack.recipes.forEach(r => {
        content += `NAME: ${r.name}\n`;
        content += `SIMULATION: ${r.settings.filmSimulation}\n`;
        content += `USAGE: ${r.usedFor}\n`;
        content += `SETTINGS: WB ${r.settings.whiteBalance}K, H ${r.settings.highlights}, S ${r.settings.shadows}, C ${r.settings.colorSaturation}\n`;
        content += "-----------------------------\n";
      });
      content += "\n";
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuji_recipes_export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyToEditor = (recipe: FilmRecipe) => {
    // Parse grain
    let grainVal = 0;
    const g = recipe.settings.grainEffect.toUpperCase();
    if (g.includes('STRONG')) grainVal = 60;
    else if (g.includes('WEAK') || g.includes('SMALL')) grainVal = 30;

    // Parse sharpness
    // Fuji scale -4 to +4. 
    // Map to 0-100. 
    // 0 -> 20 (Standard)
    const sharpVal = Math.max(0, Math.min(100, (recipe.settings.sharpness * 20) + 20));

    const map: DevelopSettings = {
      exposure: 0,
      contrast: 0,
      temperature: recipe.settings.whiteBalance,
      tint: recipe.settings.tintShift, 
      highlights: recipe.settings.highlights * 15, 
      shadows: recipe.settings.shadows * 15, 
      saturation: recipe.settings.colorSaturation * 10,
      grainAmount: grainVal,
      sharpness: sharpVal,
    };
    onApplyRecipe(map);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex justify-end" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragEnter} onDrop={onDrop}>
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Drag Overlay */}
      {dragActive && (
          <div className="absolute inset-0 z-[120] bg-green-500/20 border-4 border-green-500 border-dashed m-8 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="bg-black text-white px-8 py-4 rounded shadow-2xl animate-bounce font-bold text-xl flex items-center gap-3">
                  <FileCode size={32} />
                  DROP CUBE FILE TO CONVERT
              </div>
          </div>
      )}
      
      <div className="relative w-full max-w-4xl h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 text-black font-bold px-2 py-1 rounded text-xs tracking-wider">RECIPES</div>
            <h2 className="text-lg font-bold text-white tracking-tight">FILM SIMULATION LIBRARY</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadAll} className="p-2 text-zinc-400 hover:text-white transition-colors" title="Download All">
              <Download size={20} />
            </button>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50">
            <button 
                onClick={() => setActiveTab('browse')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'browse' ? 'border-green-500 text-white bg-zinc-800' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
                <Film size={16} />
                Browse Packs
            </button>
             <button 
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'ai' ? 'border-green-500 text-white bg-zinc-800' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
                <Brain size={16} className={activeTab === 'ai' ? "text-green-400" : ""} />
                AI Laboratory
            </button>
            <button 
                onClick={() => setActiveTab('saved')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'saved' ? 'border-green-500 text-white bg-zinc-800' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
            >
                <Save size={16} />
                My Recipes
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* TAB: BROWSE */}
          {activeTab === 'browse' && (
            <div className="flex flex-1 h-full">
                {/* Sidebar: Categories */}
                <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto hidden md:block">
                    <div className="p-4 space-y-1">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-2">Filters</div>
                    {CATEGORIES.map(cat => (
                        <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-all ${
                            selectedCategory === cat.id 
                            ? 'bg-green-500/10 text-green-400 border-l-2 border-green-500' 
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                        >
                        <cat.icon size={16} />
                        <span className="font-medium">{cat.label}</span>
                        </button>
                    ))}
                    </div>
                </div>

                {/* Grid: Recipes */}
                <div className="flex-1 overflow-y-auto bg-[#09090b] p-6">
                    <div className="space-y-8">
                    {filteredPacks.map(pack => (
                        <div key={pack.id} className="animate-in fade-in duration-500">
                        <div 
                            className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2 cursor-pointer group"
                            onClick={() => togglePack(pack.id)}
                        >
                            <div className="flex items-baseline gap-2">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter group-hover:text-green-500 transition-colors">{pack.name}</h3>
                            <span className="text-xs text-zinc-500 font-mono">by {pack.author}</span>
                            </div>
                            <div className="text-zinc-500 group-hover:text-white transition-colors">
                            {expandedPacks.has(pack.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                        </div>
                        
                        {expandedPacks.has(pack.id) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
                                {pack.recipes.map(recipe => (
                                <div 
                                    key={recipe.id}
                                    onClick={() => setSelectedRecipe(recipe)}
                                    className="group bg-zinc-900 border border-zinc-800 hover:border-green-500/50 hover:bg-zinc-800/50 transition-all cursor-pointer rounded-sm overflow-hidden flex flex-col"
                                >
                                    <div className="h-1 bg-zinc-800 group-hover:bg-green-500 transition-colors w-full"></div>
                                    <div className="p-5 flex-1">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="bg-zinc-950 text-zinc-400 border border-zinc-700 text-[10px] font-mono px-1.5 py-0.5 rounded-sm">
                                                {recipe.iso}
                                            </div>
                                            {recipe.category.includes('B&W') && <Sparkles size={12} className="text-zinc-500" />}
                                        </div>
                                        <h4 className="text-lg font-bold text-zinc-200 group-hover:text-white mb-1 leading-tight">{recipe.name}</h4>
                                        <p className="text-xs text-zinc-500 line-clamp-2">{recipe.usedFor}</p>
                                    </div>
                                    <div className="px-5 pb-4 flex flex-wrap gap-1">
                                    {recipe.tags.slice(0,3).map(tag => (
                                        <span key={tag} className="text-[9px] uppercase font-bold text-zinc-600 bg-black/20 px-1.5 py-0.5 rounded-sm">#{tag}</span>
                                    ))}
                                    </div>
                                </div>
                                ))}
                            </div>
                        )}
                        </div>
                    ))}
                    </div>
                </div>
            </div>
          )}

          {/* TAB: AI LABORATORY */}
          {activeTab === 'ai' && (
              <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
                  <div className="max-w-2xl w-full space-y-8">
                      <div className="text-center space-y-2">
                          <h3 className="text-2xl font-black text-white uppercase tracking-tight">AI Recipe Generator</h3>
                          <p className="text-zinc-400 text-sm">Create new recipes from text descriptions, movie vibes, or convert 3D LUTs to Recipe Settings.</p>
                      </div>

                      {/* LUT UPLOAD */}
                      <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 relative group border-dashed hover:border-green-500 transition-colors cursor-pointer">
                          <input 
                              type="file" 
                              accept=".cube"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              onChange={(e) => e.target.files && e.target.files[0] && handleLutUpload(e.target.files[0])}
                          />
                          <div className="flex flex-col items-center gap-3 text-zinc-500 group-hover:text-green-400 transition-colors">
                             <Upload size={32} />
                             <div className="text-center">
                                 <p className="font-bold text-sm uppercase tracking-wider">Convert .CUBE to FP1 Recipe</p>
                                 <p className="text-xs font-mono mt-1">Drag file here or click to browse</p>
                             </div>
                          </div>
                      </div>

                      <div className="flex items-center gap-4">
                          <div className="h-[1px] bg-zinc-800 flex-1"></div>
                          <span className="text-xs font-mono text-zinc-600 uppercase">OR</span>
                          <div className="h-[1px] bg-zinc-800 flex-1"></div>
                      </div>

                      {/* TEXT PROMPT */}
                      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-sm space-y-4">
                          <div>
                              <label className="text-xs font-bold text-green-500 uppercase tracking-wider mb-2 block">
                                  Generate from Description / Text
                              </label>
                              <textarea 
                                  className="w-full h-32 bg-black border border-zinc-700 rounded-sm p-4 text-zinc-300 text-sm focus:outline-none focus:border-green-500 transition-colors resize-none font-mono"
                                  placeholder="Examples:&#10;- 'A moody Wes Anderson look with pastel yellows'&#10;- 'Cyberpunk city night with neon blues'&#10;- Paste recipe text from fujixweekly.com..."
                                  value={aiPrompt}
                                  onChange={(e) => setAiPrompt(e.target.value)}
                              />
                          </div>
                          <button 
                            onClick={handleGenerate}
                            disabled={isGenerating || !aiPrompt.trim()}
                            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-all"
                          >
                              {isGenerating ? <Brain className="animate-pulse" /> : <Sparkles />}
                              {isGenerating ? 'Analyzing...' : 'Generate Recipe'}
                          </button>
                      </div>

                      {generatedRecipe && (
                          <div className="animate-in slide-in-from-bottom-4 duration-500 border border-green-500/30 rounded-sm overflow-hidden">
                              <div className="bg-zinc-900 p-4 border-b border-zinc-800 flex justify-between items-center">
                                  <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Result</span>
                                  <div className="flex gap-2">
                                      <button onClick={() => setGeneratedRecipe(null)} className="text-zinc-500 hover:text-white text-xs uppercase">Discard</button>
                                  </div>
                              </div>
                              <div className="bg-black p-6">
                                  <h4 className="text-xl font-bold text-white mb-2">{generatedRecipe.name}</h4>
                                  <p className="text-sm text-zinc-400 mb-6">{generatedRecipe.characteristics}</p>
                                  
                                  <div className="grid grid-cols-2 gap-y-2 text-xs font-mono text-zinc-500 mb-6">
                                      <div className="flex justify-between border-b border-zinc-900 pb-1"><span>Sim</span> <span className="text-zinc-300">{generatedRecipe.settings.filmSimulation}</span></div>
                                      <div className="flex justify-between border-b border-zinc-900 pb-1"><span>WB</span> <span className="text-zinc-300">{generatedRecipe.settings.whiteBalance}K</span></div>
                                      <div className="flex justify-between border-b border-zinc-900 pb-1"><span>High</span> <span className="text-zinc-300">{generatedRecipe.settings.highlights}</span></div>
                                      <div className="flex justify-between border-b border-zinc-900 pb-1"><span>Shadow</span> <span className="text-zinc-300">{generatedRecipe.settings.shadows}</span></div>
                                  </div>

                                  <div className="flex gap-3">
                                      <button onClick={() => applyToEditor(generatedRecipe)} className="flex-1 py-2 border border-zinc-700 hover:bg-zinc-900 text-zinc-300 text-xs font-bold uppercase rounded-sm">Apply to DNG</button>
                                      <button onClick={() => handleDownloadFp1(generatedRecipe)} className="flex-1 py-2 border border-zinc-700 hover:bg-zinc-900 text-zinc-300 text-xs font-bold uppercase rounded-sm flex items-center justify-center gap-2"><FileCode size={12}/> Download FP1</button>
                                      <button onClick={handleSaveGenerated} className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-black text-xs font-bold uppercase rounded-sm">Save to Library</button>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* TAB: SAVED RECIPES */}
          {activeTab === 'saved' && (
              <div className="flex-1 overflow-y-auto bg-[#09090b] p-6">
                  <div className="max-w-5xl mx-auto">
                      <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-black text-white uppercase tracking-tight">My Database</h3>
                          <span className="text-xs font-mono text-zinc-500">{savedPack.recipes.length} Recipes stored locally</span>
                      </div>

                      {savedPack.recipes.length === 0 ? (
                          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-sm text-zinc-600">
                              <Save size={32} className="mb-3 opacity-20" />
                              <p className="uppercase text-xs font-bold tracking-widest">No Saved Recipes</p>
                              <button onClick={() => setActiveTab('ai')} className="mt-4 text-green-500 hover:text-green-400 text-xs underline">Create in Lab</button>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {savedPack.recipes.map(recipe => (
                                  <div key={recipe.id} className="group bg-zinc-900 border border-zinc-800 hover:border-green-500/50 transition-all rounded-sm overflow-hidden relative">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(recipe.id); }}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-zinc-500 hover:text-red-500 hover:bg-black rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                      
                                      <div onClick={() => setSelectedRecipe(recipe)} className="cursor-pointer">
                                          <div className="h-1 bg-green-900 w-full"></div>
                                          <div className="p-5">
                                              <div className="flex justify-between items-start mb-3">
                                                  <div className="bg-zinc-950 text-zinc-400 border border-zinc-700 text-[10px] font-mono px-1.5 py-0.5 rounded-sm">{recipe.iso}</div>
                                              </div>
                                              <h4 className="text-lg font-bold text-zinc-200 group-hover:text-white mb-1 leading-tight">{recipe.name}</h4>
                                              <p className="text-xs text-zinc-500 line-clamp-2">{recipe.usedFor}</p>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          )}

        </div>
      </div>

      {/* Detail Modal (Nested) */}
      {selectedRecipe && (
        <div className="absolute top-0 right-0 w-full md:w-[400px] h-full bg-[#111] border-l border-zinc-800 shadow-2xl z-[110] flex flex-col animate-in slide-in-from-right duration-300">
          <div className="h-48 bg-zinc-900 relative overflow-hidden shrink-0">
             <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMTgxODE4IiAvPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMjIyIiAvPgo8L3N2Zz4=')] opacity-50"></div>
             <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black to-transparent">
                <div className="flex gap-2 mb-2">
                   {selectedRecipe.category.map(c => (
                      <span key={c} className="text-[9px] font-bold uppercase bg-green-600 text-black px-1.5 py-0.5 rounded-sm">{c}</span>
                   ))}
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none">{selectedRecipe.name}</h2>
             </div>
             <button 
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black text-white rounded-full backdrop-blur-sm transition-all"
             >
                <ArrowRight size={16} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
             <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Characteristics</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{selectedRecipe.characteristics}</p>
             </div>

             <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">Build Recipe</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-mono">
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Simulation</span>
                       <span className="text-green-400 font-bold">{selectedRecipe.settings.filmSimulation}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Dynamic Range</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.dynamicRange}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">White Balance</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.whiteBalance}K</span>
                    </div>
                     <div className="flex flex-col">
                       <span className="text-zinc-500">WB Shift</span>
                       <span className="text-zinc-300">R:{selectedRecipe.settings.wbShiftR} B:{selectedRecipe.settings.wbShiftB}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Highlights</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.highlights}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Shadows</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.shadows}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Color</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.colorSaturation}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Noise Red.</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.noiseReduction}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Chrome FX</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.colorChrome}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-zinc-500">Grain</span>
                       <span className="text-zinc-300">{selectedRecipe.settings.grainEffect}</span>
                    </div>
                </div>
             </div>
             
             {/* Camera Selection Section */}
             <div className="border border-zinc-800 rounded-sm p-4 bg-zinc-900/50">
                  <div className="flex justify-between items-center mb-3">
                     <h3 className="text-xs font-bold text-green-500 uppercase tracking-widest flex items-center gap-2">
                        <Settings size={12} /> Target Camera
                     </h3>
                     <button onClick={() => setShowAdvancedExport(!showAdvancedExport)} className="text-[10px] uppercase text-zinc-500 hover:text-white">
                        {showAdvancedExport ? 'Hide' : 'Edit'}
                     </button>
                  </div>
                  
                  <div className="space-y-3">
                      <div>
                         <label className="text-[10px] text-zinc-500 uppercase block mb-1">Model</label>
                         <div className="relative">
                             <select 
                                value={selectedCamera.deviceId}
                                onChange={(e) => {
                                    const cam = SUPPORTED_CAMERAS.find(c => c.deviceId === e.target.value);
                                    if(cam) setSelectedCamera(cam);
                                }}
                                className="w-full bg-black text-zinc-300 text-xs p-2 rounded-sm border border-zinc-700 appearance-none focus:border-green-500 focus:outline-none"
                             >
                                {SUPPORTED_CAMERAS.map(c => (
                                    <option key={c.deviceId} value={c.deviceId}>{c.name}</option>
                                ))}
                             </select>
                             <ChevronDown className="absolute right-2 top-2 text-zinc-500 pointer-events-none" size={14} />
                         </div>
                      </div>

                      {showAdvancedExport && (
                          <div className="animate-in slide-in-from-top-2">
                              <div className="mb-3">
                                  <label className="text-[10px] text-zinc-500 uppercase block mb-1">In-Camera Label</label>
                                  <input 
                                     type="text" 
                                     value={exportLabel}
                                     onChange={(e) => setExportLabel(e.target.value)}
                                     placeholder={selectedRecipe.name}
                                     className="w-full bg-black text-zinc-300 text-xs p-2 rounded-sm border border-zinc-700 focus:border-green-500 focus:outline-none"
                                  />
                              </div>
                              <div>
                                  <label className="text-[10px] text-zinc-500 uppercase block mb-1">Serial Override (Hex)</label>
                                  <input 
                                     type="text" 
                                     value={customSerial}
                                     onChange={(e) => setCustomSerial(e.target.value)}
                                     placeholder="Auto-generated"
                                     className="w-full bg-black text-zinc-300 text-xs p-2 rounded-sm border border-zinc-700 focus:border-green-500 focus:outline-none font-mono"
                                  />
                              </div>
                          </div>
                      )}
                  </div>
             </div>
          </div>

          <div className="p-6 border-t border-zinc-800 bg-zinc-900 space-y-3">
             <button 
                onClick={() => applyToEditor(selectedRecipe)}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-black font-bold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-colors"
             >
                <Camera size={16} />
                Apply to DNG
             </button>
             <button 
                onClick={() => handleDownloadFp1(selectedRecipe)}
                className="w-full py-3 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-colors"
             >
                <FileCode size={16} />
                Download .FP1
             </button>
             <div className="flex gap-3">
                <button 
                    onClick={() => handleCopy(selectedRecipe)}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-colors"
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
                {activeTab === 'saved' && (
                     <button 
                        onClick={() => { handleDelete(selectedRecipe.id); setSelectedRecipe(null); }}
                        className="flex-1 py-3 bg-zinc-800 hover:bg-red-900/30 text-zinc-300 hover:text-red-500 font-bold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
