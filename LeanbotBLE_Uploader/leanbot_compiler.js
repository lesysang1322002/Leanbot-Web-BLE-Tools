export class LeanbotCompiler {
  #prevHash = "";
  #prevResponse = null;

  onCompileSucess = null;
  onCompileError = null;
  onCompileProgress = null;

  async compile(sourceCode, compileServer = "ide-server-qa.leanbot.space") {
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

    const startMs = Date.now();
    const predictedTotal = 10;

    const emitProgress = () => {
      const elapsedTime = (Date.now() - startMs) / 1000;
      const estimatedTotal = Math.sqrt(elapsedTime ** 2 + predictedTotal ** 2);
      if (this.onCompileProgress) this.onCompileProgress(elapsedTime, estimatedTotal);
    };

    const progressTimer = setInterval(emitProgress, 500); // emit progress every 500ms

    try {
      const compileResult = await this.#requestCompile(payload, compileServer);

      const elapsedTime = (Date.now() - startMs) / 1000;
      if (this.onCompileProgress) this.onCompileProgress(elapsedTime, elapsedTime);

      if (compileResult.hex && compileResult.hex.trim() !== "") {
        if (this.onCompileSucess) this.onCompileSucess(compileResult.log);
      } else {
        if (this.onCompileError) this.onCompileError(compileResult.log);
      }

      return compileResult;
    } catch (err) {
      const message = err.message || String(err);
      if (this.onCompileProgress) this.onCompileProgress(1, 1);
      if (this.onCompileError)    this.onCompileError(message);
      throw err;
    } finally {
      clearInterval(progressTimer);
    }
  }

  async #requestCompile(payload, compileServer) {
    const payloadHash = SparkMD5.hash( JSON.stringify({ payload, compileServer }) );

    if (payloadHash === this.#prevHash) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // simulate network delay
      return this.#prevResponse;
    }

    const res = await fetch(`https://${compileServer}/v3/compile_`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Compile HTTP ${res.status}`);

    this.#prevResponse = await res.json(); // { hex: base64, log: "..." }
    this.#prevHash = payloadHash;
    return this.#prevResponse;
  }
}