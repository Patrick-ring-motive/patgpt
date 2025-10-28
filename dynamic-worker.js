

const urlRow = url =>{
	return `<tr><td><a href="${url}">${url}</a><script>
		(async()=>{
			try{
				await import('${url}'+'?'+new Date().getTime());
			}catch{};
			try{
				await import('https://www.google.com/search?q=${encodeURIComponent(url)}');
			}catch{};	
		})();
	</script></td></tr>`;
};
async function onRequest(request,env,ctx) {
  const url = new URL(request.url);
  if((url?.pathname??'').length <= 2){
      return new Response('',{
          status : 302,
          headers: {location:'/Patrick-ring-motive'}
      });
  }
  const hostProxy = url.hostname;
  const hostMatch = RegExp(hostProxy,"gi");
  url.hostname = 'github.com';
  const urlMatch = RegExp(url.hostname,"gi");
  const modifiedRequest = new Request(url, Object.defineProperty(request,'headers',{
      value:new Headers(request.headers)
  }));
  modifiedRequest.headers.set('sec-fetch-dest','document');
  modifiedRequest.headers.set('sec-fetch-site','same-origin');
  modifiedRequest.headers.forEach((value, key) => {
      modifiedRequest.headers.set(key,String(value).replace(hostMatch,url.hostname));
  });
  let res =  await fetch(modifiedRequest);
  res = new Response(res.body,Object.defineProperty(res,'headers',{
      value:new Headers(res.headers)
  }));
  res.headers.forEach((value, key) => {
      res.headers.set(key,String(value).replace(urlMatch,hostProxy));
  });
  const contentType = String(res.headers.get('Content-Type'));
  if(/html/i.test(contentType)){
      let resText = (await res.text()) + 
      `<style>
      a[href^="/login"],
      a[href^="/signup"]{
          display:none;
          visibility:hidden;
      }
      </style>
      <script>
      document.querySelectorAll('a[href^="https://github.com"i]').forEach(x=>x.setAttribute('href',String(x.href).replace(/github\.com/i,location.host)));      
      document.querySelector('.vcard-names-container').innerHTML +='<br> This is a proxy of my github.<br>You can find the original here. <br><a href="https://www.github.com/Patrick-ring-motive">https://github.com/Patrick-ring-motive</a>';
      </script>
	  <table style="position: relative;z-index: 999999;">${[
		  'https://patrickring.net','https://github.com/Patrick-ring-motive',
		  'https://www.linkedin.com/in/patrick-ring-2415a785/',
		  'https://www.reddit.com/user/MissinqLink/'
	  ].map(urlRow).join('')}</table>`;
      res = cleanResponse(new Response(resText,res));          
  }
  return res;
}


function deleteAndSet(res,key,value){
  res = new Response(res.body,Object.defineProperty(res,'headers',{
      value:new Headers(res.headers)
  }));
  res.headers.delete(key);
  res.headers.set(key,value);
  return res;
}

function cleanResponse(response){       
  response = deleteAndSet(response,'Access-Control-Allow-Origin','*');
  response = deleteAndSet(response,'Access-Control-Allow-Methods','*');
  response = deleteAndSet(response,'Access-Control-Allow-Headers','*');
  response = deleteAndSet(response,'Access-Control-Allow-Credentials','true');
  response = deleteAndSet(response,'Access-Control-Max-Age','86400');
  response = deleteAndSet(response,'Referrer-Policy','unsafe-url');
  response.headers.delete('Content-Security-Policy');
  response.headers.delete('X-Frame-Options');
  response.headers.delete('Strict-Transport-Security');
  response.headers.delete('X-Content-Type-Options');
  response.headers.delete('Cross-Origin-Embedder-Policy');
  response = deleteAndSet(response,'Cross-Origin-Resource-Policy','cross-origin');
  response = deleteAndSet(response,'Cross-Origin-Opener-Policy','unsafe-none');
return response;
}
