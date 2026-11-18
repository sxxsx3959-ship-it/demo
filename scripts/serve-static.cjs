// Local preview server for the exported site. Vercel serves out/ directly.
const {createServer}=require('node:http');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve('out'),args=process.argv.slice(2),port=Number(args[args.indexOf('--port')+1])||3000;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.ttf':'font/ttf','.woff2':'font/woff2'};
createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let file;try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=path.resolve(root,'.'+name);if(file!==root&&!file.startsWith(root+path.sep))throw Error();if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file)&&!path.extname(file))file+='.html';}catch{res.writeHead(400);res.end();return;}
 let status=200;if(!fs.existsSync(file)||!fs.statSync(file).isFile()){status=404;file=path.join(root,'404.html');}
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(status,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Static site ready on http://localhost:${port}`));
