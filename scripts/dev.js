import {spawn} from 'node:child_process';
const children=[];let closing=false;
function stop(code=0){if(closing)return;closing=true;process.exitCode=code;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),500);}
for(const [cmd,args] of [[process.execPath,['--watch','server/index.js']],[process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','5173','--strictPort']]]){
 const child=spawn(cmd,args,{stdio:'inherit'});children.push(child);child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>{if(!closing)stop(code||0);});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
