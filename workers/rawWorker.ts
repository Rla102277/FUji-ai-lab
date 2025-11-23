
// Worker for handling RAW processing via LibRaw WASM
// Expects 'libraw.js' and 'libraw.wasm' to be in the public folder.

// --- HELPER MATH ---
const sRGBToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

self.onmessage = async (e: MessageEvent) => {
  const { fileBuffer } = e.data;

  try {
    // 1. Check if LibRaw is available before importing
    // We use a fetch check first to give a better error message than a generic script error
    try {
        const check = await fetch('/libraw.js', { method: 'HEAD' });
        if (!check.ok) throw new Error("File not found");
    } catch (e) {
        throw new Error("Could not find '/libraw.js' in the public folder. The Quality engine requires LibRaw WASM binaries.");
    }

    // 2. Load the library dynamically
    let LibRawModule;
    try {
        // @ts-ignore
        LibRawModule = await import(/* @vite-ignore */ '/libraw.js');
    } catch (err) {
        throw new Error("Failed to import /libraw.js. " + err);
    }

    // 3. Initialize the Module
    const LibRaw = LibRawModule.default || LibRawModule;
    
    // Handle different factory patterns
    let rawInstance;
    if (typeof LibRaw === 'function') {
        if (LibRaw.prototype && LibRaw.prototype.open) {
             rawInstance = new LibRaw();
        } else {
             rawInstance = await LibRaw(); 
        }
    } else {
        rawInstance = LibRaw;
    }

    if (!rawInstance) throw new Error("Failed to initialize LibRaw instance");

    // 4. Process the Buffer
    let width, height, data;

    // --- STRATEGY A: High Level 'tiff' or 'extract' API ---
    if (rawInstance.extract) {
        const processed = await rawInstance.extract(new Uint8Array(fileBuffer));
        width = processed.width;
        height = processed.height;
        data = processed.data; // Uint8Array (RGB)
    } 
    // --- STRATEGY B: Emscripten FS + specific methods ---
    else if (rawInstance.FS && rawInstance.read_image) {
         const filename = 'input.raw';
         rawInstance.FS.writeFile(filename, new Uint8Array(fileBuffer));
         
         const info = rawInstance.read_image(filename);
         width = info.width;
         height = info.height;
         data = info.data;
         
         try { rawInstance.FS.unlink(filename); } catch(e) {}
    }
    else {
         throw new Error("LibRaw wrapper API not recognized. Ensure libraw.js exports an 'extract' or 'read_image' method.");
    }

    if (!data || !width || !height) {
        throw new Error("LibRaw returned empty data.");
    }

    // 5. Convert to 32-bit Linear Float for Pipeline
    // LibRaw usually returns 8-bit sRGB Gamma Corrected data in simple wrappers.
    // We must linearize it to work with our engine.
    const pixelCount = width * height;
    const floatData = new Float32Array(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
        const r = data[i * 3];
        const g = data[i * 3 + 1];
        const b = data[i * 3 + 2];
        
        floatData[i * 4] = sRGBToLinear(r);
        floatData[i * 4 + 1] = sRGBToLinear(g);
        floatData[i * 4 + 2] = sRGBToLinear(b);
        floatData[i * 4 + 3] = 1.0; // Alpha
    }

    // 6. Send back to Main Thread
    (self as any).postMessage({
        success: true,
        width,
        height,
        data: floatData
    }, [floatData.buffer]);

  } catch (error: any) {
    console.error("WASM Worker Error:", error);
    (self as any).postMessage({
      success: false,
      error: error.message || "Unknown Wasm Error"
    });
  }
};
