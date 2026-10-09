'use strict';
(() => {
  const M=CatalogueModel,repo=CatalogueStore;
  let data=M.empty(),handle=null,importSource=null,plan=null,restoreCandidate=null,editingId=null,editorRevision=null,restoreRevision=null,fileGeneration=0;
  let storageReady=false;
  const selected=new Set(),mapping={};let duplicateIndex=M.index(data),planPage=0,planSelected=new Set();
  const labels={add:'Ajout',update:'Modification',unchanged:'Identique',conflict:'Conflit — bloqué'};
  function announce(message,error=false){notify(message,error);}
  function nav(view){
    if(view==='mappings')view='exports';
    if(view==='sheets'){$('master-heading').textContent='Fiches produits';view='catalogue';}else if(view==='catalogue')$('master-heading').textContent='Catalogue maître';
    document.querySelectorAll('.studio-view').forEach(n=>n.hidden=n.id!=='studio-'+view);
    document.querySelectorAll('[data-studio-view]').forEach(n=>n.classList.toggle('active',n.dataset.studioView===view));
  }
  document.querySelectorAll('[data-studio-view]').forEach(n=>n.addEventListener('click',()=>nav(n.dataset.studioView)));
  document.querySelectorAll('[data-open-catalogue]').forEach(n=>n.addEventListener('click',()=>nav('catalogue')));
  $('demo').addEventListener('click',()=>nav('exports'),true);
  function actionMaster(id,fn){$(id).addEventListener('click',async()=>{const button=$(id);button.disabled=true;try{await fn();}catch(error){announce(error.message,true);if(id==='master-editor-save')$('master-editor-message').textContent=error.message;}finally{button.disabled=id==='master-restore'&&!$('master-restore-consent').checked;}});}
  async function commit(next,revision=data.revision){if(!storageReady)throw new Error('Le catalogue local n’a pas pu être chargé. Actualisez les données avant tout enregistrement.');data=await repo.save(next,revision);render();}
  function filtered(){const query=M.normalize($('master-search').value),family=$('master-family').value,status=$('master-status').value,complete=$('master-completeness').value;
    return data.products.filter(p=>(!query||['sku','ean','designation','family'].some(k=>M.normalize(p.values[k]).includes(query)))&&(!family||p.values.family===family)&&(!status||p.status===status)&&(!complete||(M.issues(p,data,duplicateIndex).length===0)===(complete==='complete')));
  }
  function renderList(){const rows=filtered();$('master-list-count').textContent=`${rows.length} résultat(s) · ${selected.size} sélectionné(s). Aperçu limité à 200 fiches.`;
    $('master-products').replaceChildren(table(['Sélection','SKU','EAN','Désignation','Famille','Préparation','Informations manquantes / erreurs','Fiche'],rows.slice(0,200).map(p=>{
      const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=selected.has(p.id);checkbox.setAttribute('aria-label',`Sélectionner la fiche ${p.values.sku||p.id}`);checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(p.id):selected.delete(p.id);renderList();});
      const button=el('button','Ouvrir');button.className='secondary';button.setAttribute('aria-label',`Ouvrir la fiche ${p.values.sku||p.id}`);button.addEventListener('click',()=>openEditor(p.id));
      return [checkbox,p.values.sku,p.values.ean,p.values.designation,p.values.family,p.status,M.issues(p,data,duplicateIndex).map(e=>e.field+' : '+e.message).join(' ; ')||'Aucune',button];
    })));
  }
  function render(){
    duplicateIndex=M.index(data);
    const valid=data.products.filter(p=>!M.issues(p,data,duplicateIndex).length);
    $('master-total').textContent=data.products.length;$('master-complete').textContent=valid.length;$('master-incomplete').textContent=data.products.length-valid.length;$('master-ready').textContent=valid.filter(p=>p.status==='Prêt à exporter').length;
    const current=$('master-family').value;$('master-family').replaceChildren(new Option('Toutes les familles',''));
    [...new Set(data.products.map(p=>p.values.family).filter(M.present))].sort().forEach(f=>$('master-family').append(new Option(f,f)));$('master-family').value=current;
    $('master-history').replaceChildren(table(['Date','Opération','Nombre'],data.history.slice(0,10).map(h=>[new Date(h.at).toLocaleString('fr-FR'),h.type,h.count])));
    $('master-attributes').replaceChildren(table(['Attribut','Type','Règle locale'],data.attributes.map(a=>[a.label,a.type==='number'?'Nombre':'Texte',a.required?'Requis pour le catalogue maître':'Facultatif'])));
    const ids=new Set(data.products.map(p=>p.id));for(const id of selected)if(!ids.has(id))selected.delete(id);
    renderList();
  }
  function clearPlan(){plan=null;$('master-import-plan').hidden=true;}
  async function chooseFile(file){
    const generation=++fileGeneration;clearPlan();importSource=null;$('master-plan').hidden=true;$('master-columns').replaceChildren();
    const opened=await BrowserExcel.openCatalogue(file);if(generation!==fileGeneration)return;
    handle=opened;$('master-file-name').textContent=file.name;$('master-sheet').replaceChildren(...opened.sheets.map(s=>new Option(s.name,s.name)));$('master-import-settings').hidden=false;
    announce('Catalogue lu dans le navigateur. Choisissez la feuille et la ligne des en-têtes.');
  }
  function readColumns(){if(!handle)throw new Error('Choisissez un catalogue Excel.');
    clearPlan();importSource=handle.read($('master-sheet').value,Number($('master-header').value));
    for(const key of Object.keys(mapping))delete mapping[key];
    for(const c of importSource.source)mapping[c.id]=M.guess(c.label,data.attributes)||'__new__';renderImportColumns();
    $('master-plan').hidden=false;announce('Vérifiez les associations avant de prévisualiser les changements.');
  }
  function renderImportColumns(){
    $('master-columns').replaceChildren(table(['Colonne Excel','Attribut du catalogue maître'],importSource.source.map(c=>{
      const select=el('select');select.setAttribute('aria-label','Attribut maître pour '+c.label);select.append(new Option('Ignorer cette colonne',''),new Option('Créer un nouvel attribut','__new__'));
      data.attributes.forEach(a=>select.append(new Option(a.label,a.id)));select.value=mapping[c.id];
      select.addEventListener('change',()=>{mapping[c.id]=select.value;clearPlan();});return [c.label,select];
    })));
  }
  function previewImport(){if(!importSource)throw new Error('Lisez les colonnes avant de continuer.');
    const resolved={},extra=[],kinds={};const labelsUsed=new Set(data.attributes.map(a=>M.normalize(a.label)));
    for(const c of importSource.source){let destination=mapping[c.id];if(destination==='__new__'){
      let label=c.label.trim();if(label.length>100)label=label.slice(0,85)+' (col. '+c.id+')';if(labelsUsed.has(M.normalize(label)))label=label.slice(0,80)+' (col. '+c.id+')';labelsUsed.add(M.normalize(label));
      destination='custom_'+M.uid();extra.push({id:destination,label,required:false,type:['price','weight','stock'].includes(c.kind)?'number':'text',group:'Attributs techniques'});
    }resolved[c.id]=destination;if(['sku','ean'].includes(destination))kinds[c.id]=destination;}
    const rows=handle.read($('master-sheet').value,Number($('master-header').value),kinds).rows;
    plan=M.planImport(data,rows,resolved,extra);
    planPage=0;planSelected=new Set(plan.items.filter(i=>i.action==='add').map(i=>i.row));renderPlan();$('master-import-plan').hidden=false;announce('Prévisualisation prête. Aucun changement n’a encore été enregistré.');
  }
  function renderPlan(){
    $('master-plan-summary').textContent=Object.entries(labels).map(([key,label])=>label+' : '+plan.items.filter(i=>i.action===key).length).join(' · ');
    $('master-plan-table').replaceChildren(table(['Appliquer','Ligne Excel','SKU / EAN','Action','Détail des changements'],plan.items.slice(planPage*200,(planPage+1)*200).map(item=>{
      const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=planSelected.has(item.row);checkbox.disabled=!['add','update'].includes(item.action);checkbox.dataset.importRow=item.row;checkbox.setAttribute('aria-label','Appliquer la ligne '+item.row);checkbox.addEventListener('change',()=>{checkbox.checked?planSelected.add(item.row):planSelected.delete(item.row);renderPlan();});
      const detail=el('div',undefined,'change-list');
      if(item.reason)detail.append(el('p',item.reason,'conflict'));
      else for(const change of item.changes)detail.append(el('p',`${change.label} : ${change.before||'∅'} → ${change.after||'∅'}`));
      return [checkbox,item.row,item.values.sku||item.values.ean||'Sans identifiant',labels[item.action],detail];
    })));
    const paging=el('div',undefined,'toolbar');const previous=el('button','Page précédente'),next=el('button','Page suivante');previous.className=next.className='secondary';previous.disabled=planPage===0;next.disabled=(planPage+1)*200>=plan.items.length;previous.addEventListener('click',()=>{planPage--;renderPlan();});next.addEventListener('click',()=>{planPage++;renderPlan();});paging.append(previous,el('span',`Page ${planPage+1} · ${planSelected.size} lignes cochées sur ${plan.items.length} · 200 lignes par page`),next);$('master-plan-table').append(paging);
  }
  function openEditor(id){const p=data.products.find(p=>p.id===id);if(!p)return;
    editingId=id;editorRevision=data.revision;$('master-editor-title').textContent='Fiche produit — '+(p.values.sku||p.values.ean||'Sans référence');
    $('master-editor-fields').replaceChildren(...data.attributes.map(a=>{const label=el('label',a.label+(a.required?' *':''));const input=el(a.id.includes('Description')||['technical','images','manuals','datasheets'].includes(a.id)?'textarea':'input');input.dataset.attribute=a.id;input.value=M.text(p.values[a.id]);input.maxLength=100000;input.setAttribute('aria-label',a.label);label.append(input);return label;}));
    $('master-editor-status').value=p.status;$('master-editor-message').textContent='';
    const errors=M.issues(p,data,duplicateIndex);$('master-editor-issues').textContent=errors.length?errors.map(e=>e.field+' : '+e.message).join(' · '):'Aucune erreur selon les règles du catalogue maître.';
    $('master-editor').showModal();
  }
  $('master-editor-close').addEventListener('click',()=>$('master-editor').close());
  actionMaster('master-editor-save',async()=>{
    if(editorRevision!==data.revision)throw new Error('Le catalogue a changé. Fermez puis rouvrez la fiche.');
    const values={};$('master-editor-fields').querySelectorAll('[data-attribute]').forEach(n=>values[n.dataset.attribute]=n.value);
    await commit(M.editProduct(data,editingId,values,$('master-editor-status').value),editorRevision);
    $('master-editor').close();announce('Fiche enregistrée dans le stockage local.');
  });
  $('master-file').addEventListener('change',async event=>{if(event.target.files[0])try{await chooseFile(event.target.files[0]);}catch(error){announce(error.message,true);}});
  for(const id of ['master-sheet','master-header'])$(id).addEventListener('change',()=>{clearPlan();importSource=null;$('master-plan').hidden=true;$('master-columns').replaceChildren();});
  actionMaster('master-read',readColumns);actionMaster('master-plan',previewImport);
  actionMaster('master-demo',async()=>{await chooseFile(BrowserExcel.demoFile('catalogue-demo.xlsx'));$('master-header').value=1;readColumns();previewImport();announce('Exemple fictif prêt à importer : cochez les lignes à enregistrer. Aucune donnée existante n’est remplacée automatiquement.');});
  actionMaster('master-apply',async()=>{if(!plan)throw new Error('Prévisualisez les modifications.');const rows=[...planSelected];const resolved={...plan.mapping};await commit(M.applyImport(data,plan,rows),plan.baseRevision);for(const c of importSource.source)mapping[c.id]=data.attributes.some(a=>a.id===resolved[c.id])?resolved[c.id]:(resolved[c.id]?'__new__':'');clearPlan();renderImportColumns();announce('Import confirmé et enregistré dans IndexedDB sur cet appareil.');});
  actionMaster('master-cancel',()=>{clearPlan();announce('Prévisualisation annulée. Aucune donnée modifiée.');});
  actionMaster('master-refresh',async()=>{storageReady=false;data=await repo.read();storageReady=true;clearPlan();render();announce('Catalogue local actualisé.');});
  for(const id of ['master-search','master-family','master-completeness','master-status'])$(id).addEventListener(id==='master-search'?'input':'change',renderList);
  actionMaster('master-select',()=>{filtered().forEach(p=>selected.add(p.id));renderList();});
  actionMaster('master-deselect',()=>{selected.clear();renderList();});
  actionMaster('attribute-add',async()=>{await commit(M.addAttribute(data,$('attribute-name').value,$('attribute-type').value,$('attribute-required').checked));$('attribute-name').value='';clearPlan();announce('Attribut ajouté. Il est disponible dans les fiches et les prochains imports.');});
  actionMaster('master-backup',()=>{if(!storageReady)throw new Error('Le catalogue local n’a pas pu être chargé ; sauvegarde annulée.');downloadLocal(new Blob([JSON.stringify(M.backup(data),null,2)],{type:'application/json'}),'semin-catalogue-maitre.json');announce('Sauvegarde préparée pour téléchargement. Conservez-la hors de GitHub.');});
  $('master-restore-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;
    restoreCandidate=null;$('master-restore-preview').hidden=true;$('master-restore-consent').checked=false;$('master-restore').disabled=true;
    try{if(file.size>20*1024*1024)throw new Error('Sauvegarde limitée à 20 Mo.');const parsed=JSON.parse(await file.text());const candidate=M.restore(data,parsed);restoreCandidate=parsed;restoreRevision=data.revision;
      $('master-restore-summary').textContent=`La sauvegarde contient ${candidate.products.length} produits et ${candidate.attributes.length} attributs. Elle remplacera les ${data.products.length} produits locaux, sans modifier les correspondances V1.`;
      $('master-restore-preview').hidden=false;announce('Sauvegarde vérifiée. Aucune donnée n’a encore été remplacée.');
    }catch(error){announce(error.message,true);}finally{event.target.value='';}
  });
  $('master-restore-consent').addEventListener('change',()=>$('master-restore').disabled=!$('master-restore-consent').checked);
  actionMaster('master-restore',async()=>{if(!restoreCandidate||!$('master-restore-consent').checked)throw new Error('Confirmez le remplacement du catalogue.');if(data.revision!==restoreRevision)throw new Error('Le catalogue a changé. Choisissez à nouveau la sauvegarde.');await commit(M.restore(data,restoreCandidate),restoreRevision);restoreCandidate=null;$('master-restore-preview').hidden=true;clearPlan();announce('Sauvegarde restaurée localement.');});
  actionMaster('master-restore-cancel',()=>{restoreCandidate=null;$('master-restore-preview').hidden=true;});
  M.STATUSES.forEach(status=>{$('master-status').append(new Option(status,status));$('master-editor-status').append(new Option(status,status));});
  nav('dashboard');
  repo.read().then(saved=>{data=saved;storageReady=true;render();}).catch(error=>announce(error.message+' Les fonctions Excel V1 restent accessibles dans Exports.',true));
})();
