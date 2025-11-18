(()=>{
    const Q = fn => {
      try {
        return fn?.()
      } catch {}
    };
  (()=>{
    if(Q(()=>self.Window))return;
    self.onmessage = (event) => {
        console.log('Message from main thread:', event.data);
        const res = await fetch(event.data.url,event.data);
        
    };
  })();

  (()=>{
    if(!Q(()=>self.Window))return;
    const fetchWorkerMap = new Map();
    const fetchWorker = new Worker(document.currentScript.src);
    fetchWorker.onmessage = (event) => {
        fetchWorkerMap.get(event.data.id)?.resolve(event.data.payload);
    };

    globalThis.workerFetch =>async (requestInit)=>{
      try{
      requestInit.id  = crypto.randomUUID();
      const resolve = x=>x;
      const promise = new Promise(()=>resolve);
      fetchWorkerMap.set(requestInit.id,{promise,resolve});
      fetchWorker.postMessage(requestInit);
      return await promise;
      }catch(e){
        console.warn(e,requestInit);
      }
    };
    


  })();
})();
