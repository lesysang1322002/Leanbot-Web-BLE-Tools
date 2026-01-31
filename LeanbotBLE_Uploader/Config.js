export class LeanbotConfig{
    #CoreConfig = null;
    #UserConfig = null;
    #LocalConfig = null;

    #IDEConfig = null;
    
    async getIDEConfig(localConfigFile = ""){
        try{
            // ==== Recover IDEConfig From local file ==== //
            this.#CoreConfig = await this.#loadConfigFromURL('./IDECoreConfig.yaml');
            this.#UserConfig = await this.#loadConfigFromURL('./IDEUserConfig.yaml');
            this.#LocalConfig = await this.#loadConfigFromText(localConfigFile);

            this.#IDEConfig = _.defaultsDeep({}, this.#CoreConfig.config, this.#LocalConfig.config, this.#UserConfig.config);
            // console.log(this.#IDEConfig);

            // ==== Update Config from URL Params ==== //
            const params = new URLSearchParams(window.location.search);

            if (this.#IDEConfig?.LeanbotBLE?.EspUploader) {
                const BLE_MaxLength = params.get("BLE_MaxLength");
                const BLE_Interval = params.get("BLE_Interval");

                if (BLE_MaxLength !== null) {
                    this.#IDEConfig.LeanbotBLE.EspUploader.BLE_MaxLength = Number(BLE_MaxLength);
                }

                if (BLE_Interval !== null) {
                    this.#IDEConfig.LeanbotBLE.EspUploader.BLE_Interval = Number(BLE_Interval);
                }
            }
            const mode = params.get("MODE");

            const serverParam = params.get("SERVER");

            // Override server in test mode
            if (this.#IDEConfig.LeanbotCompiler) {
                if (mode === "xyz123") {
                    this.#IDEConfig.LeanbotCompiler.Server = "";
                    console.log("[TEST MODE] Using empty SERVER");
                } else if (serverParam !== null) {
                this.#IDEConfig.LeanbotCompiler.Server = serverParam;
                }
            }

            // === Final IDEConfig === //
            // console.log(this.#IDEConfig);
            return this.#IDEConfig;
        }
        catch(error){
            console.error('Config load failed:', error || "Undefined error");
            return null;
        }
    }

    getUserConfigFile(){
        return this.#UserConfig?.configText || "";
    }

    async #loadConfigFromURL(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Load template failed: ${url} (HTTP ${response.status})`);
        }
        const configText = await response.text();
        const config = jsyaml.load(configText);
        return {config: config, configText: configText};
    }

    async #loadConfigFromText(configText){
        if(configText === "")return {config: null, configText: ""};
        const config = jsyaml.load(configText);
        return {config: config, configText: configText};
    }
}