import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const z=require(path.join(process.env.ZOD_TEST_PACKAGE,'index.cjs'));
test('declared upper bound aborts before any invalid element is walked',()=>{
 let calls=0;const el=z.any().superRefine((v,ctx)=>{calls++;ctx.addIssue({code:'custom'});});
 const r=z.array(el).max(2).safeParse(Array(1000).fill(0));
 assert.equal(r.success,false);assert.equal(calls,0);assert.equal(r.error.issues.length,1);
});
