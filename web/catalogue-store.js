/* Repository API: a future authenticated repository can implement read/save without changing the domain. */
'use strict';
window.CatalogueStore = (() => {
  let connection;
  function open(){if(connection)return connection;connection=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('IndexedDB indisponible. Le catalogue ne peut pas être sauvegardé sur cet appareil.'));return;}
    const request=indexedDB.open('semin-marketplace-studio',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=null;};resolve(request.result);};
    request.onerror=()=>{connection=null;reject(new Error('Impossible d’ouvrir le stockage local. Vérifiez les autorisations Chrome.'));};
    request.onblocked=()=>reject(new Error('Fermez les autres onglets SEMIN pour ouvrir le catalogue.'));
  });return connection;}
  async function read(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readonly'),req=tx.objectStore('workspace').get('catalogue');req.onsuccess=()=>{try{resolve(req.result?CatalogueModel.validateSnapshot(req.result):CatalogueModel.empty());}catch(e){reject(e);}};req.onerror=()=>reject(new Error('Lecture du catalogue local impossible.'));});}
  async function save(next,expectedRevision){
    const safe=CatalogueModel.validateSnapshot(next),db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace');let saved,error;
      const req=store.get('catalogue');
      req.onsuccess=()=>{
        try{if(req.result)CatalogueModel.validateSnapshot(req.result);}catch(e){error=new Error('Le stockage existant est invalide. Aucun remplacement automatique n’est autorisé.');tx.abort();return;}
        const current=req.result?.revision||0;
        if(current!==expectedRevision){error=new Error('Le catalogue a été modifié dans un autre onglet. Actualisez les données puis recommencez.');tx.abort();return;}
        saved={...safe,revision:current+1};store.put(saved,'catalogue');
      };
      tx.oncomplete=()=>{window.dispatchEvent(new Event('semin-catalogue-saved'));resolve(saved);};
      tx.onabort=tx.onerror=()=>reject(error||new Error('Enregistrement impossible (stockage plein ou refusé). Les données précédentes sont conservées.'));
    });
  }
  return {read,save};
})();
