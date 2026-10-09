const fs=require('node:fs');
// HTMLService's inline-script rewriter can mistake URL slashes in XML strings for comments.
// Hex escapes preserve the JavaScript string value while keeping those slashes out of its input.
const inlineScript=f=>fs.readFileSync(f,'utf8').replace(/https?:\/\//g,url=>url.replace(/\//g,'\\x2f')).replace(/<\/script/gi,'<\\/script');
const source=fs.readFileSync('apps-script/Code.gs','utf8');
const table=source.slice(source.indexOf('const TABLES_'),source.indexOf('// This is the only public'));
const part=(start,end)=>source.slice(source.indexOf(start),end?source.indexOf(end):undefined);
const helpers=table+part('function fail_','function authorize_')+part('function cell_','// Shared private helpers.')+"const LOG_HEADERS_=['Timestamp','Access ID','Operation','Result'];\n"+part('function accessLog_','function equalHash_');
fs.writeFileSync('apps-script-guest/ReadHelpers.gs',helpers);
let html=fs.readFileSync('index.html','utf8').replace('<body>','<body class="guest-view">').replace('Sign in to Google','Loading journal…').replace('<title>My Reintegration</title>','<title>My Reintegration — Read-only view</title><meta name="robots" content="noindex,nofollow">').replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/g,'').replace(/<link rel="stylesheet"[^>]+>/,'');
const style=fs.readFileSync('style.css','utf8')+'\n.guest-view #connect,.guest-view #signout,.guest-view #settings,.guest-view #accessManager,.guest-view #editor,.guest-view #preferences,.guest-view #reportDialog h3,.guest-view #reportDialog label,.guest-view #reportDialog .small,.guest-view #email,.guest-view #eml{display:none!important}';
html=html.replace('</head>','<base target="_top"><style>'+style+'</style></head>');
html=html.replace('</body>',['guest-store.js','excel-export.js','app.js','guest-view.js'].map(f=>'<script>'+inlineScript(f)+'</script>').join('')+'</body>');
fs.writeFileSync('apps-script-guest/View.html',html);
