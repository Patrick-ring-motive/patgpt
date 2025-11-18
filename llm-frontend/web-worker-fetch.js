(()=>{
    const Q = fn => {
      try {
        return fn?.()
      } catch {}
    };
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const postTask = (callback, options = {}) => scheduler.postTask(callback, {
      priority: "background",
      ...options
    });
    const delay = (fn, time = 1) => setTimeout(fn, time);
    const callback = Q(() => requestIdleCallback) ?? Q(() => scheduler)?.postTask ? postTask : Q(() => requestAnimationFrame) ?? delay;
    const nextIdle = () => new Promise(resolve => callback(resolve));
  (()=>{
    if(Q(()=>self.Window))return;
    self.onmessage = (event) => {
        let payload;
        const id = event.data.id;
        try{
            payload = await fetch(event.data.url,event.data);
            payload = await res.text();
        }catch(e){
            payload = e.message ?? e
        }
        self.postMessage({id,payload});
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
      }finally{
          (async()=>{
              await nextIdle();
              fetchWorkerMap.delete(requestInit.id);
          })();
      }
    };
    


  })();
})();
