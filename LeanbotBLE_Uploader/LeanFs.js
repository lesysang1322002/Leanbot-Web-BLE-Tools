export class LeanbotFs{
    static #LS_KEY_TREE = "leanbot_workspace_tree";
    static #FILE_KEY_PREFIX = "Workspace_File_";

    static leanfs_TYPE = Object.freeze({
        DIR:        "dir",
        INO:        "ino",
        BLOCKLY:    "blockly",
        YAML:       "yaml",
        OTHERS:     "others"
    });

    #isMountedSuccess = false;
    #textEncoder = null;
    #textDecoder = null;

    #items = {
        root: {
            index: "root", // Always create default root (id = "root")
            isFolder: true,
            children: [],
            data: "Workspace"
        },
    };
    
    constructor(){
        // Enforce to always create New Object
        if (!new.target) {
            throw new Error("LeanbotFs must be called with 'new'");
        }

        this.#isMountedSuccess = false;

        // compress/decompress helper
        this.#textEncoder = new TextEncoder();
        this.#textDecoder = new TextDecoder();

    }

    async mount(StaticTreeDataProvider){
        try{
            // Restore workspace from localStorage if available (overwrites items, root UUID, and currentID).
            await this.#loadWorkspaceFromLocalStorage(); 

            this.#rebuildParents();
            // console.log("items:", this.#items)

            const dataProvider = new StaticTreeDataProvider(this.#items, (item, data) => ({ ...item, data }));

            this.#isMountedSuccess = true;
            console.log("[MOUNT LEANBOTFS] Mount success");
            return dataProvider;
        }
        catch(e){
            console.error(`[MOUNT LEANBOTFS] Error occur: ${e}`);
            this.#isMountedSuccess = false;
            return null;
        }
    }

    getRoot(){
        if(this.#isMountedSuccess === false) return null;
        return this.#items.root.index;
    }

    getParent(itemUUID) { // Return 
        if (this.#isMountedSuccess === false) return null;
        if (!itemUUID) return null;

        const it = this.#items[itemUUID];
        if (!it) return null;

        const p = it.parent;
        if (!p) return null;

        return this.#items[p] ? p : null;
    }

    getAllChildren(itemUUID) { // Return children array of this one node (if there is any)
        if (!this.#isMountedSuccess) return [];

        if (!itemUUID || !this.#items[itemUUID] || !this.#items[itemUUID].isFolder) return [];

        return (this.#items[itemUUID].children || []).filter(cid => this.#items[cid]);
    }

    isExist(itemUUID){
        return !!itemUUID && !!this.#items[itemUUID];
    }

    isFile(itemUUID){
        return !!itemUUID && !!this.#items[itemUUID] && this.#items[itemUUID].isFolder === false;
    }

    isDir(itemUUID){
        return !!itemUUID && !!this.#items[itemUUID] && this.#items[itemUUID].isFolder === true;
    }

    async createFile(parentUUID, defaultName = null){ // default name = timestamp

        if (!parentUUID || this.#isMountedSuccess === false) return null;

        const name = defaultName || getTimestampName();
        console.log("Creating new file:", name);

        const childUUID = await this.#createItem(parentUUID, false, name);
        return childUUID;
    }

    async createDir(parentUUID, defaultName = null){ // default name = timestamp

        if (!parentUUID || this.#isMountedSuccess === false) return null;

        const name = defaultName || getTimestampName();
        console.log("Creating new dir:", name);

        const childUUID = await this.#createItem(parentUUID, true, name);
        return childUUID;
    }

    // rename file bằng F2
    async reName(itemUUID, newName) {

        if (!itemUUID || this.#isMountedSuccess === false) return;

        const item = this.#items[itemUUID];
        if (!item) return;

        if (item.index === this.getRoot()) return; // NEVER rename root

        item.data = newName;
        await this.#saveWorkspaceTreeToLocalStorage();
    }

    getName(itemUUID){
        if (!itemUUID || !this.#items[itemUUID] || this.#isMountedSuccess === false) return null; // Invalid ID => always return failed
        return this.#items[itemUUID].data;
    }

    getItemType(itemUUID) {

        // Invalid or missing UUID or just failed to mount -> default return unknown type
        if (!itemUUID || this.#isMountedSuccess === false || !this.#items[itemUUID]) return LeanbotFs.leanfs_TYPE.OTHERS;

        // Folders are directories regardless of name or extension (include root)
        if (this.isDir(itemUUID)) return LeanbotFs.leanfs_TYPE.DIR;

        // Extract file extension from the last '.' only
        // Examples:
        //   "a.b.c.txt"   -> "txt"
        //   "file.yaml"   -> "yaml"
        //   "noext"       ->  null (no extension)
        //  ".gitignore"   ->  null (no extension)
        const ext = (() => {
            const name = this.#items[itemUUID].data;
            if (typeof name !== "string") return null;

            const lastDot = name.lastIndexOf(".");
            if (lastDot <= 0 || lastDot === name.length - 1) return null;
            return name.slice(lastDot + 1).toLowerCase();
        })();

        switch (ext) {
            case "ino":
                return LeanbotFs.leanfs_TYPE.INO;
            case "blockly":
                return LeanbotFs.leanfs_TYPE.BLOCKLY;
            case "yaml":
                return LeanbotFs.leanfs_TYPE.YAML;
            default:
                return LeanbotFs.leanfs_TYPE.OTHERS;
        }
    }

    isType(itemUUID, leanfs_TYPE){
        return leanfs_TYPE === this.getItemType(itemUUID);
    }

    async readFile(itemUUID) {
        if (!itemUUID || this.#isMountedSuccess === false) return null;

        if (!this.isFile(itemUUID)) return null;

        const compressed = localStorage.getItem(this.#fileKey(itemUUID));
        if (!compressed) return null;

        return await this.#decompressString(compressed);
    }

    async writeFile(itemUUID, content) {
        if (!itemUUID || this.#isMountedSuccess === false) return;

        if (!this.isFile(itemUUID)) return;

        const prev = await this.readFile(itemUUID);
        if (content === prev) {
            console.log("[writeFile] skipped (unchanged)", itemUUID);
            return;
        }

        const compressed = await this.#compressString(content);
        localStorage.setItem(this.#fileKey(itemUUID), compressed);
    }

    async deleteFile(uuid) {
        if (!uuid || !this.#items[uuid] || this.isFile(uuid) === false) return;

        // gỡ uuid khỏi mọi folder trước, tránh lệch parent sau drag
        this.#removeFromParent(uuid);

        this.#removeItem(uuid);

        this.#rebuildParents();

        await this.#saveWorkspaceTreeToLocalStorage();
    }

    readDir(itemUUID, prefix = "") {
        if (!itemUUID || this.#isMountedSuccess === false) return "";

        const folderNode = this.#items[itemUUID];

        if (!folderNode) return ""; // item not exist
        if (this.isFile(itemUUID)) return `${prefix}${folderNode.data}`; // file => return name

        const lines = [];
        lines.push(folderNode.data + " /"); // folder name

        const children = this.getAllChildren(itemUUID);

        if (children.length === 0) {
            lines.push(`${prefix}└─ Folder empty`); // empty folder
            return lines.join("\n");
        }

        children.forEach((child, index) => {
            const isLast = index === children.length - 1;
            const connector = isLast ? "└─ " : "├─ ";
            const isChildFolder = this.isDir(child);

            const childPrefix = prefix + (isLast ? "   " : "│  "); // next level prefix
            const contentPrefix = isChildFolder
                ? childPrefix
                : prefix + connector; // prefix passed to recursion

            const content = this.readDir(child, contentPrefix); // recursive call

            lines.push(
                isChildFolder
                    ? prefix + connector + content // folder entry
                    : content // file entry
            );
        });

        return lines.join("\n");
    }

    async deleteDir(uuid) {
        if (!uuid || !this.#items[uuid] || this.isDir(uuid) === false) return;

        if(uuid === this.getRoot())return; // NEVER delte root id.

        // gỡ uuid khỏi mọi folder trước, tránh lệch parent sau drag
        this.#removeFromParent(uuid);

        this.#deleteSubTree(uuid);

        this.#rebuildParents();

        await this.#saveWorkspaceTreeToLocalStorage();
    }

    //============================================================
    // Private
    //============================================================

    // === Compress Helper === // 

    /* Uint8Array -> base64 */
    #uint8ToBase64(bytes) {
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
    }

    /* base64 -> Uint8Array */
    #base64ToUint8(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    async #compressString(str) {

        const t1 = performance.now();
        const stream = new Blob([this.#textEncoder.encode(str)])
            .stream()
            .pipeThrough(new CompressionStream('gzip'));

        const buffer = await new Response(stream).arrayBuffer();
        const compressed = this.#uint8ToBase64(new Uint8Array(buffer));

        const t2 = performance.now();
        console.log(`[COMPRESS] ${str.length} -> ${compressed.length} ` +`in ${(t2 - t1).toFixed(2)} ms`);

        return compressed;
    }

    async #decompressString(base64) {

        const t1 = performance.now();
        const bytes = this.#base64ToUint8(base64);

        const stream = new Blob([bytes])
            .stream()
            .pipeThrough(new DecompressionStream('gzip'));

        const buffer = await new Response(stream).arrayBuffer();
        const decompressed = this.#textDecoder.decode(buffer);

        const t2 = performance.now();
        console.log(`[DECOMPRESS] ${base64.length} -> ${decompressed.length} ` +`in ${(t2 - t1).toFixed(2)} ms`);

        return decompressed;
    }

    // === Storage Manage === //

    async #saveWorkspaceTreeToLocalStorage() {
        console.log("Save workspace tree to Local Storage");
        const data = {
            items: this.#items,
        };

        const json = JSON.stringify(data);
        const compressed = await this.#compressString(json);

        localStorage.setItem(LeanbotFs.#LS_KEY_TREE, compressed);
    }

    #fileKey(uuid) {
        return LeanbotFs.#FILE_KEY_PREFIX + uuid;
    }

    async #loadWorkspaceFromLocalStorage() {
        console.log("Load workspace tree from Local Storage");
        try {
            const compressedTree = localStorage.getItem(LeanbotFs.#LS_KEY_TREE);

            if (!compressedTree) {
                console.log("[LS] No workspace found in localStorage");
                return;
            }

            const json = await this.#decompressString(compressedTree);
            const data = JSON.parse(json);

            Object.keys(this.#items).forEach(k => delete this.#items[k]);
            Object.assign(this.#items, data.items || {});

            console.log("[LS] Workspace restored");
        } catch (e) {
            console.error("[LS] Restore failed", e);
        } finally {
            await this.#saveWorkspaceTreeToLocalStorage();
        }
    }

    #removeItem(itemUUID){
        if (!itemUUID || !this.#items[itemUUID]) return;
        localStorage.removeItem(this.#fileKey(itemUUID));
        delete this.#items[itemUUID];
    }

    // === File management === //

    // Gắn parent cho mỗi node, để move nhanh
    #rebuildParents() {
        for (const uuid in this.#items) this.#items[uuid].parent = null;
        for (const uuid in this.#items) {
            const ch = this.#items[uuid].children;
            if (!Array.isArray(ch)) continue;
            for (const cid of ch) if (this.#items[cid]) this.#items[cid].parent = uuid;
        }
    }

    // drag drop, reorder, move folder
    #removeFromParent(childId) {
        let removedParent = null;

        const p = this.#items[childId]?.parent;
        if (p && this.#items[p]?.children) {
            const list = this.#items[p].children;
            const before = list.length;
            this.#items[p].children = list.filter((x) => x !== childId);
            if (this.#items[p].children.length !== before) removedParent = p;
        }

        // fallback: nếu parent bị sai, quét toàn bộ folder để xóa mọi chỗ đang chứa childId
        for (const uuid in this.#items) {
            const it = this.#items[uuid];
            if (!this.isDir(uuid) || !Array.isArray(it.children)) continue;

            const before = it.children.length;
            it.children = it.children.filter((x) => x !== childId);
            if (it.children.length !== before) removedParent = removedParent || uuid;
        }

        return removedParent;
    }

    // === Create New item (file or dir) === // 

    // Thêm file, folder
    async #createItem(parentId, isFolder, defaultName = null) {

        if (!this.#items[parentId]) {
            throw new Error("Invalid parentId: " + parentId);
        }

        console.log("[CREATE] target parentId =", parentId);

        let name = String(defaultName || "").trim();

        if (!isFolder){
            // If name already has an extension (anything after a dot), keep it
            // If not, name = timestamp.ino
            name = /\.[a-zA-Z]+$/.test(name) ? name : ensureInoExtension(createItemName(name));
        }

        const uuid = createUUID();

        this.#items[uuid] = { index: uuid, isFolder, children: [], data: name, parent: parentId };
        console.log("[CREATE] item.parent =", this.#items[uuid].parent);
        this.#items[parentId].children ||= [];
        this.#items[parentId].children.push(uuid);
        console.log(
            "[CHECK] parent contains child =",
            this.#items[parentId].children.includes(uuid)
        );

        await this.#saveWorkspaceTreeToLocalStorage();

        return uuid;
    }

    #deleteSubTree(rootUUID) {
        const root = this.#items[rootUUID];
        if (!root || !this.isDir(rootUUID)) return;

        const stack = [rootUUID];
        const order = [];

        // Collect all nodes
        while (stack.length) {
            const uuid = stack.pop();
            const item = this.#items[uuid];
            if (!item) continue;

            order.push(uuid);

            if (item.isFolder && Array.isArray(item.children)) {
                stack.push(...item.children);
            }
        }

        // Delete bottom-up
        for (let i = order.length - 1; i >= 0; i--) {
            this.#removeItem(order[i]);
        }
    }
}

function createUUID() {
  return crypto.randomUUID();
}

function ensureInoExtension(name) {
  const n = String(name || "").trim();
  if (n === "") return getTimestampName() + ".ino";

  // nếu đã có .ino thì giữ nguyên
  if (n.toLowerCase().endsWith(".ino")) return n;

  // không có đuôi → tự thêm .ino
  return n + ".ino";
}

// Default name: "2025.12.31-08.44.22.ino"
function createItemName(desiredName) {
  let name = String(desiredName || "").trim();
  if (name === "") name = getTimestampName() + ".ino";
  return name;
}

function getTimestampName() {
  const d = new Date();

  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");

  const hh   = String(d.getHours()).padStart(2, "0");
  const mi   = String(d.getMinutes()).padStart(2, "0");
  const sec  = String(d.getSeconds()).padStart(2, "0");

  return `${yyyy}.${mm}.${dd}-${hh}.${mi}.${sec}`;
}

