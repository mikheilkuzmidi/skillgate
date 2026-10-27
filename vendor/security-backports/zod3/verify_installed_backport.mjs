import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const [manifestFile,packageDirectory]=process.argv.slice(2);
if(!manifestFile||!packageDirectory)throw Error('Usage: node verify_installed_backport.mjs TRUSTED_MANIFEST INSTALLED_PACKAGE_DIRECTORY');
const expected=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const root=fs.realpathSync(packageDirectory);
for(const [relative,hash] of Object.entries(expected.files)){
 if(relative.startsWith('/')||relative.split('/').includes('..'))throw Error('Unsafe manifest path');
 const file=path.join(root,relative),real=fs.realpathSync(file);
 if(!real.startsWith(root+path.sep)||fs.lstatSync(file).isSymbolicLink())throw Error('Backport file escaped its package');
 const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(actual!==hash)throw Error('Backport content changed: '+relative);
}
const present=[];
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isSymbolicLink())throw Error('Unexpected package symlink');if(entry.isDirectory())walk(file);else present.push(path.relative(root,file).split(path.sep).join('/'));}}
walk(root);
const extras=present.filter(name=>!(name in expected.files)&&name!=='.bun-tag');
if(extras.length)throw Error('Unexpected backport files: '+extras.join(', '));
const require=createRequire(import.meta.url);const z=require(path.join(root,'index.cjs'));
let calls=0;const schema=z.array(z.any().superRefine(()=>calls++)).max(1);const r=schema.safeParse([1,2,3]);
assert.equal(r.success,false);assert.equal(calls,0);assert.equal(r.error.issues.length,1);assert.equal(r.error.issues[0].code,'too_big');
const modern=require(path.join(root,'v4/index.cjs'));let modernCalls=0;
const m=modern.map(modern.any().superRefine(()=>modernCalls++),modern.any()).max(1).safeParse(new Map([[1,1],[2,2]]));
assert.equal(m.success,false);assert.equal(modernCalls,0);
const meta=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));assert.equal(meta.name,'zod');assert.equal(meta.version,'3.25.76');assert.equal(meta._securityBackport.vendorRelease,false);
console.log(JSON.stringify({advisory:expected.advisory,status:'verified_local_backport',reportedVendorVersionStillMatchesRawRange:true,sourceArchiveSha256:expected.archiveSha256,verifiedFiles:Object.keys(expected.files).length,installedDirectory:root,v3ElementVisits:calls,v4MapElementVisits:modernCalls,unboundedInputBehavior:'unchanged like upstream fixed release; enforce consumer request/schema limits'}));
