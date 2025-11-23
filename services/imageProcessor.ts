

import { LutData, DevelopSettings, ImageMetadata, FloatImage, FilmRecipe, Fp1ExportOptions, CameraModel } from "../types";

// --- CAMERA DATABASE ---

export const SUPPORTED_CAMERAS: CameraModel[] = [
  { name: 'Fujifilm X-T5', deviceId: 'X-T5', versionCode: 'X-T5_0100' },
  { name: 'Fujifilm X100VI', deviceId: 'X100VI', versionCode: 'X100VI_0100' },
  { name: 'Fujifilm X-T4', deviceId: 'X-T4', versionCode: 'X-T4_0100' },
  { name: 'Fujifilm X-T3', deviceId: 'X-T3', versionCode: 'X-T3_0100' },
  { name: 'Fujifilm X100V', deviceId: 'X100V', versionCode: 'X100V_0100' },
  { name: 'Fujifilm X-Pro3', deviceId: 'X-Pro3', versionCode: 'X-Pro3_0100' },
  { name: 'Fujifilm X-H2', deviceId: 'X-H2', versionCode: 'X-H2_0100' },
  { name: 'Fujifilm X-H2S', deviceId: 'X-H2S', versionCode: 'X-H2S_0100' },
  { name: 'Fujifilm X-S20', deviceId: 'X-S20', versionCode: 'X-S20_0100' },
  { name: 'Fujifilm X-S10', deviceId: 'X-S10', versionCode: 'X-S10_0100' },
  { name: 'Fujifilm X-E4', deviceId: 'X-E4', versionCode: 'X-E4_0100' },
  { name: 'Fujifilm GFX 100S', deviceId: 'GFX100S', versionCode: 'GFX100S_0100' },
];

// --- ENGINE CHECKS ---

export const checkEngineAvailability = async (): Promise<boolean> => {
    try {
        const [js, wasm] = await Promise.all([
            fetch('/libraw.js', { method: 'HEAD' }),
            fetch('/libraw.wasm', { method: 'HEAD' })
        ]);
        return js.ok && wasm.ok;
    } catch {
        return false;
    }
};

// --- SAMPLE GENERATOR (Retro Racing Vibe) ---

export const createRetroSample = async (): Promise<File> => {
    const width = 1200;
    const height = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error("Canvas not supported");

    // 1. White Base (Fabric-like)
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, width, height);

    // Add noise texture
    for(let i=0; i<100000; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const gray = Math.random() * 50 + 200;
        ctx.fillStyle = `rgba(${gray},${gray},${gray},0.5)`;
        ctx.fillRect(x,y,2,2);
    }

    // 2. The Racing Stripes (Diagonal)
    ctx.save();
    ctx.translate(width/2, height/2);
    ctx.rotate(-Math.PI / 4); // 45 degree angle
    ctx.translate(-width/2, -height/2);

    const stripeWidth = 120;
    const startX = width * 0.4;
    
    // Green
    ctx.fillStyle = "#009639"; 
    ctx.fillRect(startX - width, -height, stripeWidth, height * 3);
    
    // Yellow
    ctx.fillStyle = "#fcd800";
    ctx.fillRect(startX + stripeWidth - width, -height, stripeWidth, height * 3);
    
    // Red
    ctx.fillStyle = "#d5001c";
    ctx.fillRect(startX + stripeWidth*2 - width, -height, stripeWidth, height * 3);
    
    // Repeat stripes for pattern
    const offset = 600;
     // Green
    ctx.fillStyle = "#009639"; 
    ctx.fillRect(startX + offset - width, -height, stripeWidth, height * 3);
    // Yellow
    ctx.fillStyle = "#fcd800";
    ctx.fillRect(startX + offset + stripeWidth - width, -height, stripeWidth, height * 3);
    // Red
    ctx.fillStyle = "#d5001c";
    ctx.fillRect(startX + offset + stripeWidth*2 - width, -height, stripeWidth, height * 3);


    ctx.restore();

    // 3. Text (Bold Black)
    ctx.save();
    ctx.translate(width/2, height/2);
    ctx.rotate(-Math.PI / 4);
    
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 150px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FUJIRAW", 0, 0);
    
    ctx.font = "bold 40px Share Tech Mono, monospace";
    ctx.fillText("LABORATORY TEST CHART", 0, 80);

    ctx.restore();

    return new Promise(resolve => {
        canvas.toBlob(blob => {
            if(blob) resolve(new File([blob], "racing_sample.jpg", { type: "image/jpeg" }));
        }, 'image/jpeg', 0.95);
    });
};

// --- WORKER INTEGRATION ---

const WORKER_SCRIPT = `
// Math Helper: sRGB Gamma to Linear Float
const sRGBToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

self.onmessage = async (e) => {
  const { fileBuffer } = e.data;

  try {
    // 1. Load the LibRaw Emscripten Module
    // We expect libraw.js to be in the root.
    let Module;
    try {
        const m = await import('/libraw.js');
        Module = m.default || m;
    } catch (err) {
        throw new Error("Driver Error: Could not load /libraw.js. Please check public folder.");
    }

    // 2. Initialize Module
    // Some builds export a factory function (standard Emscripten), others export the instance directly.
    const raw = typeof Module === 'function' ? await Module() : Module;

    let width, height, data;

    // 3. Process the file
    // Strategy: ybouane/LibRaw-Wasm and similar ports typically attach a 'read_image' 
    // helper function to the Module that handles FS I/O and structure access.
    
    if (raw.read_image && raw.FS) {
         // Create a virtual file in Emscripten's FS
         const filename = 'input.raf';
         raw.FS.writeFile(filename, new Uint8Array(fileBuffer));
         
         // Call the C++ helper binding
         const info = raw.read_image(filename);
         width = info.width;
         height = info.height;
         data = info.data; // Usually a Uint8Array view of the heap
         
         // Clean up
         try { raw.FS.unlink(filename); } catch(e) {}
    } 
    