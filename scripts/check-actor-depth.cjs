/* global __dirname */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createRequire } = require('node:module'), Module = require('node:module');
const project = path.resolve(__dirname, '..');
const req = createRequire(path.join(project, 'package.json'));
const ts = req('typescript');
const original = Module._load;
let skiaExports;
const shared = value => ({ _isReanimatedSharedValue: true, value, set(next) { this.value = next; } });
Module._load = function (name, parent, main) {
    if (name === '@shopify/react-native-skia' && skiaExports)
        return skiaExports;
    if (name === 'react-native-reanimated')
        return { useDerivedValue: fn => ({ _isReanimatedSharedValue: true, get value() { return fn(); } }), useSharedValue: shared, useFrameCallback: () => ({ setActive() { } }) };
    if (name === 'react-native')
        return { Platform: { OS: 'web' }, PixelRatio: { get: () => 1 }, Image: { resolveAssetSource: x => ({ uri: x }) } };
    return original.call(this, name, parent, main);
};
for (const ext of ['.ts', '.tsx'])
    Module._extensions[ext] = (m, filename) => m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
Module._extensions['.png'] = (m, f) => m.exports = f;
(async () => {
    global.CanvasKit = await req('canvaskit-wasm/bin/full/canvaskit.js')({});
    const headless = req('@shopify/react-native-skia/lib/commonjs/headless'), { Skia } = headless.getSkiaExports();
    const cache = new Map();
    const load = p => { if (!cache.has(p))
        cache.set(p, Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(fs.readFileSync(p)))); return cache.get(p); };
    skiaExports = { ...headless, Skia, rect: (x, y, width, height) => ({ x, y, width, height }), useImage: load };
    const React = req('react'), { Scene } = req('./src/game/Scene.tsx'), { rangePictureIndices, depthInsertionIndex } = req('./src/game/ActorLayers.tsx');
    const { ASSETS } = req('./src/game/assets.ts'), { PROPS, ANIMATED_PROPS, FLOOR_COLOR, WORLD, ARENA, OUTSIDE_COLOR } = req('./src/game/map.ts');
    const sheets = Object.fromEntries(Object.entries(ASSETS).map(([name, p]) => [name, load(p)]));
    const { NPC_ASSETS } = req('./src/game/npcAssets.ts'), { NPC_CELL, NPC_SCALE } = req('./src/game/npc.ts');
    const hero = load(path.join(project, 'assets/assets/characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png'));
    const images = [hero, load(NPC_ASSETS.sheet), load(NPC_ASSETS.idle)];
    const outputDirectory = process.env.DYSTOPIA_RENDER_OUTPUT;
    if (outputDirectory)
        fs.mkdirSync(outputDirectory, { recursive: true });
    const depths = PROPS.filter(p => !p.groundDetail).map(p => p.footprint ? p.footprint.y + p.footprint.height : p.depth).sort((a, b) => a - b);
    const leafCount = 2 ** Math.ceil(Math.log2(depths.length));
    // Exhaustively check every ordered static interval, not just selected frames.
    const leaves = (node) => node >= leafCount ? [node - leafCount] : leaves(node * 2).concat(leaves(node * 2 + 1));
    for (let start = 0; start <= depths.length; start++)
        for (let end = start; end <= depths.length; end++) {
            const nodes = rangePictureIndices(leafCount, start, end), covered = nodes.flatMap(leaves);
            assert.deepEqual(covered, Array.from({ length: end - start }, (_, i) => start + i));
            assert(nodes.length <= 2 * Math.ceil(Math.log2(leafCount)));
        }
    for (let i = 0; i < depths.length; i++)
        assert(depthInsertionIndex(depths, depths[i]) > i);
    const propsByDepth = PROPS.filter(p => !p.groundDetail).sort((a, b) => (a.footprint ? a.footprint.y + a.footprint.height : a.depth) - (b.footprint ? b.footprint.y + b.footprint.height : b.depth));
    const cases = [
        { name: 'market', center: { x: 1480, y: 1250 }, props: propsByDepth.filter(p => p.destination.x > 1100 && p.destination.x < 1600).slice(0, 4) },
        { name: 'kilns', center: { x: 2330, y: 1550 }, props: ANIMATED_PROPS },
        { name: 'ruins', center: { x: 650, y: 1820 }, props: propsByDepth.filter(p => p.destination.x < 900 && p.destination.y > 1400 && p.destination.y < 2000).slice(0, 5) }
    ];
    const { cameraScale } = req('./src/game/camera.ts');
    let total = 0;
    for (const test of cases) {
        const actors = [];
        for (const prop of test.props) {
            const d = prop.destination, depth = prop.footprint ? prop.footprint.y + prop.footprint.height : prop.depth;
            for (const delta of [-25, 0, 25]) {
                const idle = actors.length % 4 === 0;
                actors.push({ id: actors.length + 1, image: idle ? 2 : 1, source: { x: idle ? 0 : NPC_CELL.width * (actors.length % 9), y: idle ? 0 : NPC_CELL.height, width: NPC_CELL.width, height: NPC_CELL.height }, x: d.x + d.width * (.25 + .25 * (actors.length % 3)), y: depth + delta, depth: depth + delta, scale: NPC_SCALE, pivotX: NPC_CELL.pivotX, pivotY: NPC_CELL.pivotY, facingX: actors.length % 2 ? 1 : -1, visible: true });
            }
        }
        actors.push({ id: 0, image: 0, source: { x: 90 * 2, y: 37 * 7, width: 90, height: 37 }, x: test.center.x, y: test.center.y + 35, depth: test.center.y + 35, scale: 1.75, pivotX: 28, pivotY: 34, facingX: 1, visible: true });
        const all = actors.map(x => ({ ...x, imageObject: images[x.image] }));
        for (const prop of ANIMATED_PROPS) {
            const s = prop.source, d = prop.destination, frame = (Math.floor(500 * prop.animation.fps / 1000) + prop.animation.phase) % prop.animation.frames;
            all.push({ id: -all.length - 1, imageObject: sheets[prop.sheet], source: { ...s, x: s.x + frame * s.width }, x: d.x, y: d.y, depth: prop.footprint ? prop.footprint.y + prop.footprint.height : prop.depth, scale: d.width / s.width, pivotX: 0, pivotY: 0, facingX: 1, visible: true });
        }
        const recorder = Skia.PictureRecorder(), canvas = recorder.beginRecording({ x: 0, y: 0, ...WORLD });
        const drawProp = p => canvas.drawImageRectOptions(sheets[p.sheet], p.source, p.destination, skiaExports.FilterMode.Nearest, skiaExports.MipmapMode.None);
        for (const prop of PROPS.filter(p => p.groundDetail))
            drawProp(prop);
        const events = [...propsByDepth.map((p, order) => ({ depth: p.footprint ? p.footprint.y + p.footprint.height : p.depth, prop: p, order })), ...all.map(actor => ({ depth: actor.depth, actor }))];
        events.sort((a, b) => a.depth - b.depth || (a.prop && b.prop ? a.order - b.order : a.prop ? -1 : b.prop ? 1 : a.actor.id - b.actor.id));
        for (const event of events) {
            if (event.prop)
                drawProp(event.prop);
            else {
                const a = event.actor;
                canvas.save();
                canvas.translate(a.x, a.y);
                canvas.scale(a.facingX, 1);
                canvas.drawImageRectOptions(a.imageObject, a.source, { x: -a.pivotX * a.scale, y: -a.pivotY * a.scale, width: a.source.width * a.scale, height: a.source.height * a.scale }, skiaExports.FilterMode.Nearest, skiaExports.MipmapMode.None);
                canvas.restore();
            }
        }
        const picture = recorder.finishRecordingAsPicture();
        recorder.dispose();
        const width = 1280, height = 592, scale = cameraScale({ width, height }), transform = [{ translateX: width / 2 - test.center.x * scale }, { translateY: height / 2 - test.center.y * scale }, { scale }];
        const shadow = React.createElement(headless.Fill, null, React.createElement(headless.RadialGradient, { c: { x: ARENA.x, y: ARENA.y }, r: ARENA.shadowEnd, positions: [0, ARENA.shadowStart / ARENA.shadowEnd, ARENA.radius / ARENA.shadowEnd, .96, 1], colors: ['transparent', 'transparent', 'rgba(16,13,16,0.46)', 'rgba(16,13,16,0.91)', OUTSIDE_COLOR] }));
        const actual = React.createElement(Scene, { onError: e => { throw e; }, actors: shared(actors.reverse()), actorImages: images, actorCapacity: 25, previewTimeMs: 500 });
        const reference = React.createElement(headless.Group, null, React.createElement(headless.Fill, { color: FLOOR_COLOR }), React.createElement(headless.Picture, { picture }), shadow);
        const results = [];
        for (const [name, node] of [['actual', actual], ['reference', reference]]) {
            const surface = headless.makeOffscreenSurface(width, height);
            const image = await headless.drawOffscreen(surface, React.createElement(headless.Group, { transform }, node));
            if (outputDirectory)
                fs.writeFileSync(path.join(outputDirectory, `npc-depth-${test.name}-${name}.png`), image.encodeToBytes());
            results.push(image.readPixels());
            image.dispose();
            surface.dispose();
        }
        const a = results[0], b = results[1];
        let difference = 0;
        for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i])
                difference++;
        console.log(test.name, { actors: actors.length, differentChannels: difference });
        assert.equal(difference, 0, `${test.name}: actor depth output must match immediate painter order pixel-for-pixel`);
        total += actors.length;
    }
    console.log(`PASS: ${(depths.length + 1) * (depths.length + 2) / 2} static intervals and ${total} actor placements match exact original-alpha painter order.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
