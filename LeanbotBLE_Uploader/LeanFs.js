export class LeanFs{
    static #LS_KEY_TREE =     "leanbot_workspace_tree";
    static #FILE_KEY_PREFIX = "Workspace_File_";
    static #rootUUID =        "bd70ce61-fc7d-41a5-b0f9-0017e998813a"; // random generate from https://www.uuidgenerator.net/

    static leanfs_TYPE = Object.freeze({
        DIR:        "dir",
        INO:        "ino",
        BLOCKLY:    "blockly",
        YAML:       "yaml",
        OTHERS:     "others"
    });

    #items = {
        [LeanFs.#rootUUID]: {
            index: LeanFs.#rootUUID, // root
            isFolder: true,
            children: [],
            data: "Workspace",
            contentHash: null,
        },
    };
    
    constructor(){
        // Enforce to always create New Object
        if (!new.target) {
            throw new Error("LeanFs must be called with 'new'");
        }
    }

    mount(){
        try{
            // Restore workspace from localStorage if available (overwrites items, root UUID, and currentID).
            this.#loadWorkspaceFromLocalStorage(); 

            this.#rebuildParents();
            // console.log("items:", this.#items)

            console.log("[MOUNT LeanFs] Mount success");
        }
        catch(e){
            alert("Mount LeanFs Failed!");
            throw new Error(`[MOUNT LeanFs] Error occur: ${e}`)
        }
    }

    /**-------------------------------------------------------- */
    /** getItems()
    * Dev-only accessor for StaticTreeDataProvider.
    * Exposes live data; any other use can corrupt filesystem state.
    */
    getItems(){
        return this.#items;
    }
    /**-------------------------------------------------------- */

    getRoot(){
        return LeanFs.#rootUUID;
    }

    getParent(itemUUID) { // Return 
        const it = this.#getItem(itemUUID);
        if(!it) return null;

        const p = this.#getItem(it.parent);
        if(!p)return null;

        return p.index;
    }

    getAllChildren(itemUUID) { // Return children array of this one node (if there is any)
        if(!this.isDir(itemUUID))return [];
        return (this.#items[itemUUID].children || []).filter(cid => this.#items[cid]);
    }

    isExist(itemUUID) {
        return !!this.#getItem(itemUUID);
    }

    isFile(itemUUID) {
        const item = this.#getItem(itemUUID);
        if (!item) return false;
        return item.isFolder === false;
    }

    isDir(itemUUID) {
        const item = this.#getItem(itemUUID);
        if (!item) return false;
        return item.isFolder === true;
    }

    createFile(parentUUID){ // default name = timestamp

        const childUUID = this.#createItem(parentUUID);
        if(!childUUID) return null;

        this.#items[childUUID].isFolder = false; // file
        console.log("Creating new file (uuid):", childUUID);

        return childUUID;
    }

    createDir(parentUUID){ // default name = timestamp

        const childUUID = this.#createItem(parentUUID);
        if(!childUUID) return null;

        this.#items[childUUID].isFolder = true; // dir
        console.log("Creating new Dir (uuid):", childUUID);

        return childUUID;
    }

    // rename file bằng F2
    rename(itemUUID, newName) {

        if (itemUUID === this.getRoot()) return; // NEVER rename root
        
        const item = this.#getItem(itemUUID);
        if (!item) return;

        item.data = newName;
        this.#saveWorkspaceTreeToLocalStorage();
    }

    getName(itemUUID){
        const item = this.#getItem(itemUUID);
        if(!item) return null;
        return item.data;
    }

    getItemType(itemUUID) {

        // Folders are directories regardless of name or extension (include root)
        if (this.isDir(itemUUID)) return LeanFs.leanfs_TYPE.DIR;

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
            if (lastDot <= 0) return null;
            if (lastDot === name.length - 1) return null;
            return name.slice(lastDot + 1).toLowerCase();
        })();

        switch (ext) {
            case "ino":
                return LeanFs.leanfs_TYPE.INO;
            case "blockly":
                return LeanFs.leanfs_TYPE.BLOCKLY;
            case "yaml":
                return LeanFs.leanfs_TYPE.YAML;
            default:
                return LeanFs.leanfs_TYPE.OTHERS;
        }
    }

    isType(itemUUID, leanfs_TYPE){
        return leanfs_TYPE === this.getItemType(itemUUID);
    }

    async readFile(itemUUID) {

        if (!this.isFile(itemUUID)) return null;

        const content = localStorage.getItem(this.#fileKey(itemUUID));

        this.#items[itemUUID].contentHash = await getContentHash(content)
        return content;
    }

    async writeFile(itemUUID, content) {

        if (!this.isFile(itemUUID)) return;

        const oldHash = this.#items[itemUUID].contentHash;
        const newHash = await getContentHash(content);

        if(oldHash === newHash){
            console.log(`[WriteFile] Skip (unchanged) item ${itemUUID}`);
            return;
        }

        localStorage.setItem(this.#fileKey(itemUUID), content);
        this.#items[itemUUID].contentHash = newHash;
        this.#saveWorkspaceTreeToLocalStorage();
        console.log(`[WriteFile] item ${itemUUID}: update hash = ${newHash}`);
    }

    deleteFile(itemUUID) {
        
        if(itemUUID === this.getRoot())return; // NEVER delte root id.
        if (this.isFile(itemUUID) === false) return;

        // gỡ itemUUID khỏi mọi folder trước, tránh lệch parent sau drag
        this.#removeFromParent(itemUUID);

        this.#removeItem(itemUUID);

        this.#rebuildParents();

        this.#saveWorkspaceTreeToLocalStorage();
    }

    readDir(itemUUID, prefix = "") {
        if (!itemUUID) return "";

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

    deleteDir(itemUUID) {
        if (!this.isDir(itemUUID)) return;

        if(itemUUID === this.getRoot())return; // NEVER delte root id.

        const children = [...this.getAllChildren(itemUUID)];
        
        for(const child of children){ // remove subtree
            if(this.isFile(child)) this.deleteFile(child);
            if(this.isDir(child))this.deleteDir(child);
        };
        this.#removeFromParent(itemUUID); // Remove this directory from its parent

        this.#removeItem(itemUUID); // Remove the directory itself

        this.#rebuildParents();

        this.#saveWorkspaceTreeToLocalStorage();
    }

    // find and load from tree with absolute path 
    // e.g: path = test/test.txt => find test.txt inside test inside root.
    getItemByPath(parentUUID, pathString){

        if(!this.isDir(parentUUID))return null; // parentUUID is not dir

        const parts = String(pathString).trim().split("/").filter(Boolean);
        let currentId = parentUUID; // start at parent

        if (!currentId) return null;

        for (const name of parts) {

            const nextId = this.getChildByName(currentId, name);

            if (!nextId) return null;

            currentId = nextId; // go to text level of the tree
        }
        return currentId;
    }

    getChildByName(parentUUID, name){

        if(!this.isDir(parentUUID))return null; // parentUUID is not dir

        const children = this.getAllChildren(parentUUID);

        if (!children.length) return null; // dir is emtpy

        const childUUID  = children.find(
            uuid => this.getName(uuid) === name
        );

        return childUUID ;
    }

    //============================================================
    // Private
    //============================================================

    // === Storage Manage === //

    #saveWorkspaceTreeToLocalStorage() {
        console.log("Save workspace tree to Local Storage");
        const data = {
            items: this.#items,
        };

        const json = JSON.stringify(data)

        localStorage.setItem(LeanFs.#LS_KEY_TREE, json);
    }

    #fileKey(uuid) {
        return LeanFs.#FILE_KEY_PREFIX + uuid;
    }

    #loadWorkspaceFromLocalStorage() {
        console.log("Load workspace tree from Local Storage");
        try {
            const rawTree = localStorage.getItem(LeanFs.#LS_KEY_TREE);

            if (!rawTree) {
                console.log("[LS] No workspace found in localStorage");
                return;
            }
            const data = JSON.parse(rawTree);

            Object.keys(this.#items).forEach(k => delete this.#items[k]);
            Object.assign(this.#items, data.items || {});

                        this.#saveWorkspaceTreeToLocalStorage();
            console.log("[LS] Workspace restored");
        } catch (e) {
            console.error("[LS] Restore failed", e);
            throw e;
        } 
        // finally {
        //     this.#saveWorkspaceTreeToLocalStorage();
        // }
    }

    #getItem(itemUUID){
        if(!itemUUID)return null;
        return this.#items[itemUUID];
    }

    #removeItem(itemUUID){
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

        const parentUUID = this.getParent(childId);
        const p = this.#getItem(parentUUID);

        if (p?.children) {
            const list = p.children;
            const before = list.length;
            p.children = list.filter((x) => x !== childId);
            if (p.children.length !== before) removedParent = parentUUID;
        }

        // fallback: nếu parent bị sai, quét toàn bộ folder để xóa mọi chỗ đang chứa childId
        for (const uuid in this.#items) {
            const it = this.#items[uuid];
            if (!this.isDir(uuid)) continue;
            if (!Array.isArray(it.children)) continue;

            const before = it.children.length;
            it.children = it.children.filter((x) => x !== childId);
            if (it.children.length !== before) removedParent = removedParent || uuid;
        }

        return removedParent;
    }

    // === Create New item (file or dir) === // 

    // Thêm file, folder
    #createItem(parentId) {

        const p = this.#getItem(parentId);
        if(!p)return null;

        console.log("[CREATE] target parentId =", parentId);

        const uuid = createUUID();

        this.#items[uuid] = { index: uuid, isFolder: null, children: [], data: getTimestampName(), parent: parentId, contentHash: null};
        console.log("[CREATE] item.parent =", this.#items[uuid].parent);
        p.children ||= [];
        // p.children.push(uuid);
        p.children.unshift(uuid); // keep newly created items at the top of the list
        console.log(
            "[CHECK] parent contains child =",
            p.children.includes(uuid)
        );

        this.#saveWorkspaceTreeToLocalStorage();

        return uuid;
    }
}

function createUUID() {
  return crypto.randomUUID();
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

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getContentHash(content){
    if(!getContentHash.textEncoder){
        getContentHash.textEncoder = new TextEncoder();
    }

    const data = getContentHash.textEncoder.encode(content ?? "");
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const newHash = bufferToHex(hashBuffer);
    return newHash;
}