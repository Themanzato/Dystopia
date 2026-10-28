/* global __dirname */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),babel=require('@babel/core');
const filename=path.resolve(__dirname,'../src/ui/ControlSlider.tsx');
const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[[require.resolve('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
function harness(){
 const h={shared:[],refs:[],states:[],queue:[],changes:[],cleanups:[]};let indexes,layouts,effects;
 const shared=v=>({value:v,set(next){this.value=next;}});
 const React={useCallback:f=>f,useMemo:f=>f(),useRef:v=>h.refs[indexes.r++]??(h.refs[indexes.r-1]={current:v}),useState:v=>{const i=indexes.s++;if(!(i in h.states))h.states[i]=v;return [h.states[i],n=>{h.states[i]=n}];},useLayoutEffect:f=>layouts.push(f),useEffect:f=>effects.push(f)};
 const gesture=()=>{const g={config:{},callbacks:{}};for(const k of ['minDistance','maxPointers','shouldCancelWhenOutside','runOnJS'])g[k]=v=>{g.config[k]=v;return g};for(const k of ['onBegin','onUpdate','onFinalize'])g[k]=v=>{g.callbacks[k]=v;return g};h.gestures.push(g);return g;};
 const deps={react:React,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'react-native':{View:'View',Pressable:'Pressable',StyleSheet:{create:v=>v}},'react-native-gesture-handler':{Gesture:{Pan:gesture},GestureDetector:'GestureDetector'},'react-native-reanimated':{__esModule:true,default:{View:'AnimatedView'},useSharedValue:v=>h.shared[indexes.v++]??(h.shared[indexes.v-1]=shared(v)),useAnimatedStyle:f=>{h.styles.push(f);return {current:f}},useFrameCallback:f=>h.frames.push(f)},'react-native-worklets':{scheduleOnRN:(f,...args)=>h.queue.push(()=>f(...args))},'./PixelText':{__esModule:true,default:'PixelText'}};
 const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,require:id=>{assert(id in deps,id);return deps[id]},global:{Error}},{filename});h.api=m.exports;
 h.render=value=>{indexes={r:0,s:0,v:0};layouts=[];effects=[];h.gestures=[];h.styles=[];h.frames=[];h.tree=h.api.default({id:'test-slider',label:'Opacidad',description:'Transparencia',value,min:.15,max:1,onChange:n=>h.changes.push(n)});layouts.forEach(f=>f());effects.forEach(f=>{const cleanup=f();if(cleanup)h.cleanups.push(cleanup)});};
 h.tick=t=>h.frames.forEach(f=>f({timestamp:t}));h.flush=()=>{while(h.queue.length)h.queue.shift()();};h.layout=()=>layouts.forEach(f=>f());return h;
}
function find(tree,id){if(!tree)return;if(Array.isArray(tree))return tree.map(t=>find(t,id)).find(Boolean);return tree.props?.testID===id?tree:find(tree.props?.children,id);}
const h=harness();h.render(1);find(h.tree,'test-slider').props.onLayout({nativeEvent:{layout:{width:216}}});const g=h.gestures[0];assert.equal(g.config.runOnJS,false);
g.callbacks.onBegin({x:12});assert.equal(h.styles[0]().transform[0].translateX,0);
for(let n=0;n<600;n++){
 const x=(n*53)%245-10;g.callbacks.onUpdate({x});h.tick(n*8);
 const ratio=Math.max(0,Math.min(1,(x-12)/192));assert(Math.abs(h.styles[0]().transform[0].translateX-ratio*192)<1e-8);assert(Math.abs(parseFloat(h.styles[1]().width)-ratio*100)<1e-8);assert(h.queue.length<=1,'No backlog can build on a stalled JS thread');
}
assert.equal(h.changes.length,0,'Bar keeps following the pointer without React processing');
g.callbacks.onUpdate({x:156});g.callbacks.onFinalize();h.layout();assert.equal(h.styles[0]().transform[0].translateX,144,'Stale props cannot rewind the released thumb');h.flush();assert.equal(h.changes.at(-1),.79,'Only latest value crosses to draft, not 600 old events');assert.equal(h.changes.length,1);
h.render(.79);h.tick(6000);h.flush();assert(h.changes.every(n=>n===.79));
h.render(.79);const minus=h.tree.props.children[2].props.children[0];minus.props.onPress();assert.equal(h.changes.at(-1),.74,'Buttons retain their immediate 5 percent step');h.render(.74);assert(Math.abs(h.styles[0]().transform[0].translateX-(.74-.15)/.85*192)<1e-8);
h.render(.3);assert(Math.abs(h.styles[0]().transform[0].translateX-(.3-.15)/.85*192)<1e-8,'External selected/default values synchronize immediately');
const q=harness();q.render(.5);q.gestures[0].callbacks.onBegin({x:140});q.tick(100);q.cleanups.forEach(f=>f());q.flush();assert.equal(q.changes.length,0,'A queued sample cannot mutate an unmounted editor');
assert(h.api.sliderValueAt.__initData?.code);const native=vm.runInNewContext(`(${h.api.sliderValueAt.__initData.code})`,{});assert.equal(native.apply({__closure:h.api.sliderValueAt.__closure},[204,216,.15,1]),1);
console.log('Control slider passed: UI-thread continuous tracking through 600 queued/stalled-JS moves; at most one latest-only RN sample; correct final value without rewind; external values, +/- steps, unmount cleanup and native serialized mapping. No hardware latency claim.');
