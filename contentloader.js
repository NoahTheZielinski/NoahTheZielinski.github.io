import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore-lite.js";

const firebaseConfig = {
    apiKey: "AIzaSyCfJxEQZ19bCXWzPk9xPciHCex1-04luxs",
    authDomain: "portfolio-website-4972e.firebaseapp.com",
    projectId: "portfolio-website-4972e",
    storageBucket: "portfolio-website-4972e.firebasestorage.app",
    messagingSenderId: "676835549264",
    appId: "1:676835549264:web:69773fbbd6bd78e5dd3155",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const load_info = {
    error_codes: {
        0: {
            error: "None",
            build_description() {return "No errors occurred during the running of this process";}
        }
    },
            
    processes: {
        async *firestoreFetch(current_static_info) {
            yield {
                ...current_static_info,
                progress: {
                    ...current_static_info.progress,
                    percent_complete: 0
                }
            };
        
            const attemptFetch = async (target) => {
                const snapshot = await getDoc(doc(db, "content", target));
                if (!snapshot.exists()) throw new Error(`Document '${target}' does not exist`);
                return snapshot;
            };
        
            let snapshot;
            let resolvedContent = current_static_info.desired_content;
        
            try {
                snapshot = await attemptFetch(resolvedContent);
            } catch (e) {
                console.error(`firestoreFetch failed for '${resolvedContent}', falling back to portfolio`, { e });
                if (resolvedContent !== 'portfolio') {
                    resolvedContent = 'portfolio';
                    try {
                        snapshot = await attemptFetch(resolvedContent);
                    } catch (e2) {
                        console.error(`firestoreFetch portfolio fallback also failed, fatal`, { e2 });
                        return;
                    }
                } else {
                    console.error(`firestoreFetch portfolio fetch failed, fatal`, { e });
                    return;
                }
            }
        
            yield {
                ...current_static_info,
                progress: {
                    processes_complete: [...current_static_info.progress.processes_complete, 'firestoreFetch'],
                    processes_to_go: current_static_info.progress.processes_to_go.filter(p => p !== 'firestoreFetch'),
                    percent_complete: 1.0
                },
                desired_content: resolvedContent,
                elements: snapshot.data().elements
            };
        },

        async *compileElements(current_static_info) {
            yield {
                ...current_static_info,
                progress: {
                    ...current_static_info.progress,
                    percent_complete: 0
                }
            };

            const compiled = compileElements(current_static_info.elements);

            yield {
                ...current_static_info,
                progress: {
                    processes_complete: [...current_static_info.progress.processes_complete, 'compileElements'],
                    processes_to_go: current_static_info.progress.processes_to_go.filter(p => p !== 'compileElements'),
                    percent_complete: 1.0
                },
                compiled
            };
        },

        async *buildCards(current_static_info) {
            yield {
                ...current_static_info,
                progress: {
                    ...current_static_info.progress,
                    percent_complete: 0
                }
            };

            const { compiled } = current_static_info;
            const nodes = {};

            for (const id of compiled.buildOrder) {
                const el = compiled.byId[id];
                if (el.class === 'card') {
                    nodes[id] = buildCard(el);
                } else if (el.class === 'section') {
                    const childNodes = el._resolvedChildren.map(childId => nodes[childId]).filter(Boolean);
                    nodes[id] = buildSection(el, childNodes);
                }
            }

            yield {
                ...current_static_info,
                progress: {
                    processes_complete: [...current_static_info.progress.processes_complete, 'buildCards'],
                    processes_to_go: current_static_info.progress.processes_to_go.filter(p => p !== 'buildCards'),
                    percent_complete: 1.0
                },
                nodes
            };
        },

        async *runLoadScripts(current_static_info) {
            yield {
                ...current_static_info,
                progress: {
                    ...current_static_info.progress,
                    percent_complete: 0
                }
            };

            for (const id of current_static_info.compiled.scripts.load) {
                const el = current_static_info.compiled.byId[id];
                runScript(el.data.src);
            }

            yield {
                ...current_static_info,
                progress: {
                    processes_complete: [...current_static_info.progress.processes_complete, 'runLoadScripts'],
                    processes_to_go: current_static_info.progress.processes_to_go.filter(p => p !== 'runLoadScripts'),
                    percent_complete: 1.0
                }
            };
        },

        async *attachCards(current_static_info) {
            yield {
                ...current_static_info,
                progress: {
                    ...current_static_info.progress,
                    percent_complete: 0
                }
            };

            for (const { id, mountTo } of current_static_info.compiled.roots) {
                const node = current_static_info.nodes[id];
                const mount = document.getElementById(mountTo);

                if (!mount) {
                    console.error(`attachCards: mount point '${mountTo}' not found in DOM for element '${id}'`);
                    continue;
                }

                if (!node) {
                    console.error(`attachCards: no built node found for element '${id}'`);
                    continue;
                }

                mount.appendChild(node);
            }

            yield {
                ...current_static_info,
                progress: {
                    processes_complete: [...current_static_info.progress.processes_complete, 'attachCards'],
                    processes_to_go: current_static_info.progress.processes_to_go.filter(p => p !== 'attachCards'),
                    percent_complete: 1.0
                }
            };
        },

        async *runRunScripts(current_static_info) {
            yield {
                ...current_static_info,
                progress: {
                    ...current_static_info.progress,
                    percent_complete: 0
                }
            };

            for (const id of current_static_info.compiled.scripts.run) {
                const el = current_static_info.compiled.byId[id];
                runScript(el.data.src);
            }

            yield {
                ...current_static_info,
                progress: {
                    processes_complete: [...current_static_info.progress.processes_complete, 'runRunScripts'],
                    processes_to_go: current_static_info.progress.processes_to_go.filter(p => p !== 'runRunScripts'),
                    percent_complete: 1.0
                }
            };
        },
    }
}

export async function* loadContent(desired_content = 'portfolio') {
    let current_static_info = {
        progress: {
            processes_complete: [],
            processes_to_go: Object.keys(load_info.processes),
            percent_complete: 0
        },
        desired_content
    }

    for (const [name, process] of Object.entries(load_info.processes)) {
        if (typeof process === 'function') {
            let updateID = 0;
            for await (const update of process(current_static_info)) {

                console.assert(Object.hasOwn(update, 'progress'),
                    `update malformed by ${name} at update ${updateID}`, { name, update, updateID });

                if (Object.hasOwn(update, 'progress')) {

                    console.assert(Object.hasOwn(update.progress, 'processes_complete'),
                        `processes_complete missing after ${name} update ${updateID}`, { progress: update.progress, name, updateID });
                    console.assert(Array.isArray(update.progress.processes_complete),
                        `processes_complete not array after ${name} update ${updateID}`, { processes_complete: update.progress.processes_complete, name, updateID });

                    console.assert(Object.hasOwn(update.progress, 'processes_to_go'),
                        `processes_to_go missing after ${name} update ${updateID}`, { progress: update.progress, name, updateID });
                    console.assert(Array.isArray(update.progress.processes_to_go),
                        `processes_to_go not array after ${name} update ${updateID}`, { processes_to_go: update.progress.processes_to_go, name, updateID });

                    console.assert(Object.hasOwn(update.progress, 'percent_complete'),
                        `percent_complete missing after ${name} update ${updateID}`, { progress: update.progress, name, updateID });
                    console.assert(Number.isFinite(update.progress.percent_complete),
                        `percent_complete not a number after ${name} update ${updateID}`, { percent_complete: update.progress.percent_complete, name, updateID });

                    if (Array.isArray(update.progress.processes_complete) &&
                        Array.isArray(update.progress.processes_to_go) &&
                        Number.isFinite(update.progress.percent_complete)) {

                        current_static_info = update;
                        updateID++;
                        yield update;

                    } else {
                        console.warn(`${name} yielded malformed update ${updateID}, skipping`, { update });
                        updateID++;
                    }

                } else {
                    console.warn(`${name} yielded update ${updateID} with no progress field, skipping`, { update });
                    updateID++;
                }
            }
        }
    }

    yield current_static_info;
    return;
}


export function compileElements(raw_elements) {
    const VALID_CLASSES = new Set(['card', 'section', 'script']);

    // ─── Output skeleton ────────────────────────────────────────────────────
    const compiled = {
        byId:       {},
        buildOrder: [],
        roots:      [],
        scripts:    { load: [], run: [] },
        errors:     []
    };

    // ─── Helper: push a structured error ────────────────────────────────────
    function addError(code, message, context = {}) {
        compiled.errors.push({ code, message, ...context });
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASS 1 — Ingest, deduplicate, validate required fields
    // ════════════════════════════════════════════════════════════════════════
    const seenIds = new Set();

    for (const raw of raw_elements) {
        const rawId = (raw.id != null && raw.id !== '') ? raw.id : `_missing_id_${seenIds.size}`;

        if (seenIds.has(rawId)) {
            addError('DUPLICATE_ID',
                `Duplicate id '${rawId}' dropped; keeping first occurrence.`,
                { id: rawId }
            );
            continue;
        }
        seenIds.add(rawId);

        const el = {
            id:         rawId,
            class:      raw.class      ?? null,
            parent:     raw.parent     ?? null,
            load_flags: raw.load_flags ?? [],
            data:       raw.data       ?? {},
            _numId:     seenIds.size - 1
        };

        const missingFields = [];
        if (raw.id == null || raw.id === '') missingFields.push('id');
        if (!el.class)                        missingFields.push('class');

        if (missingFields.length > 0) {
            addError('MISSING_REQUIRED_FIELDS',
                `Element is missing required fields: ${missingFields.join(', ')}. Overriding type to "error".`,
                { id: el.id, missingFields }
            );
            el.data = { ...el.data, type: 'error', _originalData: el.data };
        }

        if (el.class && !VALID_CLASSES.has(el.class)) {
            addError('UNKNOWN_CLASS',
                `Element '${el.id}' has unknown class '${el.class}'. Overriding type to "error".`,
                { id: el.id, class: el.class }
            );
            el.data  = { ...el.data, type: 'error' };
            el.class = 'card';
        }

        compiled.byId[el.id] = el;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASS 2 — Resolve section children; validate section types and child counts
    // ════════════════════════════════════════════════════════════════════════

    const claimedBy = {};

    for (const el of Object.values(compiled.byId)) {
        if (el.class !== 'section') continue;

        // --- Validate section type ---
        const VALID_SECTION_TYPES = new Set(['stack', 'split']);
        const sectionType = el.data && el.data.type;

        if (!sectionType || !VALID_SECTION_TYPES.has(sectionType)) {
            addError('UNKNOWN_SECTION_TYPE',
                `Section '${el.id}' has unknown or missing type '${sectionType}'. Overriding to error card.`,
                { id: el.id, type: sectionType }
            );
            el.class = 'card';
            el.data  = { ...el.data, type: 'error' };
            continue;
        }

        const rawChildren    = Array.isArray(el.data && el.data.children) ? el.data.children : [];
        const resolvedChildren = [];

        for (const childId of rawChildren) {
            if (!compiled.byId[childId]) {
                addError('MISSING_REFERENCE',
                    `Section '${el.id}' references unknown child '${childId}'. Removing from child list.`,
                    { sectionId: el.id, missingChildId: childId }
                );
                continue;
            }

            const child = compiled.byId[childId];

            if (child.class === 'script') {
                addError('INVALID_CHILD_TYPE',
                    `Section '${el.id}' references script '${childId}'. Scripts cannot be visually slotted; removing from child list (script will still run).`,
                    { sectionId: el.id, scriptId: childId }
                );
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(claimedBy, childId)) {
                addError('MULTIPLE_PARENTS',
                    `Child '${childId}' is claimed by both section '${claimedBy[childId]}' and section '${el.id}'. Keeping first claim ('${claimedBy[childId]}'); dropping from '${el.id}'.`,
                    { childId, firstClaimant: claimedBy[childId], secondClaimant: el.id }
                );
                continue;
            }

            claimedBy[childId] = el.id;
            resolvedChildren.push(childId);
        }

        // --- split section must have exactly 3 children ---
        if (sectionType === 'split' && resolvedChildren.length !== 3) {
            addError('SPLIT_SECTION_WRONG_CHILD_COUNT',
                `Split section '${el.id}' requires exactly 3 children but has ${resolvedChildren.length}. Overriding to error card.`,
                { id: el.id, childCount: resolvedChildren.length }
            );
            el.class = 'card';
            el.data  = { ...el.data, type: 'error' };
            continue;
        }

        if (rawChildren.length > 0 && resolvedChildren.length === 0) {
            addError('EMPTY_SECTION_AFTER_CLEANUP',
                `Section '${el.id}' has no valid children after reference resolution. Overriding to error card.`,
                { sectionId: el.id }
            );
            el.class = 'card';
            el.data  = { ...el.data, type: 'error' };
        }

        el._resolvedChildren = resolvedChildren;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASS 3 — Topological sort (Kahn's algorithm), leaves first
    // ════════════════════════════════════════════════════════════════════════

    const inDegree = {};

    for (const el of Object.values(compiled.byId)) {
        if (el.class === 'section' && Array.isArray(el._resolvedChildren)) {
            inDegree[el.id] = el._resolvedChildren.length;
        } else {
            inDegree[el.id] = 0;
        }
    }

    const queue     = [];
    const processed = new Set();

    for (const el of Object.values(compiled.byId)) {
        if (inDegree[el.id] === 0) queue.push(el.id);
    }

    while (queue.length > 0) {
        const id = queue.shift();
        if (processed.has(id)) continue;
        processed.add(id);

        const el = compiled.byId[id];

        if (el.class !== 'script') {
            compiled.buildOrder.push(id);
        }

        const parentId = claimedBy[id];
        if (parentId) {
            inDegree[parentId]--;
            if (inDegree[parentId] === 0) {
                queue.push(parentId);
            }
        }
    }

    for (const el of Object.values(compiled.byId)) {
        if (!processed.has(el.id)) {
            addError('CIRCULAR_REFERENCE',
                `Element '${el.id}' is part of a circular reference chain. Back-edge cut; rendering as error card.`,
                { id: el.id }
            );
            el.class = 'card';
            el.data  = { ...el.data, type: 'error', _cycleDetected: true };
            compiled.buildOrder.push(el.id);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASS 4 — Resolve roots & orphans
    // ════════════════════════════════════════════════════════════════════════
    const DEFAULT_MOUNT = 'content_container';

    for (const el of Object.values(compiled.byId)) {
        if (el.class === 'script') continue;

        const isClaimedBySection = Object.prototype.hasOwnProperty.call(claimedBy, el.id);
        if (!isClaimedBySection) {
            if (el.parent && compiled.byId[el.parent]) {
                addError('ORPHANED_ELEMENT',
                    `Element '${el.id}' has parent '${el.parent}' which is another element, not a DOM mount point. Attaching to default mount '${DEFAULT_MOUNT}'.`,
                    { id: el.id, specifiedParent: el.parent, mountTo: DEFAULT_MOUNT }
                );
                compiled.roots.push({ id: el.id, mountTo: DEFAULT_MOUNT });
            } else {
                compiled.roots.push({ id: el.id, mountTo: el.parent ?? DEFAULT_MOUNT });
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PASS 5 — Bucket scripts by load_flags
    // ════════════════════════════════════════════════════════════════════════
    for (const el of Object.values(compiled.byId)) {
        if (el.class !== 'script') continue;

        const flags = Array.isArray(el.load_flags) ? el.load_flags : [];

        if (flags.includes('load')) {
            compiled.scripts.load.push(el.id);
        } else if (flags.includes('run')) {
            compiled.scripts.run.push(el.id);
        } else {
            addError('SCRIPT_MISSING_FLAG',
                `Script '${el.id}' has no 'load' or 'run' flag. Defaulting to 'run'.`,
                { id: el.id }
            );
            compiled.scripts.run.push(el.id);
        }
    }

    return compiled;
}

function runScript(src) {
    try {
        const script = document.createElement('script');
        script.src = src;
        script.onerror = (e) => console.error(`Script '${src}' failed to load`, e);
        document.head.appendChild(script);
    } catch (e) {
        console.error(`Script '${src}' threw during injection`, e);
    }
}

// ── Card building ───────────────────────────────────────────────────────────

function buildCard(el) {
    const type = el.data.type ?? 'basic';

    if (type === 'embedded') return buildEmbeddedCard(el);

    // default: basic card
    const card = document.createElement('div');
    card.classList.add('card');
    card.id = el.id;

    const styleTiers = ['surface', 'raised', 'pop'];
    const tier = el.load_flags.find(f => styleTiers.includes(f)) ?? 'surface';
    card.classList.add(tier);

    if (el.data.header) {
        const header = document.createElement('div');
        header.classList.add('header');
        header.textContent = el.data.header;
        card.appendChild(header);
    }

    for (const p of (el.data.paragraphs ?? [])) {
        const para = document.createElement('div');
        para.classList.add('paragraph');

        if (typeof p === 'string') {
            para.textContent = p;
            card.appendChild(para);
        } else {
            para.textContent = p.text;
            const link = document.createElement('a');
            link.setAttribute('href', p.url);
            link.appendChild(para);
            card.appendChild(link);
        }
    }

    return card;
}

function buildEmbeddedCard(el) {
    const card = document.createElement('div');
    card.classList.add('card', 'card-embedded');
    card.id = el.id;

    const styleTiers = ['surface', 'raised', 'pop'];
    const tier = el.load_flags.find(f => styleTiers.includes(f)) ?? 'surface';
    card.classList.add(tier);

    if (el.data.header) {
        const header = document.createElement('div');
        header.classList.add('header');
        header.textContent = el.data.header;
        card.appendChild(header);
    }

    const wrapper = document.createElement('div');
    wrapper.classList.add('embed-wrapper');

    const iframe = document.createElement('iframe');
    iframe.src = el.data.src ?? '';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');

    wrapper.appendChild(iframe);
    card.appendChild(wrapper);

    return card;
}

// ── Section building ────────────────────────────────────────────────────────

// Returns a lightweight error placeholder node. Used by section builders when
// a required child slot is missing at runtime so we never call appendChild(undefined).
function buildMissingSlotNode(label) {
    const node = document.createElement('div');
    node.classList.add('card', 'surface');
    node.dataset.buildError = 'missing-slot';
    node.textContent = label;
    return node;
}

function buildSection(el, childNodes) {
    const type = el.data?.type;

    if (type === 'stack')  return buildStackSection(el, childNodes);
    if (type === 'split')  return buildSplitSection(el, childNodes);

    // fallback — should never reach here due to compile-time validation
    console.error(`buildSection: unknown type '${type}' for section '${el.id}' — compile-time guard missed it`);
    const err = document.createElement('div');
    err.classList.add('card', 'surface');
    err.id = el.id;
    err.dataset.buildError = 'unknown-section-type';
    err.textContent = `Unknown section type: ${type}`;
    return err;
}

function buildStackSection(el, childNodes) {
    // Empty childNodes means every child failed to build — render an explicit
    // error state rather than silently mounting a ghost container.
    if (childNodes.length === 0) {
        console.error(`buildStackSection: section '${el.id}' has no renderable children`);
        const err = document.createElement('div');
        err.classList.add('card', 'surface');
        err.id = el.id;
        err.dataset.buildError = 'empty-stack';
        if (el.data.header) err.textContent = el.data.header;
        return err;
    }

    const section = document.createElement('div');
    section.classList.add('section', 'section-stack', 'surface');
    section.id = el.id;

    if (el.data.header) {
        const header = document.createElement('div');
        header.classList.add('section-header');
        header.textContent = el.data.header;
        section.appendChild(header);
    }

    const inner = document.createElement('div');
    inner.classList.add('section-stack-inner');

    for (const node of childNodes) {
        inner.appendChild(node);
    }

    section.appendChild(inner);
    return section;
}

function buildSplitSection(el, childNodes) {
    // childNodes[0] = left, childNodes[1] + [2] = right stack.
    // Guard every slot individually: a missing node must become a placeholder,
    // not undefined, so appendChild never throws and the rest of the tree renders.
    const SLOTS = [
        { label: `[missing left child of '${el.id}']` },
        { label: `[missing right-top child of '${el.id}']` },
        { label: `[missing right-bottom child of '${el.id}']` },
    ];

    const slots = SLOTS.map((meta, i) => {
        if (childNodes[i] != null) return childNodes[i];
        console.error(`buildSplitSection: slot ${i} missing for section '${el.id}' — inserting placeholder`);
        return buildMissingSlotNode(meta.label);
    });

    const section = document.createElement('div');
    section.classList.add('section', 'section-split', 'surface');
    section.id = el.id;

    const left = document.createElement('div');
    left.classList.add('section-split-left');
    left.appendChild(slots[0]);

    const right = document.createElement('div');
    right.classList.add('section-split-right');
    right.appendChild(slots[1]);
    right.appendChild(slots[2]);

    section.appendChild(left);
    section.appendChild(right);

    return section;
}