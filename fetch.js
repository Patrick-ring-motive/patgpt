        
        (()=>{

          const Q = fn =>{
            try{return fn?.()}catch{}
           };
            const constructPrototype = newClass =>{
             try{
              if(newClass?.prototype)return newClass;
              const constProto = newClass?.constructor?.prototype;
              if(constProto){
               newClass.prototype = Q(()=>constProto?.bind?.(constProto)) ?? Object.create(Object(constProto));
               return newClass;
              }
              newClass.prototype = Q(()=>newClass?.bind?.(newClass)) ?? Object.create(Object(newClass));
             }catch(e){
              console.warn(e,newClass);
             }
            };
          const extend = (thisClass, superClass) => {
               try{
                      constructPrototype(thisClass);
                      constructPrototype(superClass);
                      Object.setPrototypeOf(
                          thisClass.prototype,
                          superClass?.prototype ??
                          superClass?.constructor?.prototype ??
                          superClass
                      );
                      Object.setPrototypeOf(thisClass, superClass);
          
                  } catch (e) {
                      console.warn(e, {
                          thisClass,
                          superClass
                      });
                  }
                  return thisClass;
              };
          const _fetch = globalThis.fetch;
          globalThis.fetch = extend(async function fetch(...args){
              const url = String(args[0]?.url ?? args[0]);
              if([
                'improving.llm.patrickring.net',
                'quack.llm.patrickring.net',
                'privacy-pro-eligible.json'
                ].some(x=>url.includes(x))){
                return new Response('{}');
            }
            if(url.includes('duckchat/v1/chat')){
              const body = JSON.parse(args[1].body);
              body.model = 'gpt-5-mini';
              for(const tool in body.metadata.toolChoice){
              // body.metadata.toolChoice[tool]=true;
              }
              body.metadata.toolChoice.WebSearch=true;
              args[1].body = JSON.stringify(body);
              console.log(body);
              try{
                let res = await _fetch.apply(this,args);
                if(res.status != 200){
                  res = new Response(\`data: {"id":"1","action":"success","created":'+new Date().getTime()+',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"'+res.statusText+'"}
data: [DONE]\`,{headers:{'content-type':'text/event-stream'}});
                  console.log(res);
                }
               // throw new Error('asdf');
                return res;
              }catch(e){
                return new Response(\`data: {"id":"1","action":"success","created":'+new Date().getTime()+',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"'+String(e?.message??e)+'"}
data: [DONE]\`,{headers:{'content-type':'text/event-stream'}});
              }
            }
            return _fetch.apply(this,args);
          },_fetch);
          const _sendBeacon = navigator.sendBeacon;
          navigator.sendBeacon = extend(function sendBeacon(...args){
              return true;
          },_sendBeacon);
      })();
