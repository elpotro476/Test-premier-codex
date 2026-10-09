'use strict';
const $ = id => document.getElementById(id);
const state = {token: '', files: {}, prepared: null, mapping: {}, required: new Set(), selected: new Set(), profiles: {}};
function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if(className) node.className = className; return node; }
function notify(message, error = false) { $('notice').hidden = false; $('notice').textContent = message; $('notice').className = error ? 'error' : ''; }
async function request(path, data) {
  const headers = {'X-Session': state.token};
  if (!(data instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {method: 'POST', headers, body: data instanceof FormData ? data : JSON.stringify(data)});
  if (!response.ok) { const error = await response.json(); throw new Error(error.error); }
  return path === '/api/export' ? response.blob() : response.json();
}
function invalidate() {
  $('export').disabled = true; $('stat-errors').textContent = '—';
  $('review').replaceChildren(); $('errors').replaceChildren();
  $('review-message').textContent = 'Les données ont changé. Relancez le contrôle avant export.';
  $('review-message').className = 'review-note';
}
function resetPreparation() {
  state.prepared = null; state.selected.clear();
  for (const id of ['products-card', 'mapping-card', 'review-card']) $(id).hidden = true;
  $('stat-products').textContent = '—'; $('stat-selected').textContent = '0'; $('stat-mapping').textContent = '—'; invalidate();
}
function table(headers, rows) {
  const t = el('table'); const head = el('thead'); const tr = el('tr');
  headers.forEach(h => tr.append(el('th', h))); head.append(tr); t.append(head);
  const body = el('tbody'); rows.forEach(values => { const row = el('tr'); values.forEach(v => { const td = el('td'); if(v instanceof Node) td.append(v); else {td.textContent = v === null || v === undefined ? '—' : String(v); td.title = td.textContent;} row.append(td); }); body.append(row); }); t.append(body); return t;
}
function preview(role) {
  const sheet = state.files[role]?.sheets.find(s => s.name === $(role + '-sheet').value);
  if (!sheet) return;
  $(role + '-preview').replaceChildren(table(['Ligne', ...sheet.preview[0].map((_, i) => `Col. ${i+1}`)], sheet.preview.map((row, i) => [i+1, ...row])));
}
async function upload(role, file) {
  resetPreparation();
  const form = new FormData(); form.append('role', role); form.append('file', file);
  const result = await request('/api/upload', form); state.files[role] = result;
  $(role + '-name').textContent = result.name; const select = $(role + '-sheet'); select.replaceChildren();
  result.sheets.forEach(s => { const option = el('option', s.name); option.value = s.name; select.append(option); }); preview(role);
}
function payload() { return {mapping: state.mapping, required: [...state.required], selected: [...state.selected]}; }
function productResults() {
  const source = state.prepared.source; const ids = source.filter(c => ['sku', 'ean'].includes(c.kind)).map(c => c.id);
  const query = $('search').value.toLowerCase().trim();
  return state.prepared.rows.filter(row => !query || (ids.length ? ids : source.map(c=>c.id)).some(id => String(row.values[id] ?? '').toLowerCase().includes(query)));
}
function renderProducts() {
  const columns = state.prepared.source; const results = productResults();
  const rendered = results.slice(0,200).map(row => {
    const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = state.selected.has(row.id); checkbox.setAttribute('aria-label', `Sélectionner la ligne ${row.id}`);
    checkbox.addEventListener('change', () => { if(checkbox.checked) state.selected.add(row.id); else state.selected.delete(row.id); $('stat-selected').textContent = state.selected.size; invalidate(); });
    return [checkbox, ...columns.map(c=>row.values[c.id])];
  });
  $('products').replaceChildren(table(['Sélection', ...columns.map(c=>c.label)], rendered));
  $('product-count').textContent = `${results.length} résultat(s) · ${state.selected.size} sélectionné(s). Aperçu limité à 200 lignes ; « Sélectionner les résultats » inclut tous les résultats.`;
  $('stat-selected').textContent = state.selected.size;
}
function renderMapping() {
  const rows = state.prepared.target.map(col => {
    const select = el('select'); select.setAttribute('aria-label', `Source pour ${col.label}`);
    const none = el('option', 'Ne pas renseigner'); none.value=''; select.append(none);
    state.prepared.source.forEach(c => {const option = el('option', `${c.label} (col. ${c.id})`); option.value=c.id; select.append(option);});
    select.value = state.mapping[col.id] || '';
    select.addEventListener('change',()=>{state.mapping[col.id]=select.value; updateMappingCount(); invalidate();});
    const label = el('label', undefined, 'required-label'); const checkbox = el('input'); checkbox.type='checkbox'; checkbox.checked=state.required.has(col.id); checkbox.setAttribute('aria-label', `${col.label} obligatoire`);
    checkbox.addEventListener('change',()=>{if(checkbox.checked) state.required.add(col.id); else state.required.delete(col.id); invalidate();}); label.append(checkbox, el('span','Obligatoire'));
    return [col.label, select, label];
  });
  $('mapping').replaceChildren(table(['Colonne du template', 'Colonne du catalogue', 'Règle de contrôle'], rows)); updateMappingCount();
}
function updateMappingCount(){ $('stat-mapping').textContent = `${Object.values(state.mapping).filter(Boolean).length} / ${state.prepared.target.length}`; }
function renderProfiles(){ $('profiles').replaceChildren(el('option','Choisir un profil…')); $('profiles').firstChild.value=''; Object.keys(state.profiles).forEach(name=>{const opt=el('option',name);opt.value=name;$('profiles').append(opt);}); }
function signature(){return JSON.stringify({source:state.prepared.source.map(c=>[c.id,c.label]),target:state.prepared.target.map(c=>[c.id,c.label])});}
async function prepare(){
  resetPreparation();
  const settings = {catalogSheet:$('catalog-sheet').value, catalogHeader:Number($('catalog-header').value), templateSheet:$('template-sheet').value, templateHeader:Number($('template-header').value), startRow:Number($('start-row').value)};
  const result = await request('/api/prepare',settings); state.prepared=result; state.mapping=result.mapping; state.required=new Set(result.target.filter(c=>c.required).map(c=>c.id));
  $('stat-products').textContent=result.rows.length; $('search').value=''; renderProducts();renderMapping();
  for(const id of ['products-card','mapping-card','review-card']) $(id).hidden=false;
  notify('Fichiers analysés. Sélectionnez les produits et vérifiez les correspondances proposées.');
}
async function review(){
  const result = await request('/api/check',payload()); $('stat-errors').textContent=result.errors.length;
  $('review-message').textContent = result.errors.length ? `${result.errors.length} erreur(s) à corriger. L’export est bloqué.` : `${result.count} produit(s) contrôlé(s), aucune erreur détectée par les règles du prototype. Prêt pour export et vérification humaine.`;
  $('review-message').className = result.errors.length ? 'review-note error-note' : 'review-note';
  $('errors').replaceChildren(...(result.errors.length ? [table(['Ligne catalogue','Champ','Erreur'],result.errors.map(e=>[e.row,e.column,e.message]))] : []));
  $('review').replaceChildren(table(['Ligne catalogue',...state.prepared.target.map(c=>c.label)],result.rows.slice(0,200).map(r=>[r.id,...state.prepared.target.map(c=>r.values[c.id])])));
  $('export').disabled=Boolean(result.errors.length);
}
function action(id,fn){$(id).addEventListener('click',async()=>{const button=$(id);button.disabled=true;try{await fn();}catch(e){notify(e.message,true);}finally{button.disabled=false;}});}
for(const role of ['catalog','template']){
  $(role+'-file').addEventListener('change',async e=>{if(e.target.files[0])try{await upload(role,e.target.files[0]);notify('Fichier importé. Vérifiez la feuille et les lignes choisies.');}catch(err){notify(err.message,true);}});
  const drop=$(role+'-drop'); drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});drop.addEventListener('dragleave',()=>drop.classList.remove('over'));drop.addEventListener('drop',async e=>{e.preventDefault();drop.classList.remove('over');if(e.dataTransfer.files[0])try{await upload(role,e.dataTransfer.files[0]);}catch(err){notify(err.message,true);}});
  $(role+'-sheet').addEventListener('change',()=>{preview(role);resetPreparation();}); $(role+'-header').addEventListener('change',resetPreparation);
}
$('start-row').addEventListener('change',resetPreparation);
action('prepare',prepare);
action('demo',async()=>{
  for(const [role,name] of [['catalog','catalogue-demo.xlsx'],['template','template-demo.xlsx']]){
    const data=await (await fetch('/examples/'+name)).blob();await upload(role,new File([data],name));
  }
  $('catalog-header').value=1;$('template-header').value=2;$('start-row').value=3;
  await prepare();state.selected=new Set(state.prepared.rows.map(r=>r.id));renderProducts();await review();
  notify('Démonstration chargée : le troisième produit contient volontairement des erreurs. Désélectionnez-le pour tester un export valide.');
});
$('search').addEventListener('input',()=>{if(state.prepared)renderProducts();});
action('select-all',()=>{productResults().forEach(r=>state.selected.add(r.id));renderProducts();invalidate();});
action('select-none',()=>{state.selected.clear();renderProducts();invalidate();});
action('check',review);
action('save-profile',async()=>{const data=await request('/api/profile',{name:$('marketplace').value,profile:{signature:signature(),mapping:state.mapping,required:[...state.required]}});state.profiles=data.profiles;renderProfiles();notify('Correspondances enregistrées localement pour cette marketplace.');});
$('profiles').addEventListener('change',()=>{const name=$('profiles').value;if(!name)return;const profile=state.profiles[name];if(profile.signature!==signature()){notify('Ce profil ne correspond pas aux colonnes de ces fichiers. Créez ou enregistrez un profil adapté.',true);return;}state.mapping={...profile.mapping};state.required=new Set(profile.required);$('marketplace').value=name;renderMapping();invalidate();notify('Correspondances enregistrées appliquées.');});
action('export',async()=>{const blob=await request('/api/export',payload());const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='semin-produits.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Fichier Excel généré. Vérifiez-le avant importation sur votre marketplace.');});
fetch('/api/session').then(r=>r.json()).then(data=>{state.token=data.token;state.profiles=data.profiles;renderProfiles();}).catch(()=>notify('Connexion locale impossible. Relancez l’application.',true));
