const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=__dirname,extension=path.join(root,'extension');
async function build(){
  await esbuild.build({entryPoints:[path.join(root,'src/converter.js')],bundle:true,globalName:'ZoteroPaste',format:'iife',target:'chrome109',outfile:path.join(extension,'converter.js'),legalComments:'eof',minify:false});
  const vendor=path.join(extension,'vendor');fs.mkdirSync(vendor,{recursive:true});
  const katex=path.dirname(require.resolve('katex/package.json'));
  for(const name of ['katex.min.js','katex.min.css']) fs.copyFileSync(path.join(katex,'dist',name),path.join(vendor,name));
  const fonts=path.join(vendor,'fonts');fs.mkdirSync(fonts,{recursive:true});
  for(const name of fs.readdirSync(path.join(katex,'dist/fonts'))) fs.copyFileSync(path.join(katex,'dist/fonts',name),path.join(fonts,name));
  fs.copyFileSync(path.join(katex,'LICENSE'),path.join(vendor,'KaTeX-LICENSE.txt'));
  const md=path.dirname(require.resolve('markdown-it/package.json'));
  fs.copyFileSync(path.join(md,'LICENSE'),path.join(vendor,'markdown-it-LICENSE.txt'));
  fs.writeFileSync(path.join(vendor,'THIRD-PARTY.txt'),'Bundled: markdown-it 14.1.0 (MIT), KaTeX 0.16.22 (MIT).\nmarkdown-it dependencies: linkify-it (MIT), mdurl (MIT), uc.micro (MIT), punycode.js (MIT), entities (BSD-2-Clause), argparse (Python-2.0).\nFull dependency license texts are included in DEPENDENCY-LICENSES.txt.\n');
  const packages=['markdown-it','linkify-it','mdurl','uc.micro','punycode.js','entities','argparse'];
  let licenses='';for(const pkg of packages){let entry=require.resolve(pkg),dir=path.dirname(entry);while(!fs.existsSync(path.join(dir,'package.json')))dir=path.dirname(dir);const file=fs.readdirSync(dir).find(n=>/^licen[sc]e/i.test(n));if(!file)throw new Error('Missing license: '+pkg);licenses+='\n=== '+pkg+' ===\n'+fs.readFileSync(path.join(dir,file),'utf8');}
  fs.writeFileSync(path.join(vendor,'DEPENDENCY-LICENSES.txt'),licenses);
  console.log('Built extension/converter.js and local preview assets.');
}
build().catch(error=>{console.error(error);process.exit(1);});
