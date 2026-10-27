import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root=path.dirname(new URL(import.meta.url).pathname);
const require=createRequire(import.meta.url);
const variants={baseline:path.join(root,'baseline-3.25.76/package'),patched:path.join(root,'zod3-security-backport')};
const clean=x=>JSON.parse(JSON.stringify(x));
const modules={};
for(const [name,dir] of Object.entries(variants))modules[name]={cjs:require(path.join(dir,'index.cjs')),esm:await import(pathToFileURL(path.join(dir,'index.js')))};

function boundedProbe(z,count=10000){
 let calls=0,refinements=0;
 const child=z.any().superRefine((value,ctx)=>{calls++;ctx.addIssue({code:'custom',message:'bad element'});});
 const result=z.array(child).max(2,'maximum reached').superRefine(()=>refinements++).safeParse(Array(count).fill(0));
 return {calls,refinements,success:result.success,issues:result.success?[]:clean(result.error.issues)};
}
const before=boundedProbe(modules.baseline.cjs);const after=boundedProbe(modules.patched.cjs);
fs.writeFileSync(path.join(root,'red-green-proof.json'),JSON.stringify({baseline:{calls:before.calls,refinements:before.refinements,issueCount:before.issues.length},patched:{calls:after.calls,refinements:after.refinements,issueCount:after.issues.length},originalRegressionWouldFail:before.calls!==0,patchedPasses:after.calls===0},null,2)+'\n');
test('real oversized-invalid array reproduces original growth and is rejected before walking after backport',()=>{
 assert.equal(before.calls,10000);assert.equal(before.issues.length,10001);assert.equal(after.calls,0);assert.equal(after.refinements,0);assert.equal(after.issues.length,1);
 assert.equal(after.issues[0].code,'too_big');assert.equal(after.issues[0].message,'maximum reached');
});
for(const format of ['cjs','esm']){
 const z=modules.patched[format];
 test(format+': root exports retain the Zod3 surface',()=>{
  assert.deepEqual(Object.keys(z).sort(),Object.keys(modules.baseline[format]).sort());
  assert.equal(typeof z.ZodEffects,'function');assert.equal(z.string()._def.typeName,'ZodString');
 });
 test(format+': max rejects a million-element input without reading any element or iterator',()=>{
  let read=0,iterated=0;const data=new Array(1_000_000);
  Object.defineProperty(data,0,{get(){read++;throw Error('must not inspect an oversized element');}});
  data[Symbol.iterator]=function*(){iterated++;throw Error('must not spread oversized array');};
  const start=performance.now();const r=z.array(z.string()).max(2).safeParse(data);
  assert.equal(r.success,false);assert.equal(read,0);assert.equal(iterated,0);assert.equal(r.error.issues.length,1);
  assert.equal(r.error.issues[0].maximum,2);assert.ok(performance.now()-start<1000);
 });
 test(format+': exact array length rejects the too-large side before child parsers',()=>{
  let calls=0;const el=z.any().superRefine(()=>calls++);
  const r=z.array(el).length(2,'exactly two').safeParse([1,2,3]);
  assert.equal(calls,0);assert.equal(r.success,false);assert.deepEqual(clean(r.error.issues),[{code:'too_big',maximum:2,type:'array',inclusive:true,exact:true,message:'exactly two',path:[]}]);
 });
 test(format+': async array bounds abort before async refinements are scheduled',async()=>{
  let calls=0;const r=await z.array(z.any().superRefine(async()=>calls++)).max(1).safeParseAsync([1,2,3]);
  assert.equal(r.success,false);assert.equal(calls,0);assert.equal(r.error.issues.length,1);
 });
 test(format+': set max and exact size reject before touching values',()=>{
  for(const schema of [z.set(z.any()).max(1),z.set(z.any()).size(1)]){
   let iterations=0;const s=new Set([1,2,3]);s.values=()=>{iterations++;throw Error('must not iterate oversized set');};
   const r=schema.safeParse(s);assert.equal(r.success,false);assert.equal(iterations,0);assert.equal(r.error.issues.length,1);assert.equal(r.error.issues[0].type,'set');
  }
 });
 test(format+': fixed tuple aborts before spreading oversized input; rest tuples still work',()=>{
  const data=['a',2];let spread=0;data[Symbol.iterator]=function*(){spread++;throw Error('must not spread oversized tuple');};
  const r=z.tuple([z.string()]).safeParse(data);assert.equal(r.success,false);assert.equal(spread,0);assert.equal(r.error.issues.length,1);
  assert.deepEqual(z.tuple([z.string()]).rest(z.number()).parse(['a',2,3]),['a',2,3]);
 });
 test(format+': preprocess may reduce input before the size gate',()=>{
  const schema=z.preprocess(value=>Array.isArray(value)?value.slice(0,2):value,z.array(z.string()).max(2));
  assert.deepEqual(schema.parse(['a','b','c']),['a','b']);
 });
 test(format+': error maps and nested paths retain their ordinary behavior',()=>{
  const r=z.object({values:z.array(z.string()).max(1)}).safeParse({values:[1,2]},{errorMap:(issue)=>({message:'mapped '+issue.code})});
  assert.equal(r.success,false);assert.deepEqual(r.error.issues[0].path,['values']);assert.equal(r.error.issues[0].message,'mapped too_big');
 });
 test(format+': ordinary valid and invalid schema results match official Zod3',()=>{
  const baseline=modules.baseline[format];
  const fixtures=[
   z=>z.object({name:z.string().trim().min(1),amount:z.coerce.number().int().min(0),roles:z.array(z.enum(['read','write'])).max(4),note:z.string().optional()}).strict(),
   z=>z.union([z.object({kind:z.literal('a'),value:z.number()}),z.object({kind:z.literal('b'),value:z.string()})]),
   z=>z.discriminatedUnion('kind',[z.object({kind:z.literal('a'),value:z.number()}),z.object({kind:z.literal('b'),value:z.string()})]),
   z=>z.record(z.union([z.string(),z.number()])),
   z=>z.map(z.string(),z.number()),
   z=>z.set(z.number()).min(2).max(5),
   z=>z.array(z.number()).min(2).max(5),
   z=>z.array(z.number()).length(3),
   z=>z.tuple([z.string(),z.number().optional()]),
   z=>z.string().transform(value=>value.toUpperCase()).pipe(z.string().min(2)),
   z=>z.string().emoji(),
   z=>z.intersection(z.object({a:z.string()}),z.object({b:z.number()})),
  ];
  const inputs=[
   [{name:' User ',amount:'2',roles:['read']},{name:'',amount:'x',roles:['read',1],unknown:1}],
   [{kind:'a',value:3},{kind:'a',value:'bad'}],
   [{kind:'b',value:'ok'},{kind:'b',value:3}],
   [{a:1,b:'x'},{a:false}],
   [new Map([['a',1]]),new Map([[1,'a']])],
   [new Set([1,2]),new Set([1,'bad'])],
   [[1,2,3],[1,'bad']],
   [[1,2,3],[1]],
   [['a',1],[3,'bad']],
   ['ok','a'],
   ['👨‍👩‍👧‍👦','abc'],
   [{a:'x',b:2},{a:2,b:'x'}],
  ];
  for(let i=0;i<fixtures.length;i++)for(const input of inputs[i]){
   const expected=fixtures[i](baseline).safeParse(input);const actual=fixtures[i](z).safeParse(input);
   assert.equal(actual.success,expected.success,'fixture'+i);
   if(actual.success)assert.deepEqual(actual.data,expected.data,'fixture'+i);
   else assert.deepEqual(clean(actual.error.issues),clean(expected.error.issues),'fixture'+i);
  }
 });
 test(format+': ZodError aliases, formatting and function validation remain compatible',()=>{
  const result=z.object({a:z.string()}).safeParse({a:1});assert.equal(result.success,false);assert.equal(result.error.errors,result.error.issues);
  assert.deepEqual(clean(result.error.flatten()),clean(modules.baseline[format].object({a:modules.baseline[format].string()}).safeParse({a:1}).error.flatten()));
  const fn=z.function().args(z.string()).returns(z.number()).implement(x=>x.length);assert.equal(fn('abc'),3);assert.throws(()=>fn(1),z.ZodError);
 });
 test(format+': unbounded collection behavior is intentionally unchanged, not silently capped',()=>{
  assert.equal(z.array(z.number()).parse(Array(20000).fill(1)).length,20000);
  assert.equal(z.set(z.number()).parse(new Set(Array.from({length:1000},(_,i)=>i))).size,1000);
  assert.equal(z.map(z.string(),z.number()).parse(new Map([['a',1]])).size,1);
 });
}
for(const format of ['cjs','esm']){
 const dir=variants.patched;const load=async file=>format==='cjs'?require(path.join(dir,file.replace('.js','.cjs'))):await import(pathToFileURL(path.join(dir,file)));
 const v4=await load('v4/index.js'),mini=await load('v4/mini/index.js'),core=await load('v4/core/index.js');
 test(format+': maintained v4 array,set,map upper bounds are guarded',()=>{
  let calls=0;const el=v4.any().superRefine(()=>calls++);
  for(const [schema,input] of [[v4.array(el).max(1),[1,2]],[v4.set(el).max(1),new Set([1,2])],[v4.map(el,el).max(1),new Map([[1,1],[2,2]])]]){
   const r=schema.safeParse(input);assert.equal(r.success,false);assert.equal(r.error.issues.length,1);
  }assert.equal(calls,0);
 });
 test(format+': v4 mini and core exported parse paths retain fixed upper bounds',()=>{
  let calls=0;const el=mini.any().check(mini.superRefine(()=>calls++));
  const arr=mini.array(el).check(mini.maxLength(1));const r=mini.safeParse(arr,[1,2]);assert.equal(r.success,false);assert.equal(calls,0);
  const r2=core.safeParse(v4.array(v4.string()).max(1),[1,2]);assert.equal(r2.success,false);assert.equal(r2.error.issues.length,1);
 });
}
test('package identity, license, old export map and source conditions remain truthful',()=>{
 const old=JSON.parse(fs.readFileSync(path.join(variants.baseline,'package.json'))),current=JSON.parse(fs.readFileSync(path.join(variants.patched,'package.json')));
 assert.equal(current.name,'zod');assert.equal(current.version,'3.25.76');assert.deepEqual(current.exports,old.exports);assert.equal(current._securityBackport.vendorRelease,false);
 assert.equal(fs.readFileSync(path.join(variants.patched,'LICENSE'),'utf8'),fs.readFileSync(path.join(variants.baseline,'LICENSE'),'utf8'));
});
for(const format of ['cjs','esm']){
 const dir=variants.patched;
 const v4=format==='cjs'?require(path.join(dir,'v4/index.cjs')):await import(pathToFileURL(path.join(dir,'v4/index.js')));
 const compiler=format==='cjs'?require(path.join(dir,'v4/core/compile.cjs')):await import(pathToFileURL(path.join(dir,'v4/core/compile.js')));
 test(format+': compiled v4 collection bounds reject before element access or iteration',()=>{
  const a=new Array(10000);Object.defineProperty(a,0,{get(){throw Error('compiled array walked oversized input');}});
  const s=new Set([1,2]);s.values=()=>{throw Error('compiled set iterated oversized input');};s[Symbol.iterator]=()=>{throw Error('compiled set iterated oversized input');};
  const m=new Map([[1,1],[2,2]]);m.entries=()=>{throw Error('compiled map iterated oversized input');};m[Symbol.iterator]=()=>{throw Error('compiled map iterated oversized input');};
  for(const [schema,input] of [[v4.array(v4.string()).max(1),a],[v4.set(v4.string()).max(1),s],[v4.map(v4.string(),v4.string()).max(1),m]]){
   const compiled=compiler.compile(schema,{strict:true});const r=compiled.safeParse(input);assert.equal(r.success,false);assert.equal(r.error.issues.length,1);
  }
 });
}
