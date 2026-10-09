/* Browser-only OOXML processing. Original ZIP parts are kept; only the target sheet is edited. */
'use strict';
window.BrowserExcel = (() => {
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const KEY = 'semin.marketplace.browser.mappings.v1';
  const files = Object.create(null);
  let prepared = null;
  const aliases = {
    sku:['sku','reference','reference produit','seller sku','item sku','ref'],
    ean:['ean','ean13','gtin','barcode','code barre','product id'],
    name:['nom','titre','designation','product name','item name','title'],
    description:['description','product description'], price:['prix','prix ttc','price','standard price'],
    brand:['marque','brand','brand name'], weight:['poids','weight','item weight'], stock:['stock','quantite','quantity']
  };
  const normalized = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const kind = label => Object.keys(aliases).find(k => aliases[k].includes(normalized(label))) || null;
  const all = (node, name) => [...node.getElementsByTagNameNS(NS, name)];
  const direct = (node, name) => [...node.children].filter(c => c.localName === name && c.namespaceURI === NS);
  const parse = text => {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML avec déclarations externes non pris en charge.');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Structure XML invalide dans le classeur.');
    return doc;
  };
  function colNumber(letters) { return [...letters].reduce((n,c) => n * 26 + c.charCodeAt(0)-64, 0); }
  function colLetter(number) { let s=''; while(number>0){number--;s=String.fromCharCode(65+number%26)+s;number=Math.floor(number/26);} return s; }
  function address(ref) {
    const match = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
    if (!match) throw new Error('Adresse de cellule invalide.');
    return {col:colNumber(match[1]), row:Number(match[2])};
  }
  function resolvePart(base, target) {
    const path = target.startsWith('/') ? target.slice(1) : base.slice(0,base.lastIndexOf('/')+1) + target;
    const segments=[];
    for(const part of path.split('/')){
      if(part==='..'){if(!segments.length)throw new Error('Chemin Excel invalide.');segments.pop();}
      else if(part && part!=='.')segments.push(part);
    }
    return segments.join('/');
  }
  async function xml(zip, path, optional=false){const entry=zip.file(path);if(!entry){if(optional)return null;throw new Error(`Élément Excel absent : ${path}`);}return parse(await entry.async('string'));}
  async function relationships(zip, path) {
    const rels=await xml(zip,path,true);const map=Object.create(null);
    if(rels)for(const node of rels.documentElement.children){if(node.getAttribute('TargetMode')!=='External')map[node.getAttribute('Id')]={target:node.getAttribute('Target'),type:node.getAttribute('Type')};}
    return map;
  }
  // Inspect ZIP directory before decompression; use fixed tablet-friendly bounds.
  function verifyZip(bytes){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
    if(end<0)throw new Error('Fichier Excel invalide ou chiffré.');
    const count=view.getUint16(end+10,true);let pos=view.getUint32(end+16,true),size=0;
    if(count>2000 || count===65535)throw new Error('Classeur trop complexe pour cette version tablette.');
    for(let i=0;i<count;i++){
      if(pos+46>bytes.length || view.getUint32(pos,true)!==0x02014b50)throw new Error('Archive Excel invalide.');
      if(view.getUint16(pos+8,true)&1)throw new Error('Classeur chiffré non pris en charge.');
      size+=view.getUint32(pos+24,true);
      if(size>60*1024*1024)throw new Error('Classeur trop volumineux après décompression (60 Mo maximum).');
      pos+=46+view.getUint16(pos+28,true)+view.getUint16(pos+30,true)+view.getUint16(pos+32,true);
    }
  }
  async function load(file){
    if(!file || !/\.xlsx$/i.test(file.name))throw new Error('Choisissez un fichier .xlsx, sans macro.');
    if(file.size>15*1024*1024)throw new Error('Fichier trop volumineux (15 Mo maximum).');
    const bytes=new Uint8Array(await file.arrayBuffer());verifyZip(bytes);
    const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
    if(Object.keys(zip.files).some(p=>/vbaProject\.bin|^_xmlsignatures\//i.test(p)))throw new Error('Macros et signatures numériques non prises en charge.');
    const book=await xml(zip,'xl/workbook.xml');
    if(book.documentElement.namespaceURI!==NS)throw new Error('Format Excel Strict non pris en charge. Enregistrez une copie au format .xlsx standard.');
    const rels=await relationships(zip,'xl/_rels/workbook.xml.rels');
    const sharedPath=Object.values(rels).find(r=>r.type.endsWith('/sharedStrings'));
    const shared=sharedPath?await xml(zip,resolvePart('xl/workbook.xml',sharedPath.target)):null;
    const strings=shared?all(shared,'si').map(si=>all(si,'t').filter(t=>t.parentElement.localName!=='rPh').map(t=>t.textContent).join('')):[];
    const stylesPath=Object.values(rels).find(r=>r.type.endsWith('/styles'));
    const styles=stylesPath?await xml(zip,resolvePart('xl/workbook.xml',stylesPath.target)):null;
    const formats=Object.fromEntries(styles?all(styles,'numFmt').map(n=>[n.getAttribute('numFmtId'),n.getAttribute('formatCode')]):[]);
    const xfs=styles?all(styles,'cellXfs').flatMap(n=>direct(n,'xf')):[];
    const sheets=[];
    for(const node of all(book,'sheet')){
      const rel=rels[node.getAttributeNS(RNS,'id')];if(!rel || !rel.type.endsWith('/worksheet'))continue;
      const path=resolvePart('xl/workbook.xml',rel.target);const doc=await xml(zip,path);const sheetData=all(doc,'sheetData')[0];
      if(!sheetData)throw new Error('Feuille Excel sans zone de données.');
      const cells=new Map();let maxRow=1,maxCol=1;
      for(const cell of all(sheetData,'c')){
        const ref=cell.getAttribute('r');const a=address(ref);maxRow=Math.max(maxRow,a.row);maxCol=Math.max(maxCol,a.col);cells.set(ref,cell);
      }
      for(const row of direct(sheetData,'row'))maxRow=Math.max(maxRow,Number(row.getAttribute('r')));
      if(maxRow>20000 || maxCol>250)throw new Error('Version tablette limitée à 20 000 lignes et 250 colonnes par feuille.');
      const comments=Object.create(null);
      const slash=path.lastIndexOf('/');const sheetRels=await relationships(zip,path.slice(0,slash+1)+'_rels/'+path.slice(slash+1)+'.rels');
      for(const rel of Object.values(sheetRels).filter(r=>r.type.endsWith('/comments'))){
        const docComments=await xml(zip,resolvePart(path,rel.target));
        for(const comment of all(docComments,'comment'))comments[comment.getAttribute('ref')]=all(comment,'t').map(t=>t.textContent).join('');
      }
      sheets.push({name:node.getAttribute('name'),path,doc,sheetData,cells,maxRow,maxCol,comments});
    }
    if(!sheets.length)throw new Error('Aucune feuille de calcul trouvée.');
    return {zip,sheets,strings,formats,xfs};
  }
  function value(book,cell,identifier=false){
    if(!cell)return null;
    const type=cell.getAttribute('t');const v=direct(cell,'v')[0]?.textContent;
    if(type==='inlineStr')return all(cell,'t').filter(t=>t.parentElement.localName!=='rPh').map(t=>t.textContent).join('');
    if(type==='s')return book.strings[Number(v)] ?? '';
    if(type==='str' || type==='d')return v ?? null;
    if(type==='b')return v==='1';
    if(type==='e')throw new Error(`Erreur Excel dans la cellule ${cell.getAttribute('r')}.`);
    if(v===undefined || v==='')return null;
    const number=Number(v);
    if(!Number.isFinite(number))throw new Error(`Nombre invalide dans ${cell.getAttribute('r')}.`);
    if(identifier){
      if(!Number.isSafeInteger(number))throw new Error(`Identifiant numérique non entier ou trop long dans ${cell.getAttribute('r')}. Fournissez-le en texte.`);
      let result=String(number);
      const format=book.formats[book.xfs[Number(cell.getAttribute('s')||0)]?.getAttribute('numFmtId')];
      if(format && /^0+$/.test(format))result=result.padStart(format.length,'0');
      return result;
    }
    return number;
  }
  function sheet(book,name){const s=book.sheets.find(s=>s.name===name);if(!s)throw new Error('Feuille sélectionnée introuvable.');return s;}
  function columns(book,s,header){
    if(!Number.isInteger(header)||header<1||header>s.maxRow)throw new Error('Ligne d’en-tête invalide.');
    const result=[];
    for(let c=1;c<=s.maxCol;c++){
      const ref=colLetter(c)+header;const v=value(book,s.cells.get(ref));
      if(v!==null && v!==''){
        const label=String(v);result.push({id:String(c),label,kind:kind(label),required:label.includes('*')||/obligatoire|required/i.test(s.comments[ref]||'')});
      }
    }
    if(!result.length)throw new Error('Aucun en-tête sur cette ligne.');return result;
  }
  function catalog(book,s,header,cols){
    const rows=[];
    for(let r=header+1;r<=s.maxRow;r++){
      const values=Object.create(null);
      for(const col of cols){const cell=s.cells.get(colLetter(Number(col.id))+r);
        if(cell && direct(cell,'f').length)throw new Error(`Catalogue : formule en ${cell.getAttribute('r')}. Fournissez des valeurs figées.`);
        values[col.id]=value(book,cell,['sku','ean'].includes(col.kind));
      }
      if(Object.values(values).some(v=>v!==null&&v!==''))rows.push({id:r,values});
    }
    if(!rows.length)throw new Error('Le catalogue ne contient aucun produit.');return rows;
  }
  function suggest(source,target){
    const mapping={};for(const col of target){let matches=source.filter(s=>normalized(s.label)===normalized(col.label));if(!matches.length&&col.kind)matches=source.filter(s=>s.kind===col.kind);mapping[col.id]=matches.length===1?matches[0].id:'';}return mapping;
  }
  function check(payload){
    if(!prepared)throw new Error('Analysez les fichiers avant de continuer.');
    const {mapping,required,selected}=payload;
    const sourceIds=new Set(prepared.source.map(c=>c.id)),targetIds=new Set(prepared.target.map(c=>c.id));
    if(Object.entries(mapping).some(([k,v])=>!targetIds.has(k)||(v&&!sourceIds.has(v))) || required.some(id=>!targetIds.has(id)))throw new Error('Correspondance invalide.');
    const chosen=prepared.rows.filter(r=>selected.includes(r.id));if(!chosen.length)throw new Error('Sélectionnez au moins un produit.');
    const rows=[],errors=[],seen=new Map();
    for(const row of chosen){const values={};for(const col of prepared.target){
      let v=mapping[col.id]?row.values[mapping[col.id]]:null,message=null;
      if(v===null||v===undefined||v===''){v=null;if(required.includes(col.id))message='Champ obligatoire manquant';}
      else if(typeof v==='string'&&/^[=+\-@]/.test(v))message='Valeur ambiguë pouvant être interprétée comme une formule';
      else if(col.kind==='ean'){
        const s=String(v);const valid=/^\d{13}$/.test(s)&&(Array.from(s.slice(0,12)).reduce((n,c,i)=>n+Number(c)*(i%2?3:1),0)+Number(s[12]))%10===0;
        if(!valid)message='EAN-13 invalide (13 chiffres et clé de contrôle)';
      }else if(['price','weight','stock'].includes(col.kind)){
        const raw=String(v).trim().replace(',','.');const number=Number(raw);
        if(!raw||!Number.isFinite(number)||number<0||(col.kind==='stock'&&!Number.isInteger(number)))message='Nombre positif ou nul requis'+(col.kind==='stock'?' et entier':'');else v=number;
      }
      if(v!==null&&v!==''&&['sku','ean'].includes(col.kind)){
        const key=col.id+':'+String(v);if(seen.has(key))message=`Identifiant dupliqué (ligne ${seen.get(key)})`;else seen.set(key,row.id);
      }
      values[col.id]=v;if(message)errors.push({row:row.id,column:col.label,message});
    }rows.push({id:row.id,values});}
    return {rows,errors,count:rows.length};
  }
  function range(ref){const [a,b]=ref.split(':');return {min:address(a),max:address(b||a)};}
  async function exportBook(payload){
    const result=check(payload);if(result.errors.length)throw new Error('Corrigez les erreurs avant export.');
    const book=files.template.book,original=sheet(book,prepared.settings.templateSheet);
    const start=prepared.settings.startRow,last=start+result.count-1;
    if(last>20000)throw new Error('Export limité à 20 000 lignes.');
    if(all(original.doc,'tableParts').length)throw new Error('Templates avec tableaux Excel structurés non pris en charge dans cette première version web.');
    for(const merge of all(original.doc,'mergeCell')){const bounds=range(merge.getAttribute('ref'));if(bounds.min.row<=last&&bounds.max.row>=start&&prepared.target.some(c=>Number(c.id)>=bounds.min.col&&Number(c.id)<=bounds.max.col))throw new Error('La zone de destination contient des cellules fusionnées.');}
    for(let r=start;r<=last;r++)for(const col of prepared.target){const ref=colLetter(Number(col.id))+r,cell=original.cells.get(ref);if(cell&&(direct(cell,'f').length||direct(cell,'v').length||direct(cell,'is').length))throw new Error(`La cellule ${ref} contient déjà une valeur. Choisissez une zone vierge.`);}
    const doc=original.doc.cloneNode(true),sheetData=all(doc,'sheetData')[0];
    const rowMap=new Map(direct(sheetData,'row').map(row=>[Number(row.getAttribute('r')),row]));
    const model=rowMap.get(start);
    for(let i=0;i<result.rows.length;i++){
      const r=start+i;let row=rowMap.get(r);
      if(!row){row=doc.createElementNS(NS,'row');if(model)for(const attr of model.attributes)if(attr.name!=='r')row.setAttribute(attr.name,attr.value);row.setAttribute('r',String(r));const next=direct(sheetData,'row').find(n=>Number(n.getAttribute('r'))>r);sheetData.insertBefore(row,next||null);rowMap.set(r,row);}
      for(const col of prepared.target){const c=Number(col.id),ref=colLetter(c)+r;
        let cell=direct(row,'c').find(n=>n.getAttribute('r')===ref);
        if(!cell){cell=doc.createElementNS(NS,'c');cell.setAttribute('r',ref);const next=direct(row,'c').find(n=>address(n.getAttribute('r')).col>c);row.insertBefore(cell,next||direct(row,'extLst')[0]||null);const modelCell=original.cells.get(colLetter(c)+start);if(modelCell?.hasAttribute('s'))cell.setAttribute('s',modelCell.getAttribute('s'));}
        const v=result.rows[i].values[col.id];if(v===null||v===undefined)continue;
        if(typeof v==='number'&&!['sku','ean'].includes(col.kind)){cell.removeAttribute('t');const node=doc.createElementNS(NS,'v');node.textContent=String(v);cell.append(node);}
        else{cell.setAttribute('t','inlineStr');const inline=doc.createElementNS(NS,'is'),text=doc.createElementNS(NS,'t');text.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');text.textContent=String(v);inline.append(text);cell.append(inline);}
      }
    }
    const dimension=all(doc,'dimension')[0];if(dimension){const bounds=range(dimension.getAttribute('ref'));const maxCol=Math.max(bounds.max.col,...prepared.target.map(c=>Number(c.id)));dimension.setAttribute('ref',`${colLetter(bounds.min.col)}${bounds.min.row}:${colLetter(maxCol)}${Math.max(bounds.max.row,last)}`);}
    for(const validation of all(doc,'dataValidation')){
      const refs=validation.getAttribute('sqref')?.split(/\s+/).filter(Boolean)||[];
      for(const col of prepared.target){const c=Number(col.id);if(refs.some(ref=>{const b=range(ref);return b.min.col<=c&&b.max.col>=c&&b.min.row<=start&&b.max.row>=start;}))refs.push(`${colLetter(c)}${start}:${colLetter(c)}${last}`);}
      validation.setAttribute('sqref',[...new Set(refs)].join(' '));
    }
    // Work from a fresh copy so repeated exports never alter the original upload.
    const zip=await JSZip.loadAsync(await files.template.file.arrayBuffer());
    zip.file(original.path,new XMLSerializer().serializeToString(doc),{createFolders:false});
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function profiles(){
    try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(!saved||typeof saved!=='object'||Array.isArray(saved))throw new Error();return validProfiles(saved);}
    catch(error){throw new Error('Stockage des correspondances indisponible ou endommagé. Autorisez le stockage Chrome ; vos fichiers Excel restent utilisables en mémoire.');}
  }
  function saveProfiles(saved){try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(error){throw new Error('Impossible d’enregistrer les correspondances. Vérifiez l’espace disponible et les autorisations Chrome.');}}
  function validProfiles(saved){
    if(!saved||typeof saved!=='object'||Array.isArray(saved))throw new Error('Fichier de correspondances invalide.');
    for(const [name,p] of Object.entries(saved)){
      if(!name.trim()||name.length>100||!p||typeof p.signature!=='string'||!p.mapping||Array.isArray(p.mapping)||typeof p.mapping!=='object'||!Array.isArray(p.required)||Object.entries(p.mapping).some(([k,v])=>!/^\d+$/.test(k)||typeof v!=='string'||(v&&!/^\d+$/.test(v)))||p.required.some(v=>typeof v!=='string'||!/^\d+$/.test(v)))throw new Error('Profil de correspondances invalide.');
    }return saved;
  }
  async function request(path,data){
    if(path==='/api/upload'){
      const role=data.get('role'),file=data.get('file');if(!['catalog','template'].includes(role))throw new Error('Type de fichier invalide.');
      const book=await load(file);files[role]={book,file};prepared=null;
      return {name:file.name,sheets:book.sheets.map(s=>({name:s.name,rows:s.maxRow,preview:Array.from({length:Math.min(s.maxRow,12)},(_,i)=>Array.from({length:s.maxCol},(_,c)=>{const v=value(book,s.cells.get(colLetter(c+1)+(i+1)));return v===null?'':String(v);} ))}))};
    }
    if(path==='/api/prepare'){
      if(!files.catalog||!files.template)throw new Error('Importez les deux fichiers.');
      if(!Number.isInteger(data.startRow)||data.startRow<=data.templateHeader||data.startRow>20000)throw new Error('La première ligne de données doit suivre les en-têtes (maximum 20 000).');
      const sourceSheet=sheet(files.catalog.book,data.catalogSheet),targetSheet=sheet(files.template.book,data.templateSheet);
      const source=columns(files.catalog.book,sourceSheet,data.catalogHeader),target=columns(files.template.book,targetSheet,data.templateHeader),rows=catalog(files.catalog.book,sourceSheet,data.catalogHeader,source);
      prepared={source,target,rows,settings:{...data}};return {source,target,rows,mapping:suggest(source,target)};
    }
    if(path==='/api/check')return check(data);
    if(path==='/api/export')return exportBook(data);
    if(path==='/api/profile'){
      const name=String(data.name).trim();if(!name||name.length>100)throw new Error('Nom de marketplace requis (100 caractères maximum).');
      const saved={...profiles(),[name]:data.profile};validProfiles(saved);saveProfiles(saved);return {profiles:saved};
    }
    throw new Error('Action inconnue.');
  }
  async function openCatalogue(file){
    const book=await load(file);
    return {sheets:book.sheets.map(s=>({name:s.name,rows:s.maxRow})),read(name,header,kinds={}){
      const selected=sheet(book,name),source=columns(book,selected,header).map(c=>({...c,kind:kinds[c.id]||c.kind}));
      return {source,rows:catalog(book,selected,header,source)};
    }};
  }
  return {openCatalogue,request,profiles,importProfiles(saved){const merged={...profiles(),...validProfiles(saved)};saveProfiles(merged);return merged;},demoFile(name){const bytes=Uint8Array.from(atob(window.SEMIN_DEMO[name]),c=>c.charCodeAt(0));return new File([bytes],name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}};
})();
