const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {buildSync} = require('esbuild');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tv-layout-'));
try {
 const outfile=path.join(temp,'layout.cjs');
 buildSync({entryPoints:[path.resolve(__dirname,'../src/lib/tvLayout.ts')],outfile,platform:'node',format:'cjs',bundle:true});
 const {getTVLayout}=require(outfile);
 for(const width of [0,320,540,760,1000,1236,1872,2500,NaN])
  for(const height of [0,180,240,300,450,650,900,1500,NaN])
   for(const count of [0,1,5,35])
    for(const requested of [0,4,6,8,12]) {
     const layout=getTVLayout(width,height,count,requested,true);
     assert(layout.columns>=1&&layout.columns<=4);
     assert(layout.pageSize>=1&&layout.pageSize<=12);
     assert(layout.rows>=1&&layout.rows<=3);
     if(requested) assert(layout.pageSize<=requested,'escolha manual é teto, não obriga overflow');
    }
 assert.equal(getTVLayout(500,900,35,12,true).columns,1);
 assert.equal(getTVLayout(750,900,35,12,true).columns,2);
 assert.equal(getTVLayout(1200,900,35,12,true).columns,3);
 assert.equal(getTVLayout(1800,900,35,12,true).columns,4);
 assert(getTVLayout(1200,300,35,12,true).pageSize<getTVLayout(1800,900,35,12,true).pageSize);
 assert.equal(getTVLayout(1800,1500,35,12,true).pageSize,12);
 assert.equal(getTVLayout(750,300,35,12,false).pageSize,12,'fora da apresentação, fluxo natural pode rolar');
 console.log('OK: largura real, altura útil, escolhas manuais como teto, limites de capacidade e fluxo normal.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
