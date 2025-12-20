export class LeanbotCompiler {
  #prevHash = "";
  #prevResponse = null;

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

    return await this.#requestCompile(payload, compileServer);
  }

  async #requestCompile(payload, compileServer) {
    const payloadHash = SparkMD5.hash( JSON.stringify({ payload, compileServer }) );

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

    this.#prevResponse = await res.json(); // { hex: base64, log: "..." }
    this.#prevHash = payloadHash;
    return this.#prevResponse;
  }
}