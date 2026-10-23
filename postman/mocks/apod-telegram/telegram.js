// Local-only Telegram Bot API subset; all tokens/chat IDs are fake.
const http = require('http');
const failed = new Set();
http.createServer(async (req,res) => {
  let body=''; for await (const chunk of req) body+=chunk;
  let data={}; try { data=JSON.parse(body); } catch { data=Object.fromEntries(new URLSearchParams(body)); }
  res.setHeader('Content-Type','application/json');
  const method=req.url.split('/').pop();
  if (method === 'reset') { failed.clear(); return res.end(JSON.stringify({ok:true,result:true})); }
  if (method !== 'sendPhoto' && method !== 'sendMessage' && method !== 'sendVideo') { res.writeHead(501); return res.end('{}'); }
  // One recipient fails once, to verify per-user retry after another succeeds.
  if (method === 'sendMessage' && String(data.chat_id)==='222' && !failed.has('222')) {
    failed.add('222'); res.writeHead(500); return res.end(JSON.stringify({ok:false,error_code:500,description:'Temporary delivery failure'}));
  }
  // Simulate Telegram rejecting the first HD photo URL, then accepting standard.
  if (method === 'sendPhoto' && String(data.photo).includes('hd-fail')) {
    res.writeHead(400); return res.end(JSON.stringify({ok:false,error_code:400,description:'Wrong remote file identifier'}));
  }
  res.end(JSON.stringify({ok:true,result:{message_id:1,date:0,chat:{id:Number(data.chat_id),type:'private'},text:data.text||'',photo:method==='sendPhoto'?[{file_id:'test',file_unique_id:'test',width:2,height:2}]:[]}}));
}).listen(process.env.PORT);
