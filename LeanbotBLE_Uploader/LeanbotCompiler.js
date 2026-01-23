export class LeanbotCompiler {
  #prevHash = "";
  #prevResponse = null;

  onCompileSucess = null;
  onCompileError = null;
  onCompileProgress = null;

  #compileStartMs = 0;
  #compileEndMs = 0;

  async compile(sourceCode, compileServer) {
    const sketchName = "LeanbotSketch";

    const payload = {
      fqbn: "arduino:avr:uno",
      files: [
        {
          content: sourceCode,
          name: `${sketchName}/${sketchName}.ino`,
        },
      ],
      flags: { verbose: false, preferLocal: false },
      libs: [],
    };

    this.#compileStartMs = performance.now();
    this.#compileEndMs = 0;
    const predictedTotal = 10000; //10000 ms = 10s

    const emitProgress = () => {
      const elapsedTime = (performance.now() - this.#compileStartMs);
      const estimatedTotal = Math.sqrt(elapsedTime ** 2 + predictedTotal ** 2);
      if (this.onCompileProgress) this.onCompileProgress(elapsedTime, estimatedTotal);
    };

    const progressTimer = setInterval(emitProgress, 500); // emit progress every 500ms

    try {
      const compileResult = await this.#requestCompile(payload, compileServer);

      this.#compileEndMs = performance.now();
      const elapsedTime = (this.#compileEndMs - this.#compileStartMs);

      if (this.onCompileProgress) this.onCompileProgress(elapsedTime, elapsedTime);
      
      if (compileResult.hex && compileResult.hex.trim() !== "") {
        if (this.onCompileSucess) this.onCompileSucess(compileResult.log);
      } else {
        if (this.onCompileError) this.onCompileError(compileResult.log);
      }

      return compileResult;
    } catch (err) { // compile request failed => no response from server
      const message = err.message || String(err);
      this.#compileEndMs = performance.now();
      if (this.onCompileProgress) this.onCompileProgress(1, 1);
      if (this.onCompileError)    this.onCompileError(message);
      console.log("Catch Compile Error:", message);
      // throw err;
    } finally {
      clearInterval(progressTimer);
    }
  }

  async #requestCompile(payload, compileServer) {
    const data = new TextEncoder().encode(JSON.stringify({ payload, compileServer }));
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data); // Returns a array buffer

    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const payloadHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""); // convert bytes to hex string

    if (payloadHash === this.#prevHash) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // simulate network delay
      return this.#prevResponse;
    }

    const res = await fetch(`https://${compileServer}/v3/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Compile HTTP ${res.status}`);

    const result = await res.json(); // { hex, log }
    
    // CHỈ cache khi compile thành công
    if (result.hex && result.hex.trim() !== "") {
      this.#prevHash = payloadHash;
      this.#prevResponse = result;
    } else {
      // compile error → reset cache
      this.#prevHash = "";
      this.#prevResponse = null;
    }

    return result;
  }

  elapsedTimeMs() {
    if (this.#compileEndMs === 0) // if compile not done yet
      return performance.now() - this.#compileStartMs;
    return this.#compileEndMs - this.#compileStartMs;
  }
}