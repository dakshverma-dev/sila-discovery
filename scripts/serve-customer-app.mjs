import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root=resolve(import.meta.dirname,"../customer-demo/out");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".txt":"text/plain; charset=utf-8",".jpg":"image/jpeg",".png":"image/png",".woff2":"font/woff2",".ico":"image/x-icon"};
createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname),target=resolve(root,"."+pathname);
    if(target!==root&&!target.startsWith(root+sep)){res.writeHead(404);res.end();return;}
    const candidates=pathname==="/"?[resolve(root,"index.html")]:[target,target+".html",resolve(target,"index.html")];
    if(/^\/plans\/[^/]+$/.test(pathname))candidates.push(resolve(root,"plans/record.html"));
    if(/^\/venue\/sessions\/[^/]+$/.test(pathname))candidates.push(resolve(root,"venue/sessions/record.html"));
    if(/^\/s\/[^/]+$/.test(pathname))candidates.push(resolve(root,"s/record.html"));
    const sub=/^\/s\/[^/]+\/(clubs|request)$/.exec(pathname);if(sub)candidates.push(resolve(root,`s/record/${sub[1]}.html`));
    for(const file of candidates){try{if(!(await stat(file)).isFile())continue;res.writeHead(200,{"Content-Type":types[extname(file)]??"application/octet-stream","Cache-Control":"no-store"});res.end(req.method==="HEAD"?undefined:await readFile(file));return;}catch{}}
    res.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});res.end(await readFile(resolve(root,"404.html")));
  }catch{res.writeHead(500);res.end("Unable to serve the sample workspace.");}
}).listen(3400,"127.0.0.1",()=>console.log("Sila sample workspace: http://localhost:3400"));
