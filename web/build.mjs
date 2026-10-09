// Build a single offline HTML document. Node is a developer tool, never required by users.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(join(root,name),'utf8');
const scripts=['vendor/jszip.min.js','demo-data.js','excel-browser.js','catalogue-model.js','catalogue-store.js','ui.js','catalogue-ui.js'].map(name=>'<script>\n'+read(name).replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n');
const html=read('index.template.html').replace('<!-- STYLES -->','<style>\n'+read('style.css')+'\n</style>').replace('<!-- SCRIPTS -->',scripts);
writeFileSync(join(root,'SEMIN-Marketplace.html'),html);
console.log('Version navigateur construite : web/SEMIN-Marketplace.html');
